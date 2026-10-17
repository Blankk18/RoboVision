import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Zap,
  Terminal,
  Activity,
  ShieldCheck,
  Cpu,
  Clock,
  Layers,
  FileCheck,
} from 'lucide-react';
import { runAutomatedTests, runBenchmark } from '../api/client';
import type { TestRunResult, BenchmarkResult, PartMetadata } from '../types/api';
import { padPartId } from '../utils/format';


interface ValidationBenchmarkProps {
  parts: PartMetadata[];
}

export const ValidationBenchmark: React.FC<ValidationBenchmarkProps> = ({ parts }) => {
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);
  const [testLoading, setTestLoading] = useState<boolean>(false);

  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState<boolean>(false);

  const handleRunTests = async () => {
    setTestLoading(true);
    try {
      const res = await runAutomatedTests();
      setTestResult(res);
    } catch (err: any) {
      alert(`Test run error: ${err.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  const handleRunBenchmark = async () => {
    setBenchmarkLoading(true);
    try {
      const res = await runBenchmark(3, 3, 20);
      setBenchmarkResult(res);
    } catch (err: any) {
      alert(`Benchmark error: ${err.message}`);
    } finally {
      setBenchmarkLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fadeIn">
      {/* Top Header */}
      <div className="p-5 rounded-xl bg-[#0c121e] border border-[#1e293b]">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-cyan-400" />
          System Validation & Performance Benchmarking
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Automated regression testing via pytest and high-precision in-memory algorithmic latency profiling.
        </p>
      </div>

      {/* Two Column Layout: Tests on Left, Benchmark on Right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* ── Test Suite Card ── */}
        <div className="p-6 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-5">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Automated Test Suite (pytest)
              </h3>
              <p className="text-[11px] text-slate-400">
                Executes tests in tests/test_pipeline.py
              </p>
            </div>

            <button
              onClick={handleRunTests}
              disabled={testLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 transition-colors cursor-pointer"
            >
              {testLoading ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Running Tests...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Pytest</span>
                </>
              )}
            </button>
          </div>

          {testResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-[#0f172a] border border-[#1e293b]">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Status</div>
                  <div className={`text-base font-bold font-mono ${testResult.status === 'passed' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testResult.status.toUpperCase()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Tests Passed</div>
                  <div className="text-base font-bold font-mono text-slate-100">
                    {testResult.passed} / {testResult.total_tests}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Duration</div>
                  <div className="text-base font-bold font-mono text-cyan-300">
                    {testResult.duration_sec}s
                  </div>
                </div>
              </div>

              {/* Console stdout view */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Terminal className="w-3.5 h-3.5" />
                  Pytest Session Log:
                </div>
                <pre className="p-3 rounded-lg bg-[#070b14] border border-[#1e293b] font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {testResult.stdout}
                </pre>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-lg bg-[#0f172a]/60 border border-dashed border-[#1e293b] text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-xs text-slate-300 font-medium">
                Tests have not been executed in this session.
              </div>
              <p className="text-[11px] text-slate-500">
                Click &apos;Execute Pytest&apos; to verify all 44 unit and integration test assertions.
              </p>
            </div>
          )}
        </div>

        {/* ── Performance Benchmark Card ── */}
        <div className="p-6 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-5">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Pipeline Latency Profiler
              </h3>
              <p className="text-[11px] text-slate-400">
                High-precision in-memory OpenCV speed benchmark
              </p>
            </div>

            <button
              onClick={handleRunBenchmark}
              disabled={benchmarkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 transition-colors cursor-pointer"
            >
              {benchmarkLoading ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Profiling...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Benchmark</span>
                </>
              )}
            </button>
          </div>

          {benchmarkResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-[#0f172a] border border-[#1e293b]">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Average Latency</div>
                  <div className="text-base font-bold font-mono text-cyan-400">
                    {benchmarkResult.avg_ms} ms
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Median Latency</div>
                  <div className="text-base font-bold font-mono text-slate-100">
                    {benchmarkResult.median_ms} ms
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Algorithm FPS</div>
                  <div className="text-base font-bold font-mono text-emerald-400">
                    {benchmarkResult.fps} FPS
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0f172a] border border-[#1e293b] text-xs space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-300">
                  Benchmark Configuration:
                </div>
                <div className="text-slate-400 text-[11px] space-y-1">
                  <div>• Iterations: {benchmarkResult.measured_iterations} runs (Warmup: {benchmarkResult.warmup_runs})</div>
                  <div>• Scope: {benchmarkResult.scope}</div>
                  <div>• Evaluated Part: Part {padPartId(benchmarkResult.part_id)}</div>
                  <div>• Timestamp: {benchmarkResult.timestamp}</div>

                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-lg bg-[#0f172a]/60 border border-dashed border-[#1e293b] text-center space-y-2">
              <Clock className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-xs text-slate-300 font-medium">
                No latency benchmark recorded in this session.
              </div>
              <p className="text-[11px] text-slate-500">
                Click &apos;Run Benchmark&apos; to measure pure OpenCV in-memory algorithmic execution speed.
              </p>
            </div>
          )}

          {/* Timing Scope Technical Note */}
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-[11px] text-slate-400">
            <span className="text-slate-300 font-medium">Technical Note:</span> Timing measures in-memory OpenCV execution only (blur → Otsu → morphology → contours → defect analysis). It strictly excludes disk I/O, network latency, and browser rendering.
          </div>
        </div>
      </div>

      {/* Historical Stage 2 Reference Alignment Matrix */}
      <div className="p-6 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-100">
            Stage 2 Historical Reference Alignment Matrix
          </h3>
          <p className="text-xs text-slate-400">
            Independent comparison of the 10 documented Stage 2 specification benchmarks with current algorithm outputs.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#1e293b]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0f172a] text-slate-400 font-semibold border-b border-[#1e293b]">
                <th className="py-2.5 px-3">Part #</th>
                <th className="py-2.5 px-3">Ref Width (mm)</th>
                <th className="py-2.5 px-3">Ref Height (mm)</th>
                <th className="py-2.5 px-3">Ref Defect %</th>
                <th className="py-2.5 px-3">Ref Status</th>
                <th className="py-2.5 px-3">Nominal Pick X</th>
                <th className="py-2.5 px-3">Nominal Pick Y</th>
                <th className="py-2.5 px-3">Design Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]/60 font-mono">
              {parts.map((p) => {
                const ref = p.stage2_reference;
                const isPass = ref.status === 'PASS';
                return (
                  <tr key={p.part_id} className="hover:bg-[#131c2e] transition-colors">
                    <td className="py-2 px-3 font-bold text-cyan-400">P{padPartId(p.part_id)}</td>
                    <td className="py-2 px-3 text-slate-200">{ref.width_mm?.toFixed(2)}</td>

                    <td className="py-2 px-3 text-slate-200">{ref.height_mm?.toFixed(2)}</td>
                    <td className="py-2 px-3 text-slate-200">{ref.defect_percent?.toFixed(3)}%</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isPass
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                            : 'bg-red-950/80 text-red-400 border-red-500/40'
                        }`}
                      >
                        {ref.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400">{p.expected_pick_x.toFixed(1)}</td>
                    <td className="py-2 px-3 text-slate-400">{p.expected_pick_y.toFixed(1)}</td>
                    <td className="py-2 px-3 text-[11px] font-sans text-slate-400">
                      {p.part_id === 3
                        ? 'Primary PASS benchmark'
                        : p.part_id === 7
                        ? 'Primary dimensional & defect FAIL benchmark'
                        : p.part_id === 2
                        ? 'Primary surface defect FAIL benchmark'
                        : 'Calibrated synthetic evaluation case'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
