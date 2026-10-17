import React, { useState, useEffect } from 'react';
import { X, ArrowRight, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import type { InspectionResult, PartMetadata } from '../types/api';
import { inspectPart } from '../api/client';
import { padPartId } from '../utils/format';


interface PartComparisonModalProps {
  currentResult: InspectionResult;
  parts: PartMetadata[];
  onClose: () => void;
}

export const PartComparisonModal: React.FC<PartComparisonModalProps> = ({
  currentResult,
  parts,
  onClose,
}) => {
  const [comparePartId, setComparePartId] = useState<number>(
    currentResult.part_id === 3 ? 7 : 3
  );
  const [compareResult, setCompareResult] = useState<InspectionResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    inspectPart(comparePartId)
      .then((data) => {
        if (isMounted) setCompareResult(data);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [comparePartId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 px-6 border-b border-[#1e293b] flex items-center justify-between bg-[#0b1120]">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Side-by-Side Component Comparison
            </h3>
            <p className="text-xs text-slate-400">
              Compare Part {padPartId(currentResult.part_id)} ({currentResult.status}) against another simulated component
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1e293b] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Part Selector Bar */}
        <div className="p-3 px-6 bg-[#131d30] border-b border-[#1e293b] flex items-center justify-between">
          <div className="text-xs text-slate-300 font-medium">
            Comparing <span className="text-cyan-400 font-bold">Part {padPartId(currentResult.part_id)}</span> with:
          </div>
          <div className="flex items-center gap-1.5">
            {parts.map((p) => (
              <button
                key={p.part_id}
                onClick={() => setComparePartId(p.part_id)}
                disabled={p.part_id === currentResult.part_id}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  p.part_id === comparePartId
                    ? 'bg-cyan-600 text-white font-bold'
                    : p.part_id === currentResult.part_id
                    ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-500'
                    : 'bg-[#1a2538] text-slate-300 hover:bg-slate-700'
                }`}
              >
                P{padPartId(p.part_id)}
              </button>
            ))}
          </div>
        </div>

        {/* Side-by-Side Comparison Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Part Card */}
          <div className="bg-[#0b1120] border border-[#1e293b] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-100">
                Part {padPartId(currentResult.part_id)} (Current)
              </span>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono border ${
                  currentResult.status === 'PASS'
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                    : 'bg-red-950/80 text-red-400 border-red-500/40'
                }`}
              >
                {currentResult.status}
              </span>
            </div>

            {/* Final image */}
            <div className="bg-[#080d1a] border border-[#1e293b] rounded p-2 flex justify-center">
              {currentResult.stages[6] && (
                <img
                  src={currentResult.stages[6].image}
                  alt="Final Result"
                  className="max-h-56 object-contain rounded"
                />
              )}
            </div>

            {/* Metrics */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#1e293b]">
                <span className="text-slate-400">Width (115–125 mm):</span>
                <span className={`font-mono font-semibold ${currentResult.acceptance.width_ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {currentResult.measurements.width_mm} mm
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1e293b]">
                <span className="text-slate-400">Height (115–125 mm):</span>
                <span className={`font-mono font-semibold ${currentResult.acceptance.height_ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {currentResult.measurements.height_mm} mm
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1e293b]">
                <span className="text-slate-400">Surface Defect (&lt; 2.0%):</span>
                <span className={`font-mono font-semibold ${currentResult.acceptance.defect_ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {currentResult.measurements.defect_percent}%
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1e293b]">
                <span className="text-slate-400">Pick Target:</span>
                <span className="font-mono text-cyan-300">
                  X: {currentResult.coordinates.pick_x_mm}, Y: {currentResult.coordinates.pick_y_mm}
                </span>
              </div>
              <div className="pt-1 text-[11px] text-slate-400 italic">
                {currentResult.failure_reason}
              </div>
            </div>
          </div>

          {/* Compared Part Card */}
          <div className="bg-[#0b1120] border border-[#1e293b] rounded-lg p-5 space-y-4">
            {loading ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center gap-2 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-xs">Inspecting Part {padPartId(comparePartId)}...</span>
              </div>
            ) : compareResult ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-100">
                    Part {padPartId(compareResult.part_id)} (Comparison)
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono border ${
                      compareResult.status === 'PASS'
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                        : 'bg-red-950/80 text-red-400 border-red-500/40'
                    }`}
                  >
                    {compareResult.status}
                  </span>
                </div>

                <div className="bg-[#080d1a] border border-[#1e293b] rounded p-2 flex justify-center">
                  {compareResult.stages[6] && (
                    <img
                      src={compareResult.stages[6].image}
                      alt="Final Result"
                      className="max-h-56 object-contain rounded"
                    />
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#1e293b]">
                    <span className="text-slate-400">Width (115–125 mm):</span>
                    <span className={`font-mono font-semibold ${compareResult.acceptance.width_ok ? 'text-emerald-400' : 'text-red-400'}`}>
                      {compareResult.measurements.width_mm} mm
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#1e293b]">
                    <span className="text-slate-400">Height (115–125 mm):</span>
                    <span className={`font-mono font-semibold ${compareResult.acceptance.height_ok ? 'text-emerald-400' : 'text-red-400'}`}>
                      {compareResult.measurements.height_mm} mm
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#1e293b]">
                    <span className="text-slate-400">Surface Defect (&lt; 2.0%):</span>
                    <span className={`font-mono font-semibold ${compareResult.acceptance.defect_ok ? 'text-emerald-400' : 'text-red-400'}`}>
                      {compareResult.measurements.defect_percent}%
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#1e293b]">
                    <span className="text-slate-400">Pick Target:</span>
                    <span className="font-mono text-cyan-300">
                      X: {compareResult.coordinates.pick_x_mm}, Y: {compareResult.coordinates.pick_y_mm}
                    </span>
                  </div>
                  <div className="pt-1 text-[11px] text-slate-400 italic">
                    {compareResult.failure_reason}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
