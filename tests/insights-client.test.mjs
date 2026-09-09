import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

const compile=file=>ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const source=compile('lib/insights-client.ts'), helpers=compile('lib/insights.ts');
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function browser({origin='https://politicalverse.se',config={exclude:false,measurementId:null},blockedStorage=false,blockedWrite=false,fetcher}={}){
 let now=1800000000000;
 const requests=[],timers=new Map();let timerId=0;
 const store=()=>{const data=new Map();return {data,getItem:key=>{if(blockedStorage)throw Error('blocked');return data.get(key)??null;},setItem:(key,value)=>{if(blockedStorage || blockedWrite)throw Error('blocked');data.set(key,value);},removeItem:key=>{if(blockedStorage)throw Error('blocked');data.delete(key);}};};
 const localStorage=store(),sessionStorage=store(),window=new EventTarget(),document=new EventTarget();
 Object.assign(window,{innerWidth:390,innerHeight:844,scrollY:0});
 Object.assign(document,{hidden:false,referrer:'https://reddit.com/r/sweden/private',cookie:'',documentElement:{scrollHeight:3000}});
 class Clock extends Date {static now(){return now;}}
 const context={exports:{},URL,URLSearchParams,Event,EventTarget,CustomEvent,AbortSignal,Date:Clock,performance:{now:()=>now},crypto:webcrypto,window,document,localStorage,sessionStorage,location:{origin,pathname:'/rankings/',search:'?q=private&party=M'},screen:{width:390,height:844},matchMedia:()=>({matches:false}),setInterval:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},clearInterval:id=>timers.delete(id),setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},clearTimeout:id=>timers.delete(id),fetch:async(url,options={})=>{requests.push({url,...options});if(fetcher)return fetcher(url,options);return url==='/insights/config'?{ok:true,json:async()=>config}:{ok:true};},Element:class{},HTMLSelectElement:class{},HTMLFormElement:class{},ErrorEvent:class extends Event{}};
 const helperContext={exports:{},URL,URLSearchParams};vm.runInNewContext(helpers,helperContext);
 context.require=name=>name==='./insights'?helperContext.exports:name==='web-vitals'?{onLCP(){},onINP(){},onCLS(){}}:assert.fail(name);
 vm.runInNewContext(source,context);
 return {api:context.exports,window,document,localStorage,sessionStorage,requests,timers,advance:ms=>{now+=ms;},events:()=>requests.filter(r=>r.url==='/insights/collect').map(r=>JSON.parse(r.body))};
}

