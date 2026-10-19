import { performance } from 'node:perf_hooks';
import type { APIResponse } from '@playwright/test';

export interface Sample {
  request: string;
  round: number;
  status: number;
  ms: number;
}

export interface PerformanceRun {
  rounds: number;
  samples: Sample[];
}

export interface RequestStats {
  request: string;
  count: number;
  averageMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
}

// The clock runs from just before the request is sent until the whole response body has arrived.
export async function measure(call: () => Promise<APIResponse>): Promise<{ response: APIResponse; ms: number }> {
  const start = performance.now();
  const response = await call();
  await response.body();
  return { response, ms: performance.now() - start };
}

const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

// Nearest-rank percentile. With only a few samples the p95 is simply the slowest one.
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

export function overallAverage(samples: Sample[]): number {
  return average(samples.map((sample) => sample.ms));
}

// One row per request, in the order the requests were first sent.
export function summarise(samples: Sample[]): RequestStats[] {
  const byRequest = new Map<string, number[]>();
  for (const { request, ms } of samples) {
    byRequest.set(request, [...(byRequest.get(request) ?? []), ms]);
  }
  return [...byRequest.entries()].map(([request, times]) => ({
    request,
    count: times.length,
    averageMs: average(times),
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    p95Ms: percentile(times, 95),
  }));
}

// Plain-text table, so it reads the same in the HTML report and in a terminal.
export function formatTable(header: string[], rows: string[][]): string {
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => (row[column] ?? '').length)));
  const line = (cells: string[]): string =>
    cells.map((cell, column) => (column === 0 ? cell.padEnd(widths[column] ?? 0) : cell.padStart(widths[column] ?? 0))).join('  ');
  return [line(header), widths.map((width) => '-'.repeat(width)).join('  '), ...rows.map(line)].join('\n');
}

export const ms = (value: number): string => String(Math.round(value));
