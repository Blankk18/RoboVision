import React from 'react';
import { X, ZoomIn, Info, Sliders } from 'lucide-react';
import type { PipelineStage } from '../types/api';
import { padPartId } from '../utils/format';

interface StageModalProps {
  stage: PipelineStage | null;
  onClose: () => void;
  partId?: number;
}

export const StageModal: React.FC<StageModalProps> = ({ stage, onClose, partId }) => {
  if (!stage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-[#0f172a] border border-[#1e293b] rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl shadow-cyan-950/20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 px-6 border-b border-[#1e293b] flex items-center justify-between bg-[#0b1120]">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-700/50 flex items-center justify-center text-xs font-bold text-cyan-400 font-mono">
              S{stage.id}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Stage {stage.id}: {stage.name}
                {partId && (
                  <span className="text-xs px-2 py-0.5 rounded bg-[#1e293b] text-slate-300 font-mono">
                    Part {padPartId(partId)}
                  </span>
                )}
              </h3>

              <p className="text-xs text-slate-400">{stage.algorithm}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1e293b] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Large Image View */}
          <div className="md:col-span-2 bg-[#080d1a] border border-[#1e293b] rounded-lg p-2 flex items-center justify-center min-h-[380px]">
            {stage.image ? (
              <img
                src={stage.image}
                alt={stage.name}
                className="max-h-[500px] w-auto object-contain rounded border border-[#1e293b]/50 shadow-inner"
              />
            ) : (
              <div className="text-slate-500 text-xs font-mono">No stage image generated</div>
            )}
          </div>

          {/* Technical Specs Panel */}
          <div className="space-y-4">
            <div className="bg-[#111c2e] border border-[#1e293b] rounded-lg p-4 space-y-2">
              <div className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Pipeline Role
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {stage.description}
              </p>
            </div>

            {stage.parameters && Object.keys(stage.parameters).length > 0 && (
              <div className="bg-[#111c2e] border border-[#1e293b] rounded-lg p-4 space-y-2">
                <div className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  Calibrated Parameters
                </div>
                <div className="space-y-1.5 pt-1">
                  {Object.entries(stage.parameters).map(([key, val]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between text-xs py-1 border-b border-[#1e293b]/60 last:border-0"
                    >
                      <span className="text-slate-400 font-mono capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-200 font-mono font-medium">
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
              <span className="text-slate-300 font-medium">Resolution:</span> 800 × 800 pixels
              <br />
              <span className="text-slate-300 font-medium">Calibration:</span> 5.0 pixels / mm
              <br />
              <span className="text-slate-300 font-medium">Origin:</span> (400, 400) px
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
