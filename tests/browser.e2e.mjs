import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createAppServer } from '../server.mjs';

const server = createAppServer({search: async () => []});
let browser, base;
const songs = [
  {id:'preview-1',title:'ترک ساختگی اول',artist:'هنرمند آزمایشی',kind:'پیش‌نمایش',thumbnail:'',post:'https://music.apple.com/',preview:'https://example.invalid/audio.mp3'},
  {id:'sc-1',title:'ترک ساختگی دوم',artist:'هنرمند فرضی',kind:'نسخهٔ رسمی',thumbnail:'',post:'https://soundcloud.com/',full:'https://soundcloud.com/example/placeholder'}
];

before(async () => {
  await new Promise((resolve,reject) => {
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
});

after(async () => {
  if (browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
});

async function mockSearch(page,{fail=false}={}){
  // Production service is NEVER contacted. Intercept the existing client API URL.
  await page.route('**/api/search?**',async route=>{
    const url=new URL(route.request().url());
    const query=url.searchParams.get('q')||'';
    if(fail) return route.fulfill({
      status:503,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},
      body:JSON.stringify({error:'خطای آزمایشی سرویس'})
    });
    return route.fulfill({
      status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},
      body:JSON.stringify({tracks:songs.map(s=>({...s,title:s.title+(query==='هیچکس'?' - جست‌وجو':'')}))})
    });
  });
}

test('RTL loads and synthetic tracks render in a real Chromium browser', async()=>{
  const page=await browser.newPage();
  await mockSearch(page);
  try {
    await page.goto(base);
    assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
    await page.locator('.track').first().waitFor();
    assert.equal(await page.locator('.track').count(),2);
    assert.match(await page.locator('#count').innerText(),/۲|2/);
    assert.equal(await page.locator('#notice').isVisible(),false);
  } finally {await page.close();}
});

test('Apple preview modal opens and closes without leaving media playing',async()=>{
  const page=await browser.newPage();
  await mockSearch(page);
  try{
    await page.goto(base);
    await page.locator('.track').first().locator('button.play').click();
    assert.equal(await page.locator('#player-dialog').evaluate(el=>el.open),true);
    assert.equal(await page.locator('#preview-player').isVisible(),true);
    assert.equal(await page.locator('#soundcloud-player').isVisible(),false);
    await page.locator('#close-player').click();
    assert.equal(await page.locator('#player-dialog').evaluate(el=>el.open),false);
    assert.equal(await page.locator('#preview-player').getAttribute('src'),'');
  }finally{await page.close();}
});

test('SoundCloud player uses the correct element and hides preview',async()=>{
  const page=await browser.newPage();
  await mockSearch(page);
  try{
    await page.goto(base);
    await page.locator('.track').nth(1).locator('button.play').click();
    assert.equal(await page.locator('#soundcloud-player').isVisible(),true);
    assert.equal(await page.locator('#preview-player').isVisible(),false);
    assert.match(await page.locator('#soundcloud-player').getAttribute('src'),/^https:\/\/w\.soundcloud\.com\/player/);
    assert.match(await page.locator('.track').nth(1).locator('a.open').innerText(),/SoundCloud/);
  }finally{await page.close();}
});

test('search input and Enter update results',async()=>{
  const page=await browser.newPage();
  await mockSearch(page);
  try{
    await page.goto(base);
    await page.locator('.track').first().waitFor();
    await page.locator('#search').fill('هیچکس');
    await page.locator('#search').press('Enter');
    await page.getByText('ترک ساختگی اول - جست‌وجو').waitFor();
    assert.match(await page.locator('#result-title').innerText(),/هیچکس/);
  }finally{await page.close();}
});

test('network API errors are visibly reported without stale tracks',async()=>{
  const page=await browser.newPage();
  await mockSearch(page,{fail:true});
  try{
    await page.goto(base);
    await page.locator('#notice').waitFor({state:'visible'});
    assert.match(await page.locator('#notice').innerText(),/خطای آزمایشی/);
    assert.equal(await page.locator('.track').count(),0);
    assert.equal(await page.locator('#search-button').isDisabled(),false);
  }finally{await page.close();}
});

test('mobile viewport remains usable and does not scroll horizontally',async()=>{
  const page=await browser.newPage({viewport:{width:375,height:812},deviceScaleFactor:1});
  await mockSearch(page);
  try{
    await page.goto(base);
    await page.locator('.track').first().waitFor();
    assert.equal(await page.locator('#search').isVisible(),true);
    assert.equal(await page.locator('#search-button').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);
  }finally{await page.close();}
});