test('no config, identifiers or events before consent, after decline, or outside production',async()=>{
 for(const origin of ['https://politicalverse.se','http://127.0.0.1:4317','https://willrydh.github.io']){
  const b=browser({origin});b.api.startInsights();await settle();assert.equal(b.requests.length,0);assert.equal(b.sessionStorage.data.size,0);
  b.api.setStatisticsConsent('denied');b.api.startInsights();await settle();assert.equal(b.requests.length,0);
  if(origin!=='https://politicalverse.se'){b.api.setStatisticsConsent('granted');b.api.startInsights();await settle();assert.equal(b.requests.length,0);}
 }
});
test('consented navigation records one sanitised page per route, with a single visit and first source',async()=>{
 const b=browser();b.api.setStatisticsConsent('granted');const stop=b.api.startInsights();await settle();
 b.api.recordInsightNavigation('/people/?id=private&party=M');b.api.recordInsightNavigation('/people/?id=another');b.api.recordInsightNavigation('/en/press/');await settle();
 const pages=b.events().filter(e=>e.kind==='page');assert.deepEqual(pages.map(e=>e.path),['/rankings/','/people/','/en/press/']);assert.equal(new Set(pages.map(e=>e.visit)).size,1);assert.equal(pages[1].previous,'/rankings/');assert.ok(pages.every(e=>e.source==='reddit.com'));assert.ok(!JSON.stringify(b.events()).includes('private'));assert.ok(b.requests.every(r=>r.url.startsWith('/insights/')));stop();
});
test('denied or malformed admin config fails closed without identifiers',async()=>{
 for(const config of [{exclude:true},null,{},'broken']){const b=browser({config});b.api.setStatisticsConsent('granted');const stop=b.api.startInsights();await settle();assert.equal(b.events().length,0);assert.equal(b.sessionStorage.data.size,0);stop();}
});
test('withdrawal while config is delayed prevents collection, including queued callbacks',async()=>{
 let resolve;const b=browser({fetcher:()=>new Promise(r=>{resolve=r;})});b.api.setStatisticsConsent('granted');const stop=b.api.startInsights();b.api.setStatisticsConsent('denied');resolve({ok:true,json:async()=>({exclude:false})});await settle();b.api.recordInsightNavigation('/people/');await settle();assert.equal(b.events().length,0);assert.equal(b.sessionStorage.data.size,0);assert.equal(b.timers.size,0);stop();
});
test('withdrawal in another tab stops an existing collector and clears visit identifiers',async()=>{
 const b=browser();b.api.setStatisticsConsent('granted');const stop=b.api.startInsights();await settle();const before=b.events().length;
 b.localStorage.setItem('pv-statistics-v1',JSON.stringify({choice:'denied',expires:Date.now()+1e12}));b.window.dispatchEvent(new Event('storage'));b.api.recordInsightNavigation('/people/');b.document.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(b.events().length,before);assert.equal(b.timers.size,0);assert.equal(b.sessionStorage.data.size,0);stop();
});
test('storage restrictions still honour the current document choice and expire idle visits',async()=>{
 const b=browser({blockedStorage:true});b.api.setStatisticsConsent('granted');assert.equal(b.api.readStatisticsConsent(),'granted');const stop=b.api.startInsights();await settle();const first=b.events()[0].visit;b.advance(31*60000);b.document.dispatchEvent(new Event('visibilitychange'));await settle();const pages=b.events().filter(e=>e.kind==='page');assert.equal(pages.length,2);assert.notEqual(pages[1].visit,first);b.api.setStatisticsConsent('denied');const before=b.events().length;b.api.recordInsightNavigation('/people/');await settle();assert.equal(b.events().length,before);stop();
});
test('background/foreground signals and expired consent do not keep a visitor active',async()=>{
 const b=browser();b.api.setStatisticsConsent('granted');const stop=b.api.startInsights();await settle();b.advance(15000);b.document.hidden=true;b.document.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(b.events().at(-1).kind,'leave');assert.equal(b.events().at(-1).elapsed,15000);
 b.advance(10000);b.document.hidden=false;b.document.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(b.events().at(-1).kind,'heartbeat');assert.equal(b.events().at(-1).elapsed,0);
 b.advance(181*86400000);const before=b.events().length;b.api.recordInsightNavigation('/people/');await settle();assert.equal(b.events().length,before);stop();
});
test('rapid navigation waits for preceding page delivery; withdrawal drops pending requests',async()=>{
 let release;const b=browser({fetcher:(url)=>url==='/insights/config'?Promise.resolve({ok:true,json:async()=>({exclude:false})}):new Promise(r=>{release=r;})});b.api.setStatisticsConsent('granted');const stop=b.api.startInsights();await settle();b.api.recordInsightNavigation('/people/');b.api.recordInsightNavigation('/en/press/');await settle();assert.equal(b.events().filter(e=>e.kind==='page').length,1);b.api.setStatisticsConsent('denied');release({ok:true});await settle();assert.equal(b.events().length,1);stop();
});
test('temporary config outage retries while consent remains granted',async()=>{
 let attempt=0;const b=browser({fetcher:url=>Promise.resolve(url==='/insights/config'?{ok:++attempt>1,json:async()=>({exclude:false})}:{ok:true})});b.api.setStatisticsConsent('granted');const stop=b.api.startInsights();await settle();assert.equal(b.events().length,0);const retry=[...b.timers.values()].find(t=>t.delay===30000);assert.ok(retry);retry.fn();await settle();assert.equal(b.events().filter(e=>e.kind==='page').length,1);stop();
});

test('a write-only storage failure still honours allowance and withdrawal in this document',async()=>{
 const b=browser({blockedWrite:true});b.api.setStatisticsConsent('granted');assert.equal(b.api.readStatisticsConsent(),'granted');const stop=b.api.startInsights();await settle();assert.equal(b.events().filter(e=>e.kind==='page').length,1);b.api.setStatisticsConsent('denied');assert.equal(b.api.readStatisticsConsent(),'denied');const before=b.events().length;b.api.recordInsightNavigation('/people/');await settle();assert.equal(b.events().length,before);stop();
});
