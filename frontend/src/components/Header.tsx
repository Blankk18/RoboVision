import React from 'react';
import {
  Play,
  RotateCcw,
  Maximize2,
  CheckCircle,
  XCircle,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import type { PageId } from './Sidebar';
import type { BatchStats } from '../types/api';

interface HeaderProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  onSelectPart: (partId: number) => void;
  onRunBatch: () => void;
  batchLoading: boolean;
  batchStats: BatchStats | null;
  onTogglePresentation: () => void;
  onStartDemo: () => void;
}

const PAGE_TITLES: Record<PageId, { title: string; subtitle: string }> = {
  overview: {
    title: 'Overview & Executive Telemetry',
    subtitle: 'Automated Object Detection & Quality Inspection using Robot Vision.',
  },
  workbench: {
    title: 'ROBOVISION QMS 4.0 — Inspection Workbench',
    subtitle: 'Automated Object Detection & Quality Inspection · Calibrated Classical Computer Vision.',
  },
  batch: {
    title: 'Batch Quality Analytics',
    subtitle: 'Statistical distributions, dimensional tolerance scatter, and spatial binning.',
  },
  pipeline: {
    title: 'Computer Vision Pipeline Explorer',
    subtitle: 'Algorithmic breakdown and mathematical foundations of all seven inspection stages.',
  },
  validation: {
    title: 'Validation & Benchmarking',
    subtitle: 'Independent automated test suite verification and in-memory algorithmic latency profiling.',
  },
  about: {
    title: 'About the Project',
    subtitle: 'Academic background, project team, course specifications, and mathematical derivations.',
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onSelectPage,
  onSelectPart,
  onRunBatch,
  batchLoading,
  batchStats,
  onTogglePresentation,
  onStartDemo,
}) => {
  const meta = PAGE_TITLES[currentPage];

  return (
    <header className="h-16 px-6 bg-[#0c121e]/95 backdrop-blur border-b border-[#1e293b] flex items-center justify-between shrink-0 z-10 select-none">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
          {meta.title}
          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-800/40">
            QMS 4.0
          </span>
          <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded font-mono bg-amber-950/50 text-amber-300 border border-amber-600/30">
            SIMULATION · SYNTHETIC
          </span>
        </h1>
        <p className="text-xs text-slate-400 truncate max-w-xl">
          {meta.subtitle}
        </p>
      </div>

      {/* Right Action Tools */}
      <div className="flex items-center gap-2.5">
        {/* START DEMO High-Priority Button */}
        <button
          onClick={onStartDemo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 shadow-md shadow-cyan-950/50 transition-all cursor-pointer"
          title="Start Guided Stage 3 Demonstration Sequence"
        >
          <Zap className="w-3.5 h-3.5 fill-current text-slate-950" />
          <span>START DEMO</span>
        </button>

        {/* Quick Demo Shortcuts */}
        <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#111927] border border-[#1e293b]">
          <span className="text-[10px] font-medium text-slate-400 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
            Jump:
          </span>
          <button
            onClick={() => {
              onSelectPage('workbench');
              onSelectPart(3);
            }}
            className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-600/40 transition-colors flex items-center gap-1 cursor-pointer"
            title="Inspect Part 3 (Compliant PASS)"
          >
            <CheckCircle className="w-2.5 h-2.5" />
            P03 (PASS)
          </button>
          <button
            onClick={() => {
              onSelectPage('workbench');
              onSelectPart(7);
            }}
            className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-red-950/60 text-red-400 hover:bg-red-900/60 border border-red-600/40 transition-colors flex items-center gap-1 cursor-pointer"
            title="Inspect Part 7 (Dimensional & Defect FAIL)"
          >
            <XCircle className="w-2.5 h-2.5" />
            P07 (FAIL)
          </button>
          <button
            onClick={() => {
              onSelectPage('workbench');
              onSelectPart(2);
            }}
            className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-950/60 text-amber-400 hover:bg-amber-900/60 border border-amber-600/40 transition-colors flex items-center gap-1 cursor-pointer"
            title="Inspect Part 2 (Surface Defect FAIL)"
          >
            <XCircle className="w-2.5 h-2.5" />
            P02 (FAIL)
          </button>
        </div>

        {/* Batch Status Badge */}
        {batchStats ? (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#111c2e] border border-cyan-800/30 text-xs text-slate-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Batch: {batchStats.passed_components}/{batchStats.total_components} PASS</span>
            <span className="text-cyan-400 font-bold">({batchStats.pass_rate_percent}%)</span>
          </div>
        ) : null}

        {/* Run Full Batch Button */}
        <button
          onClick={onRunBatch}
          disabled={batchLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#111927] hover:bg-[#182338] disabled:bg-slate-800 text-slate-200 border border-[#1e293b] transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {batchLoading ? (
            <>
              <RotateCcw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current text-cyan-400" />
              <span className="hidden sm:inline">Run Batch</span>
            </>
          )}
        </button>

        {/* Presentation Mode Button */}
        <button
          onClick={onTogglePresentation}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1e293b] transition-colors border border-transparent hover:border-[#334155] cursor-pointer"
          title="Toggle Presentation Mode"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
