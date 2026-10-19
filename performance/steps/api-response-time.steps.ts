import fs from 'node:fs';
import path from 'node:path';
import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import { request } from '@playwright/test';
import { env } from '../../config/env';
import { expect } from '../../support/expect';
import type { CustomWorld } from '../../support/world';
import { assertApiReachable, runRound } from '../support/api-flow';
import { formatTable, ms, overallAverage, summarise, type PerformanceRun } from '../support/timing';

const TIMINGS_FILE = path.resolve('reports', 'performance-timings.json');

function requireRun(world: CustomWorld): PerformanceRun {
  if (!world.performanceRun) {
    throw new Error('No requests have been measured yet. The "When" step is missing from the scenario.');
  }
  return world.performanceRun;
}

Given('the application API is reachable', async function (this: CustomWorld) {
  const api = await request.newContext({ timeout: env.performance.requestTimeoutMs });
  try {
    await assertApiReachable(api);
  } finally {
    await api.dispose();
  }
});

When(
  'the requests from the Postman collection are sent one at a time',
  // Each round takes several seconds against a real server, so this step gets more than the default time.
  { timeout: env.performance.rounds * 30_000 + 30_000 },
  async function (this: CustomWorld) {
    const run: PerformanceRun = { rounds: env.performance.rounds, samples: [] };
    // One connection is used for the whole run, as Postman does.
    const api = await request.newContext({ timeout: env.performance.requestTimeoutMs });
    try {
      // One request that is not counted, so the first measured request does not pay for opening the connection.
      await assertApiReachable(api);
      for (let round = 1; round <= run.rounds; round++) {
        await runRound(api, round, run.samples);
      }
    } finally {
      await api.dispose();
    }
    this.performanceRun = run;

    const stats = summarise(run.samples);
    const table = formatTable(
      ['Request', 'Samples', 'Avg ms', 'Min ms', 'Max ms', 'p95 ms'],
      stats.map((row) => [row.request, String(row.count), ms(row.averageMs), ms(row.minMs), ms(row.maxMs), ms(row.p95Ms)]),
    );
    this.attach(
      `${run.rounds} rounds against ${env.apiBaseUrl}\n\n${table}\n\nAverage of all ${run.samples.length} responses: ${ms(overallAverage(run.samples))} ms`,
      'text/plain',
    );

    fs.mkdirSync(path.dirname(TIMINGS_FILE), { recursive: true });
    fs.writeFileSync(
      TIMINGS_FILE,
      JSON.stringify({ target: env.apiBaseUrl, rounds: run.rounds, summary: stats, samples: run.samples }, null, 2),
    );
  },
);

Then('all {int} requests were answered successfully in every round', function (this: CustomWorld, expectedCount: number) {
  const run = requireRun(this);
  const names = [...new Set(run.samples.map((sample) => sample.request))];
  expect(names, 'number of different requests measured').toHaveLength(expectedCount);
  for (const name of names) {
    const count = run.samples.filter((sample) => sample.request === name).length;
    expect(count, `"${name}" samples`).toBe(run.rounds);
  }
});

Then(
  'these requests stay under their response-time limits from the Postman collection:',
  function (this: CustomWorld, table: DataTable) {
    const run = requireRun(this);
    const rows: string[][] = [];
    const tooSlow: string[] = [];

    for (const { request: name, 'limit in ms': limitText } of table.hashes()) {
      const limit = Number(limitText);
      const times = run.samples.filter((sample) => sample.request === name);
      if (!name || times.length === 0 || !Number.isFinite(limit)) {
        throw new Error(`Row "${name}" / "${limitText}" does not match a measured request or has no numeric limit`);
      }
      const slowest = Math.max(...times.map((sample) => sample.ms));
      for (const sample of times.filter((item) => item.ms >= limit)) {
        tooSlow.push(`${name}, round ${sample.round}: ${ms(sample.ms)} ms (limit ${limit} ms)`);
      }
      rows.push([name, ms(slowest), String(limit), slowest < limit ? 'within limit' : 'TOO SLOW']);
    }

    this.attach(formatTable(['Request', 'Slowest ms', 'Limit ms', 'Result'], rows), 'text/plain');
    expect(tooSlow, `Responses slower than their limit:\n${tooSlow.join('\n')}`).toEqual([]);
  },
);

Then('the average response time of all requests is under {int} ms', function (this: CustomWorld, limit: number) {
  const run = requireRun(this);
  const average = overallAverage(run.samples);
  expect(average, `Average of ${run.samples.length} responses was ${ms(average)} ms, the limit is ${limit} ms`).toBeLessThan(limit);
});
