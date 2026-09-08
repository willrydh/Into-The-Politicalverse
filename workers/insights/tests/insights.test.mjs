import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID, pbkdf2Sync } from 'node:crypto';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const origin='https://politicalverse.se';
const password=randomBytes(24).toString('base64url');
const salt=randomBytes(16);
const hash=`100000:${salt.toString('hex')}:${pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex')}`;
const build=resolve('.wrangler/insights-test-bundle');
execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','workers/insights/wrangler.jsonc','--outdir',build],{stdio:'pipe',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});

test('private dashboard and consented first-party measurement',async t=>{
 const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:4317,modulesRoot:build,modules:['index.js',...readdirSync(build).filter(file=>file!=='index.js')].filter(file=>file.endsWith('.js')||file.endsWith('.html')).map(file=>({type:file==='index.js'?'ESModule':'Text',path:resolve(build,file)})),compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],bindings:{SITE_ORIGIN:origin,GA_MEASUREMENT_ID:'',ADMIN_PASSWORD_HASH:hash,SESSION_SECRET:randomBytes(32).toString('hex')},d1Databases:{DB:'insights-test'}}));
 t.after(()=>mf.dispose());
 const db=await mf.getD1Database('DB');
 for(const sql of readFileSync('workers/insights/migrations/0001_insights.sql','utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 const request=(path,init={})=>mf.dispatchFetch(origin+path,{redirect:"manual",...init});
 const login=(pass=password,ip='192.0.2.10',extra={})=>request('/admin/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded','CF-Connecting-IP':ip,...extra},body:new URLSearchParams({username:'admin',password:pass}),redirect:'manual'});
 const send=(body,extra={})=>request('/insights/collect',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1','CF-Connecting-IP':'192.0.2.20',...extra},body:JSON.stringify(body)});
 let cookie;
 await t.test('all dashboard data and scripts require authentication',async()=>{
  for(const path of['/admin/api/report','/admin/api/realtime','/admin/api/system','/admin/app.js'])assert.equal((await request(path)).status,401,path);
  const r=await request('/admin/');assert.equal(r.status,200);assert.match(r.headers.get('Cache-Control'),/no-store/);assert.match(r.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);assert.equal(r.headers.get('Referrer-Policy'),'same-origin');assert.match(await r.text(),/Logga in/);
  assert.equal((await mf.dispatchFetch('https://evil.example/admin/')).status,421);
 });
 await t.test('login rejects cross-site, incorrect and oversized requests; sessions are secure',async()=>{
  assert.equal((await login(password,'192.0.2.10',{Origin:'https://evil.example'})).status,403);
  assert.equal((await login('incorrect')).status,401);
  const large=await request('/admin/login',{method:'POST',headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.11'},body:'x'.repeat(20000)});assert.equal(large.status,400);
  const r=await login();assert.equal(r.status,303);const set=r.headers.get('Set-Cookie');for(const flag of['Secure','HttpOnly','SameSite=Strict','Path=/'])assert.ok(set.includes(flag));cookie=set.split(';')[0];
  const stored=await db.prepare('SELECT * FROM admin_sessions').all();assert.equal(stored.results.length,1);assert.ok(!cookie.includes(stored.results[0].token_hash));
  const authed=await request('/admin/',{headers:{Cookie:cookie}});assert.equal(authed.status,200);assert.ok((await authed.text()).includes("Besökarnas vägar"));
  assert.equal((await request('/admin/app.js',{headers:{Cookie:cookie}})).status,200);
 });
 await t.test('login guessing is bounded',async()=>{
  for(let i=0;i<10;i++)assert.equal((await login('incorrect','192.0.2.99')).status,401);
  assert.equal((await login(password,'192.0.2.99')).status,429);
 });
 const visit=randomUUID(),id=randomUUID();
 const event={id,visit,consent:true,kind:'page',path:'/people/?id=sensitive-candidate&party=S',previous:'/search/?q=private',source:'google.se',campaign:'private text',viewport:'390x844',screen:'390x844',mode:'standalone',label:'private search'};
 await t.test('collection requires consent and origin; administrators and bots are excluded',async()=>{
  assert.equal((await send({...event,consent:false})).status,400);
  assert.equal((await send(event,{Origin:'https://evil.example'})).status,403);
  assert.equal((await send(event,{'User-Agent':'Googlebot'})).status,204);
  assert.equal((await send(event,{Cookie:cookie})).status,204);
  const config=await (await request('/insights/config',{headers:{Cookie:cookie}})).json();assert.equal(config.exclude,true);assert.equal(config.measurementId,null);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM events').first()).n,0);
  const big=await send({...event,extra:'x'.repeat(6000)});assert.equal(big.status,400);
 });
 await t.test('events are deduplicated and stored with a closed vocabulary',async()=>{
  assert.equal((await send(event)).status,204);assert.equal((await send(event)).status,204);
  const rows=(await db.prepare('SELECT * FROM events').all()).results;assert.equal(rows.length,1);assert.equal(rows[0].path,'/people/');assert.equal(rows[0].previous_path,'/search/');assert.equal(rows[0].label,'');
  const v=await db.prepare('SELECT * FROM visits').first();assert.equal(v.source,'google.se');assert.equal(v.campaign,'');assert.equal(v.device,'mobile');assert.equal(v.mode,'pwa');assert.equal(v.viewport,'390x844');
  const dump=JSON.stringify([rows,v]);for(const token of['private','sensitive-candidate','192.0.2.20','Safari/604.1'])assert.ok(!dump.includes(token));
 });
 await t.test('navigation, live URLs and engagement use actual events',async()=>{
  await send({...event,id:randomUUID(),kind:'page',path:'/rankings/?county=14',previous:'/people/?id=private'});
  await send({visit,consent:true,kind:'heartbeat',path:'/rankings/',elapsed:30000});
  const live=await (await request('/admin/api/realtime',{headers:{Cookie:cookie}})).json();assert.deepEqual(live.pages,[{path:'/rankings/',visitors:1}]);
  const report=await (await request('/admin/api/report?days=7',{headers:{Cookie:cookie}})).json();assert.equal(report.totals[0].pageviews,2);assert.equal(report.totals[0].visits,1);assert.equal(report.engagement[0].engaged_ms,30000);assert.ok(report.transitions.some(r=>r.previous_path==='/people/'&&r.path==='/rankings/'&&r.transitions===1));
  await send({visit,consent:true,kind:'leave',path:'/rankings/',elapsed:1000});
  const after=await (await request('/admin/api/realtime',{headers:{Cookie:cookie}})).json();assert.equal(after.pages.length,0);
 });
 await t.test('unknown dimensions, URLs and event text cannot enter the report',async()=>{
  await send({...event,id:randomUUID(),visit:randomUUID(),path:'/admin/password?secret=abc',viewport:'private',screen:'99999x99999',source:'private',kind:'scroll',label:'90'});
  const row=await db.prepare("SELECT * FROM visits WHERE current_path='/404/'").first();assert.equal(row.viewport,'unknown');assert.equal(row.screen,'unknown');assert.equal(row.source,'direct');
  assert.equal((await send({...event,kind:'private_name'})).status,400);
  assert.equal((await send({...event,visit:'------------------------------------'})).status,400);
 });
 await t.test('logout is origin-protected and invalidates the server session',async()=>{
  assert.equal((await request('/admin/logout',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.example'}})).status,403);
  assert.equal((await request('/admin/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin}})).status,303);
  assert.equal((await request('/admin/api/report',{headers:{Cookie:cookie}})).status,401);
  const r=await login();const second=r.headers.get('Set-Cookie').split(';')[0];await db.prepare('UPDATE admin_sessions SET expires=0').run();assert.equal((await request('/admin/api/report',{headers:{Cookie:second}})).status,401);
 });
});
