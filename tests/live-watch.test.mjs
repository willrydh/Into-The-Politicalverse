import assert from 'node:assert/strict';
import test from 'node:test';
import { watchLive, WATCH_START, WATCH_END, WATCH_INTERVAL, WATCH_DURATION, withinCountingWindow } from '../scripts/watch-election-live.mjs';

function run(start, options = {}) {
  let clock = start, checks = 0;
  const order = [], messages = [];
  return watchLive({ now:()=>clock, sleep:async ms=>{order.push('sleep');clock+=ms;}, refresh:async()=>{order.push('refresh');checks++;return options.failFirst && checks===1 ? 1 : 0;}, publish:async()=>{order.push('publish');}, report:message=>messages.push(message), ...options }).then(result=>({result,clock,order,messages}));
}
test('watch runs bounded five-minute sequential cycles and publishes even a source error', async()=>{
  const r = await run(WATCH_START, {failFirst:true});
  assert.equal(r.result.checks, WATCH_DURATION / WATCH_INTERVAL);
  assert.equal(r.result.status, 0);
  assert.equal(r.clock, WATCH_START + WATCH_DURATION);
  assert.deepEqual(r.order.slice(0,6), ['refresh','publish','sleep','refresh','publish','sleep']);
  assert.ok(r.messages.some(m=>m.includes('::warning::')));
});
test('explicit audit and dates outside the election window run exactly once', async()=>{
  for (const [start,options] of [[WATCH_START-1,{}],[WATCH_END,{}],[WATCH_START,{once:true}]]) {
    const r = await run(start, options);
    assert.equal(r.result.checks,1);
    assert.deepEqual(r.order,['refresh','publish']);
  }
  assert.equal(withinCountingWindow(WATCH_START),true);
  assert.equal(withinCountingWindow(WATCH_END),false);
});
test('the watch stops at the final date and preserves an unresolved source failure',async()=>{
  const r = await run(WATCH_END-1000,{failFirst:true});
  assert.equal(r.clock,WATCH_END);
  assert.equal(r.result.checks,1);
  assert.equal(r.result.status,1);
});
test('publishing failure stops the watch instead of claiming continuing delivery',async()=>{
  let refreshes=0;
  await assert.rejects(run(WATCH_START,{refresh:async()=>{refreshes++;return 0;},publish:async()=>{throw Error('push failed');}}), /push failed/);
  assert.equal(refreshes,1);
});
test('short handoff audit is bounded and invalid durations cannot create an endless runner', async()=>{
  const r=await run(WATCH_START,{duration:60_000});
  assert.equal(r.result.checks,1);
  assert.equal(r.clock,WATCH_START+60_000);
  for(const duration of [0,-1,NaN,WATCH_DURATION+1]) await assert.rejects(run(WATCH_START,{duration}),/duration/);
});
