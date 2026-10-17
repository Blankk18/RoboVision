import React, { useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Maximize2,
  ZoomIn,
} from 'lucide-react';
import type { InspectionResult, PartMetadata } from '../types/api';
import { inspectPart } from '../api/client';
import { padPartId } from '../utils/format';


interface PresentationModalProps {
  currentPartId: number;
  parts: PartMetadata[];
  onClose: () => void;
  onSelectPart: (id: number) => void;
}

export const PresentationModal: React.FC<PresentationModalProps> = ({
  currentPartId,
  parts,
  onClose,
  onSelectPart,
}) => {
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  React.useEffect(() => {
    let isMounted = true;
    setLoading(true);
    inspectPart(currentPartId)
      .then((data) => {
        if (isMounted) setResult(data);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [currentPartId]);

  const handlePrev = () => {
    const prev = currentPartId <= 1 ? 10 : currentPartId - 1;
    onSelectPart(prev);
  };

  const handleNext = () => {
    const next = currentPartId >= 10 ? 1 : currentPartId + 1;
    onSelectPart(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#070b14] flex flex-col justify-between p-6 overflow-hidden animate-fadeIn select-none">
      {/* Top Presentation Bar */}
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-4">
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold text-slate-100 uppercase tracking-wider">
            ROBOT VISION WORKSTATION
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/40 font-mono">
            PRESENTATION MODE · STAGE 3 REVIEW
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Shortcuts */}
          <div className="flex items-center gap-1.5">
            {[3, 7, 2].map((pid) => (
              <button
                key={pid}
                onClick={() => onSelectPart(pid)}
                className={`px-3 py-1 rounded text-xs font-mono font-medium border transition-colors ${
                  currentPartId === pid
                    ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                    : 'bg-[#131c2e] text-slate-300 hover:bg-[#1a263e] border-[#1e293b]'
                }`}
              >
                Part {padPartId(pid)} ({pid === 3 ? 'PASS' : 'FAIL'})
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1e293b] transition-colors"
            title="Exit Presentation Mode (ESC)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Focus Area */}
      <div className="flex-1 my-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-center max-w-7xl mx-auto w-full">
        {/* Large Stage 7 Annotated Final Result (Col 7) */}
        <div className="md:col-span-7 bg-[#0b1120] border border-[#1e293b] rounded-2xl p-4 flex flex-col items-center justify-center relative shadow-2xl">
          {loading ? (
            <div className="h-[460px] flex flex-col items-center justify-center gap-3 text-slate-400">
              <RotateCcw className="w-10 h-10 animate-spin text-cyan-400" />
              <span className="text-sm font-medium">Processing Component Image...</span>
            </div>
          ) : result?.stages[6]?.image ? (
            <img
              src={result.stages[6].image}
              alt="Final inspection result"
              className="max-h-[520px] w-auto object-contain rounded-lg border border-[#1e293b]"
            />
          ) : (
            <div className="h-[460px] flex items-center justify-center text-slate-500 text-sm">
              No image available
            </div>
          )}

          <div className="mt-3 text-xs text-slate-400 font-mono">
            Computer Vision Final Inspection Overlay · Calibrated 5.0 px/mm
          </div>
        </div>

        {/* Large Metric Indicators (Col 5) */}
        <div className="md:col-span-5 space-y-6">
          {result && (
            <>
              {/* Part ID and Outcome Banner */}
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-4">
                <div>
                  <div className="text-xs text-slate-400 uppercase font-mono tracking-wider">
                    Inspected Specimen
                  </div>
                  <div className="text-4xl font-extrabold font-mono text-slate-100">
                    Part {padPartId(currentPartId)}
                  </div>
                </div>


                <div
                  className={`px-6 py-2.5 rounded-xl text-2xl font-black font-mono flex items-center gap-2 border shadow-lg ${
                    result.status === 'PASS'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/20'
                      : 'bg-red-500 text-white border-red-400 shadow-red-500/20'
                  }`}
                >
                  {result.status === 'PASS' ? (
                    <CheckCircle2 className="w-7 h-7" />
                  ) : (
                    <XCircle className="w-7 h-7" />
                  )}
                  {result.status}
                </div>
              </div>

              {/* Rationale */}
              <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b] text-sm text-slate-300">
                <span className="text-slate-400 font-medium">Evaluation Summary: </span>
                <span className="text-slate-100 font-semibold">{result.failure_reason}</span>
              </div>

              {/* Dimensional Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-1">
                  <div className="text-[11px] text-slate-400 uppercase">Width (115–125 mm)</div>
                  <div className={`text-2xl font-bold font-mono ${result.acceptance.width_ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.measurements.width_mm} <span className="text-sm font-normal text-slate-400">mm</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-1">
                  <div className="text-[11px] text-slate-400 uppercase">Height (115–125 mm)</div>
                  <div className={`text-2xl font-bold font-mono ${result.acceptance.height_ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.measurements.height_mm} <span className="text-sm font-normal text-slate-400">mm</span>
                  </div>
                </div>
              </div>

              {/* Defect Metrics & Pick */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-1">
                  <div className="text-[11px] text-slate-400 uppercase">Defect Area (&lt; 2.0%)</div>
                  <div className={`text-2xl font-bold font-mono ${result.acceptance.defect_ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.measurements.defect_percent}%
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-1">
                  <div className="text-[11px] text-slate-400 uppercase">Sorting Target</div>
                  <div className="text-lg font-bold font-mono text-cyan-300">
                    {result.coordinates.bin_type} BIN
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    ({result.coordinates.pick_x_mm}, {result.coordinates.pick_y_mm}) mm
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="flex items-center justify-between border-t border-[#1e293b] pt-4">
        <button
          onClick={handlePrev}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111927] hover:bg-[#182338] border border-[#1e293b] text-sm text-slate-200 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Previous Component</span>
        </button>

        <div className="text-xs text-slate-400 font-mono">
          Shah & Anchor Kutchhi Engineering College · Om Nathwani
        </div>

        <button
          onClick={handleNext}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111927] hover:bg-[#182338] border border-[#1e293b] text-sm text-slate-200 transition-colors cursor-pointer"
        >
          <span>Next Component</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
