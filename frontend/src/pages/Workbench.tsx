import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ZoomIn,
  CheckCircle2,
  XCircle,
  Maximize2,
  Sliders,
  Scale,
  Compass,
  AlertOctagon,
  Layers,
  ArrowRightLeft,
  Scan,
  Activity,
  Zap,
} from 'lucide-react';
import type {
  InspectionResult,
  PartMetadata,
  PipelineStage,
} from '../types/api';
import { inspectPart } from '../api/client';
import { StageModal } from '../components/StageModal';
import { PartComparisonModal } from '../components/PartComparisonModal';
import { RobotArmCanvas } from '../components/RobotArmCanvas';
import { padPartId } from '../utils/format';

interface WorkbenchProps {
  selectedPartId: number;
  onSelectPart: (id: number) => void;
  parts: PartMetadata[];
  onTogglePresentation: () => void;
  onStartDemo?: () => void;
}

export const Workbench: React.FC<WorkbenchProps> = ({
  selectedPartId,
  onSelectPart,
  parts,
  onTogglePresentation,
  onStartDemo,
}) => {
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStageModal, setActiveStageModal] = useState<PipelineStage | null>(null);
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [selectedStageIdx, setSelectedStageIdx] = useState<number>(6); // Default: Stage 7 (index 6)
  const [isScanningActive, setIsScanningActive] = useState<boolean>(true);

  // Load inspection results whenever selectedPartId changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setIsScanningActive(true);

    inspectPart(selectedPartId)
      .then((data) => {
        if (isMounted) {
          setResult(data);
          // Keep scan beam active briefly for realistic feel, then stop
          const scanTimer = setTimeout(() => {
            if (isMounted) setIsScanningActive(false);
          }, 2400);
          return () => clearTimeout(scanTimer);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to inspect component.');
          setResult(null);
          setIsScanningActive(false);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPartId]);

  const handlePrev = () => {
    const prev = selectedPartId <= 1 ? 10 : selectedPartId - 1;
    onSelectPart(prev);
  };

  const handleNext = () => {
    const next = selectedPartId >= 10 ? 1 : selectedPartId + 1;
    onSelectPart(next);
  };

  const currentPartMeta = parts.find((p) => p.part_id === selectedPartId);
  const activeStage = result?.stages[selectedStageIdx] || result?.stages[6];

  return (
    <div className="p-4 lg:p-5 max-w-[1720px] mx-auto space-y-4 select-none">
      {/* ── TOP CONTROLS & PART SELECTOR BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#0c121e] border border-[#1e293b]">
        {/* Component Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
            Components:
          </span>
          {parts.map((p) => {
            const isSelected = p.part_id === selectedPartId;
            return (
              <button
                key={p.part_id}
                onClick={() => onSelectPart(p.part_id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'bg-[#111927] text-slate-400 hover:text-slate-200 hover:bg-[#182338] border border-[#1e293b]'
                }`}
              >
                P{padPartId(p.part_id)}
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onStartDemo && (
            <button
              onClick={onStartDemo}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-900/40 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>START DEMO</span>
            </button>
          )}

          <button
            onClick={handlePrev}
            className="p-1.5 rounded-lg bg-[#111927] hover:bg-[#182338] border border-[#1e293b] text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Previous Component (Left Arrow)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-lg bg-[#111927] hover:bg-[#182338] border border-[#1e293b] text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Next Component (Right Arrow)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setIsScanningActive(true);
              onSelectPart(selectedPartId);
            }}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#111927] hover:bg-[#182338] border border-[#1e293b] text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Re-run Computer Vision Pipeline"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Re-Inspect</span>
          </button>

          <button
            onClick={() => setIsScanningActive(!isScanningActive)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer border ${
              isScanningActive
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
                : 'bg-[#111927] text-slate-400 border-[#1e293b] hover:text-slate-200'
            }`}
            title="Toggle Laser Scan Overlay"
          >
            <Scan className="w-3.5 h-3.5 text-cyan-400" />
            <span>Scan Beam</span>
          </button>

          {result && (
            <button
              onClick={() => setShowComparison(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#131c2e] hover:bg-[#1b2840] border border-cyan-800/40 text-cyan-300 transition-colors cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Compare</span>
            </button>
          )}

          <button
            onClick={onTogglePresentation}
            className="p-1.5 rounded-lg bg-[#111927] hover:bg-[#182338] border border-[#1e293b] text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Fullscreen Presentation Mode"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── MAIN WORKSTATION: TWO PRIMARY CANVASES (LEFT: INSPECTION | RIGHT: ROBOT ARM) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* ── LEFT CANVAS: Computer Vision Metrology & Scanning (Col 6) ── */}
        <div className="lg:col-span-6 flex flex-col bg-[#0c121e] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#090d16] border-b border-[#1e293b]">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                Optical Metrology Canvas
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-700/40 font-mono">
                800×800 px · 5.0 px/mm
              </span>
            </div>

            {result && (
              <div
                className={`px-3 py-0.5 rounded text-xs font-mono font-bold flex items-center gap-1 border ${
                  result.status === 'PASS'
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                    : 'bg-red-950/80 text-red-400 border-red-500/40'
                }`}
              >
                {result.status === 'PASS' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>{result.status}</span>
              </div>
            )}
          </div>

          {/* Canvas Area with Laser Scan Beam Overlay */}
          <div className="relative flex-1 bg-[#070b14] overflow-hidden flex items-center justify-center p-2 min-h-[360px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                <RotateCcw className="w-8 h-8 animate-spin text-cyan-400" />
                <span className="text-xs font-mono">Running OpenCV 7-Stage Pipeline...</span>
              </div>
            ) : error ? (
              <div className="p-6 bg-red-950/20 border border-red-500/40 rounded-xl text-center space-y-2">
                <AlertOctagon className="w-8 h-8 text-red-400 mx-auto" />
                <div className="text-xs font-semibold text-red-400">Pipeline Failed</div>
                <div className="text-[11px] text-slate-400">{error}</div>
              </div>
            ) : activeStage ? (
              <div className="relative w-full h-full max-h-[380px] flex items-center justify-center group">
                <img
                  src={activeStage.image}
                  alt={activeStage.name}
                  className="max-h-[380px] w-auto object-contain rounded border border-[#1e293b]"
                />

                {/* Laser Scanning Beam Animation Overlay */}
                {isScanningActive && (
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#00f0ff,0_0_30px_#00f0ff] animate-laser-scan pointer-events-none" />
                )}

                {/* Reticle Corner Crosshairs */}
                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-500/60 pointer-events-none" />
                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-500/60 pointer-events-none" />
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-500/60 pointer-events-none" />
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-500/60 pointer-events-none" />

                {/* Enlarge Button */}
                <button
                  onClick={() => setActiveStageModal(activeStage)}
                  className="absolute bottom-3 right-3 px-2 py-1 rounded bg-[#090d16]/85 hover:bg-[#111927] border border-[#1e293b] text-cyan-400 text-[10px] font-mono flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity cursor-pointer shadow-lg"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Enlarge Stage</span>
                </button>

                {/* Current Stage Label Overlay */}
                <div className="absolute top-3 left-3 px-2 py-1 rounded bg-[#090d16]/85 border border-[#1e293b] text-[10px] font-mono text-slate-300">
                  <span className="text-cyan-400 font-bold">S{activeStage.id}:</span> {activeStage.name}
                </div>
              </div>
            ) : null}
          </div>

          {/* Interactive Pipeline Stage Switcher Bar */}
          {result && (
            <div className="px-3 py-2 bg-[#090d16] border-t border-[#1e293b] flex items-center justify-between gap-1 overflow-x-auto">
              <span className="text-[10px] font-mono text-slate-500 uppercase mr-1 hidden sm:inline">
                Stages:
              </span>
              <div className="flex items-center gap-1 w-full justify-between">
                {result.stages.map((stg, idx) => {
                  const isCur = selectedStageIdx === idx;
                  return (
                    <button
                      key={stg.id}
                      onClick={() => setSelectedStageIdx(idx)}
                      className={`flex-1 py-1 px-1.5 rounded text-[10px] font-mono transition-colors text-center cursor-pointer truncate ${
                        isCur
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30'
                          : 'bg-[#111927] text-slate-400 hover:text-slate-200 hover:bg-[#16233b] border border-[#1e293b]'
                      }`}
                      title={stg.name}
                    >
                      S{stg.id}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT CANVAS: Articulated Robot Arm Simulation (Col 6) ── */}
        <div className="lg:col-span-6 flex flex-col">
          {result ? (
            <RobotArmCanvas
              partId={selectedPartId}
              status={result.status}
              coordinates={result.coordinates}
              isInspecting={loading || isScanningActive}
            />
          ) : (
            <div className="h-full bg-[#0c121e] border border-[#1e293b] rounded-xl flex items-center justify-center text-slate-500 text-xs font-mono">
              Waiting for inspection coordinates...
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM HIGH-DENSITY RESULTS STRIP (FITS 1920x1080 VIEWPORT) ── */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-3.5 rounded-xl bg-[#0c121e] border border-[#1e293b]">
          {/* 1. Measured Width */}
          <div className="p-2.5 rounded-lg bg-[#090d16] border border-[#1e293b] space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center justify-between">
              <span>Width (115–125 mm)</span>
              <span
                className={`px-1 rounded text-[9px] font-mono font-bold ${
                  result.acceptance.width_ok
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-950 text-red-400 border border-red-500/30'
                }`}
              >
                {result.acceptance.width_ok ? 'PASS' : 'FAIL'}
              </span>
            </div>
            <div className="text-base font-bold font-mono text-slate-100">
              {result.measurements.width_mm}{' '}
              <span className="text-xs font-normal text-slate-400">mm</span>
            </div>
            <div className="text-[9px] text-slate-500 font-mono">
              Raw: {(result.measurements.width_mm * 5).toFixed(0)} px (5 px/mm)
            </div>
          </div>

          {/* 2. Measured Height */}
          <div className="p-2.5 rounded-lg bg-[#090d16] border border-[#1e293b] space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center justify-between">
              <span>Height (115–125 mm)</span>
              <span
                className={`px-1 rounded text-[9px] font-mono font-bold ${
                  result.acceptance.height_ok
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-950 text-red-400 border border-red-500/30'
                }`}
              >
                {result.acceptance.height_ok ? 'PASS' : 'FAIL'}
              </span>
            </div>
            <div className="text-base font-bold font-mono text-slate-100">
              {result.measurements.height_mm}{' '}
              <span className="text-xs font-normal text-slate-400">mm</span>
            </div>
            <div className="text-[9px] text-slate-500 font-mono">
              Raw: {(result.measurements.height_mm * 5).toFixed(0)} px (5 px/mm)
            </div>
          </div>

          {/* 3. Surface Defect % */}
          <div className="p-2.5 rounded-lg bg-[#090d16] border border-[#1e293b] space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center justify-between">
              <span>Defect Area (&lt;2.0%)</span>
              <span
                className={`px-1 rounded text-[9px] font-mono font-bold ${
                  result.acceptance.defect_ok
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-950 text-red-400 border border-red-500/30'
                }`}
              >
                {result.acceptance.defect_ok ? 'PASS' : 'FAIL'}
              </span>
            </div>
            <div className="text-base font-bold font-mono text-slate-100">
              {result.measurements.defect_percent}%
            </div>
            <div className="text-[9px] text-slate-500 font-mono truncate">
              {result.measurements.defective_pixel_count} / {result.measurements.total_surface_pixels} px
            </div>
          </div>

          {/* 4. Centroid & Origin */}
          <div className="p-2.5 rounded-lg bg-[#090d16] border border-[#1e293b] space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-sans">
              Image Centroid (px)
            </div>
            <div className="text-base font-bold font-mono text-cyan-300">
              ({result.coordinates.centroid_px[0]}, {result.coordinates.centroid_px[1]})
            </div>
            <div className="text-[9px] text-slate-500 font-mono">
              Origin: (400, 400) px
            </div>
          </div>

          {/* 5. Robot Pick Coordinates */}
          <div className="p-2.5 rounded-lg bg-[#090d16] border border-[#1e293b] space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-sans">
              Pick Coords (X, Y, Z)
            </div>
            <div className="text-base font-bold font-mono text-orange-400 truncate">
              ({result.coordinates.pick_x_mm}, {result.coordinates.pick_y_mm}, {result.coordinates.pick_z_mm})
            </div>
            <div className="text-[9px] text-slate-500 font-mono">
              Units: Millimeters
            </div>
          </div>

          {/* 6. Sorting Destination & Decision */}
          <div className="p-2.5 rounded-lg bg-[#090d16] border border-[#1e293b] space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-sans">
              Sorting Destination
            </div>
            <div
              className={`text-base font-bold font-mono flex items-center gap-1 ${
                result.status === 'PASS' ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {result.status === 'PASS' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span>{result.coordinates.bin_type} BIN</span>
            </div>
            <div className="text-[9px] text-slate-400 truncate" title={result.failure_reason}>
              {result.failure_reason}
            </div>
          </div>
        </div>
      )}

      {/* Stage Zoom Modal */}
      {activeStageModal && (
        <StageModal
          stage={activeStageModal}
          partId={selectedPartId}
          onClose={() => setActiveStageModal(null)}
        />
      )}

      {/* Part Comparison Modal */}
      {showComparison && result && (
        <PartComparisonModal
          currentResult={result}
          parts={parts}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
};
