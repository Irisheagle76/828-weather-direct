import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rmdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);

export function refreshDates(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const next = new Date(`${today}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  // NWS may remove elapsed hours after noon. Afternoon retries refresh only tomorrow.
  return Number(parts.hour) < 12 ? [today, next.toISOString().slice(0,10)] : [next.toISOString().slice(0,10)];
}

async function run(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

async function main() {
  const dates = refreshDates();
  if (process.argv.includes('--plan')) { console.log(JSON.stringify(dates)); return; }
  const repo = path.resolve(import.meta.dirname, '..');
  const generatorRoot = 'C:/Users/Tim/828-weather-direct';
  const git = async (args, cwd = repo) => (await exec('git', args, { cwd, windowsHide: true })).stdout.trim();
  await git(['fetch', 'origin', '--prune']);
  const scratch = await mkdtemp(path.join(os.tmpdir(), '828-feelscore-publish-'));
  const checkout = path.join(scratch, 'checkout');
  // Only this owned, isolated checkout is edited. Feature/user work remains untouched.
  await git(['worktree', 'add', '--detach', checkout, 'origin/main']);
  try {
    const { validateForecast, getForecastPeriod } = await import(pathToFileURL(path.join(checkout, 'public/js/se-feelscore-period.js')));
    const paths = dates.flatMap(date => [`public/data/feelscore/${date}.json`, `public/data/feelscore/${date}.csv`]);
    for (const date of dates) {
      await run(process.execPath, ['scripts/generate-feelscore.mjs', `--date=${date}`, '--force', '--batch-size=100',
        '--require-complete', '--dated', `--output-dir=${path.join(checkout, 'public/data/feelscore')}`], generatorRoot);
      validateForecast(JSON.parse(await readFile(path.join(checkout, `public/data/feelscore/${date}.json`), 'utf8')), date);
    }
    await run(process.execPath, ['--test', 'tests/feelscore-engine.test.js'], generatorRoot);
    await git(['add', '--', ...paths], checkout);
    const staged = (await git(['diff', '--cached', '--name-only'], checkout)).split('\n').filter(Boolean);
    if (!staged.length || staged.some(file => !paths.includes(file))) throw new Error('Unexpected or missing staged forecast changes');
    await git(['commit', '-m', `Refresh Southeast FEELSCORE ${dates.join(', ')} [skip deploy]`], checkout);
    // Race-safe integration on current main; never force a push or deploy the website.
    let pushed = false;
    for (let attempt = 0; attempt < 3 && !pushed; attempt++) {
      await git(['fetch', 'origin'], checkout);
      await git(['rebase', 'origin/main'], checkout);
      try { await git(['push', 'origin', 'HEAD:main'], checkout); pushed = true; }
      catch (error) { if (attempt === 2) throw error; }
    }
    for (const date of dates) {
      const response = await fetch(`https://raw.githubusercontent.com/Irisheagle76/828-weather-direct/main/public/data/feelscore/${date}.json`,
        { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`Published ${date} verification failed (${response.status})`);
      validateForecast(await response.json(), date);
    }
    const live = await fetch('https://avlweather.com/api/router?route=se-feelscore', { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!live.ok) throw new Error(`Live FEELSCORE verification failed (${live.status})`);
    const liveData = await live.json();
    validateForecast(liveData, getForecastPeriod().forecastDate);
    console.log(JSON.stringify({ event: 'feelscore_published', dates, liveDate: liveData.forecastDate, generatedAt: liveData.generatedAt }));
    await git(['worktree', 'remove', checkout]);
    await rmdir(scratch);
  } catch (error) {
    console.error(`Publication failed. Recovery checkout preserved at ${checkout}`);
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
