import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const WATCH_END = Date.parse('2026-10-01T00:00:00Z');
export const WATCH_START = Date.parse('2026-09-12T22:00:00Z');
export const WATCH_INTERVAL = 5 * 60_000;
export const WATCH_DURATION = 4 * 60 * 60_000;
export const withinCountingWindow = now => now >= WATCH_START && now < WATCH_END;

// One runner performs repeated checks, avoiding a new schedule queue for every
// update. Outside the counting window (or during an explicit audit), run once.
export async function watchLive({ once = false, duration = WATCH_DURATION, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)), refresh, publish, report = console.log }) {
  if (!Number.isInteger(duration) || duration < 60_000 || duration > WATCH_DURATION) throw new Error('Watch duration must be 1–240 minutes');
  const start = now();
  const deadline = once || !withinCountingWindow(start) ? start : Math.min(start + duration, WATCH_END);
  let status = 0, checks = 0;
  do {
    status = await refresh();
    // Source failures still publish their checked status and retained good data.
    await publish();
    checks++;
    report(JSON.stringify({ checks, status, checkedAt: new Date(now()).toISOString() }));
    if (status !== 0) report('::warning::Official source check failed; retained data and error status published. Retrying next interval.');
    const remaining = deadline - now();
    if (remaining <= 0) break;
    await sleep(Math.min(WATCH_INTERVAL, remaining));
  } while (now() < deadline);
  return { checks, status };
}

async function main() {
  const output = resolve(process.argv[2] ?? '');
  if (!process.argv[2] || !output.endsWith('/election-2026.json')) throw new Error('Expected live-data/election-2026.json output');
  const published = resolve(output, '..');
  const git = (...args) => execFileSync('git', ['-C', published, ...args], {encoding:'utf8', timeout:60_000});
  if (git('remote', 'get-url', 'origin').trim().replace(/\.git$/, '') !== 'https://github.com/willrydh/Into-The-Politicalverse') throw new Error('Unexpected publication repository');
  if (git('branch', '--show-current').trim() !== 'live-data' || git('status', '--porcelain').trim()) throw new Error('Publication requires a clean live-data checkout');
  git('config', 'user.name', 'github-actions[bot]');
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
  const result = await watchLive({
    once: process.argv.includes('--once'),
    duration: Number(process.env.WATCH_MINUTES ?? '240') * 60_000,
    refresh: async () => {
      git('pull', '--ff-only', 'origin', 'live-data');
      const before = readFileSync(output, 'utf8');
      const run = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/update-election-live.ts', '--output', output], {stdio:'inherit', timeout:480_000});
      if (run.error || run.signal || ![0,1].includes(run.status)) throw new Error('Collector did not complete');
      const after = readFileSync(output, 'utf8');
      if (after === before) throw new Error('Collector did not write a checked snapshot');
      return run.status;
    },
    publish: async () => {
      git('add', '--', 'election-2026.json', 'area-results-2026.json');
      if (!git('diff', '--cached', '--name-only').trim()) return;
      git('commit', '-m', 'data: verify official election feed');
      git('push', 'origin', 'HEAD:live-data');
    }
  });
  process.exitCode = result.status;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
