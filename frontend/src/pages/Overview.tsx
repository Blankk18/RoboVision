import React from 'react';
import {
  Play,
  ArrowRight,
  Layers,
  Ruler,
  AlertTriangle,
  Cpu,
  ShieldCheck,
  Zap,
  BarChart2,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';
import type { PageId } from '../components/Sidebar';
import type { BatchStats, BatchPartSummary } from '../types/api';
import { padPartId } from '../utils/format';


interface OverviewProps {
  onSelectPage: (page: PageId) => void;
  onSelectPart: (partId: number) => void;
  onRunBatch: () => void;
  batchLoading: boolean;
  batchStats: BatchStats | null;
  batchParts: BatchPartSummary[];
}

export const Overview: React.FC<OverviewProps> = ({
  onSelectPage,
  onSelectPart,
  onRunBatch,
  batchLoading,
  batchStats,
  batchParts,
}) => {
  const pipelineStages = [
    { num: 1, name: 'Original Image', desc: '800×800 calibrated grayscale input', icon: '📸' },
    { num: 2, name: 'Gaussian Blur', desc: '5×5 kernel, σ = 1.4 noise smoothing', icon: '〰️' },
    { num: 3, name: 'Otsu Threshold', desc: 'Variance-optimal binarization', icon: '🌓' },
    { num: 4, name: 'Morphology', desc: '9×9 Close followed by Open', icon: '🔲' },
    { num: 5, name: 'Contours', desc: 'Dimensions & centroid moments', icon: '📐' },
    { num: 6, name: 'Defect Analysis', desc: 'Statistical μ - 2σ dark cluster filter', icon: '🔍' },
    { num: 7, name: 'Decision & Pick', desc: 'PASS/FAIL sorting & robot coords', icon: '🤖' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Hero Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#0c1424] via-[#0f1d38] to-[#0c1424] border border-[#1e293b] p-8 md:p-10 shadow-xl overflow-hidden">
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #00f0ff 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-xs font-mono text-cyan-400">
            <Zap className="w-3.5 h-3.5" />
            Stage 3 Engineering Workstation · Om Nathwani
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-slate-100 tracking-tight leading-tight">
            Intelligent Quality Inspection Workstation
          </h2>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            Inspect, measure and classify simulated aluminium components using classical computer vision.
            Features deterministic image filtering, Otsu binarization, morphological cleaning, contour extraction,
            and 2-sigma statistical surface defect grading.
          </p>

          {/* Primary Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onSelectPage('workbench')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Inspection</span>
            </button>

            <button
              onClick={onRunBatch}
              disabled={batchLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#162238] hover:bg-[#1c2d4a] text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Activity className="w-4 h-4" />
              <span>{batchLoading ? 'Executing Batch...' : 'Run Full Batch'}</span>
            </button>

            <button
              onClick={() => {
                onSelectPage('workbench');
                onSelectPart(3);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] transition-all cursor-pointer"
            >
              <span>Try Demo Sequence</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Engineering Limits & Quality Tolerance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider text-[11px]">
              <Ruler className="w-4 h-4 text-cyan-400" />
              Dimensional Window
            </span>
            <span className="font-mono text-cyan-400">± 5.0 mm</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            115.0 – 125.0 <span className="text-sm font-normal text-slate-400">mm</span>
          </div>
          <p className="text-xs text-slate-400 leading-normal">
            Target nominal dimension is 120.0 mm. Both measured width and height must fall strictly inside this range.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider text-[11px]">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Defect Area Threshold
            </span>
            <span className="font-mono text-amber-400">Max 2.0%</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            &lt; 2.000 <span className="text-sm font-normal text-slate-400">%</span>
          </div>
          <p className="text-xs text-slate-400 leading-normal">
            Component surface pixels with intensity &lt; (μ - 2σ) constitute anomalous dark defects. ≥2.0% triggers immediate rejection.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider text-[11px]">
              <Cpu className="w-4 h-4 text-emerald-400" />
              Spatial Calibration
            </span>
            <span className="font-mono text-emerald-400">5.0 px/mm</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            800 × 800 <span className="text-sm font-normal text-slate-400">px</span>
          </div>
          <p className="text-xs text-slate-400 leading-normal">
            Camera frame origin located at (400, 400) px. Pick coordinate offsets computed with millimeter precision.
          </p>
        </div>
      </div>

      {/* Visual Summary of the 7-Stage Inspection Pipeline */}
      <div className="rounded-xl bg-[#0c121e] border border-[#1e293b] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Seven-Stage Computer Vision Pipeline
            </h3>
            <p className="text-xs text-slate-400">
              Each component undergoes deterministic processing from raw synthetic image to sorting decision.
            </p>
          </div>
          <button
            onClick={() => onSelectPage('pipeline')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
          >
            Explore Pipeline <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
          {pipelineStages.map((stage) => (
            <div
              key={stage.num}
              onClick={() => onSelectPage('pipeline')}
              className="p-3.5 rounded-lg bg-[#0f172a] hover:bg-[#16233b] border border-[#1e293b] hover:border-cyan-500/40 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    0{stage.num}
                  </span>
                  <span className="text-base">{stage.icon}</span>
                </div>
                <div className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                  {stage.name}
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-2 leading-tight">
                {stage.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Latest Batch Status Card */}
      <div className="rounded-xl bg-[#0c121e] border border-[#1e293b] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-cyan-400" />
              Latest Batch Execution Status
            </h3>
            <p className="text-xs text-slate-400">
              Session-level statistics computed from live OpenCV batch analysis.
            </p>
          </div>
          {batchStats && (
            <button
              onClick={() => onSelectPage('batch')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
            >
              View Analytics Charts <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {batchStats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-[#0f172a] border border-[#1e293b]">
              <div>
                <div className="text-[11px] text-slate-400 uppercase font-medium">Total Batch</div>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {batchStats.total_components} <span className="text-xs font-normal text-slate-400">parts</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 uppercase font-medium">Passed</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5" />
                  {batchStats.passed_components}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 uppercase font-medium">Failed</div>
                <div className="text-2xl font-bold font-mono text-red-400 flex items-center gap-1.5">
                  <XCircle className="w-5 h-5" />
                  {batchStats.failed_components}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 uppercase font-medium">Pass Rate</div>
                <div className="text-2xl font-bold font-mono text-cyan-300">
                  {batchStats.pass_rate_percent}%
                </div>
              </div>
            </div>

            {/* Quick part mini badges */}
            <div className="flex flex-wrap items-center gap-2">
              {batchParts.map((p) => (
                <button
                  key={p.part_id}
                  onClick={() => {
                    onSelectPage('workbench');
                    onSelectPart(p.part_id);
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    p.status === 'PASS'
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-600/40 hover:bg-emerald-900/60'
                      : 'bg-red-950/40 text-red-300 border-red-600/40 hover:bg-red-900/60'
                  }`}
                >
                  <span>P{padPartId(p.part_id)}</span>
                  <span className="font-bold">{p.status}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-lg bg-[#0f172a]/60 border border-dashed border-[#1e293b] text-center space-y-3">
            <Activity className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-medium text-slate-300">
              No new batch has been run during the current session.
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click &apos;Run Full Batch&apos; to trigger execution of all 10 synthetic components and generate real-time metrics.
            </p>
            <button
              onClick={onRunBatch}
              disabled={batchLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-900 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Full Batch Now</span>
            </button>
          </div>
        )}
      </div>

      {/* Operating Scope & Honest Limitations Notice */}
      <div className="p-5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-400 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-slate-200">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          Project Objective & Operating Boundaries
        </div>
        <p className="leading-relaxed">
          This workstation is developed for the <span className="text-slate-300 font-medium">Stage 3 Comprehensive Review</span> at{' '}
          <span className="text-slate-300 font-medium">Shah & Anchor Kutchhi Engineering College</span> for the course{' '}
          <span className="text-slate-300 font-medium">Essentials of Computer Science for Robotics (ECCOR2MD201)</span>. All components are generated as calibrated synthetic images with known ground-truth dimensions and defect clusters. Pick-and-place coordinates are computed for illustrative software verification; no physical manipulator or real-world industrial camera is connected.
        </p>
      </div>
    </div>
  );
};
