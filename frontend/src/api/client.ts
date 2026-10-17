import type {
  AppHealth,
  PartMetadata,
  InspectionResult,
  BatchResultResponse,
  LatestBatchResponse,
  BenchmarkResult,
  TestRunResult,
} from '../types/api';

const API_BASE = '/api';

export async function fetchHealth(): Promise<AppHealth> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchParts(): Promise<PartMetadata[]> {
  const res = await fetch(`${API_BASE}/parts`);
  if (!res.ok) throw new Error(`Failed to list parts: ${res.statusText}`);
  return res.json();
}

export async function inspectPart(partId: number): Promise<InspectionResult> {
  const res = await fetch(`${API_BASE}/inspect/${partId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Inspection failed for Part ${partId}`);
  }
  return res.json();
}

export async function runBatchInspection(): Promise<BatchResultResponse> {
  const res = await fetch(`${API_BASE}/batch`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Batch inspection failed');
  }
  return res.json();
}

export async function fetchLatestBatch(): Promise<LatestBatchResponse> {
  const res = await fetch(`${API_BASE}/batch/latest`);
  if (!res.ok) throw new Error(`Failed to fetch latest batch: ${res.statusText}`);
  return res.json();
}

export async function runBenchmark(
  partId = 3,
  warmup = 3,
  iterations = 20
): Promise<BenchmarkResult> {
  const res = await fetch(
    `${API_BASE}/benchmark?part_id=${partId}&warmup=${warmup}&iterations=${iterations}`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error(`Benchmark failed: ${res.statusText}`);
  return res.json();
}

export async function runAutomatedTests(): Promise<TestRunResult> {
  const res = await fetch(`${API_BASE}/tests/run`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Test execution failed: ${res.statusText}`);
  return res.json();
}

export function getExportUrl(type: 'csv' | 'json' | 'dashboard' | 'charts-zip'): string {
  switch (type) {
    case 'csv':
      return `${API_BASE}/export/csv`;
    case 'json':
      return `${API_BASE}/export/json`;
    case 'dashboard':
      return `${API_BASE}/export/dashboard`;
    case 'charts-zip':
      return `${API_BASE}/export/charts-zip`;
  }
}
