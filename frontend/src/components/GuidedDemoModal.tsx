import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Layers,
  BarChart3,
  Compass,
  Cpu,
  GraduationCap,
  ShieldAlert,
} from 'lucide-react';
import type { InspectionResult, PartMetadata, BatchStats } from '../types/api';
import { inspectPart, fetchLatestBatch, runBatchInspection } from '../api/client';
import { padPartId } from '../utils/format';
import { RobotArmCanvas } from './RobotArmCanvas';

interface GuidedDemoModalProps {
  onClose: () => void;
  onSelectPart: (id: number) => void;
  parts: PartMetadata[];
}

export const GuidedDemoModal: React.FC<GuidedDemoModalProps> = ({
  onClose,
  onSelectPart,
  parts,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [part3Result, setPart3Result] = useState<InspectionResult | null>(null);
  const [part7Result, setPart7Result] = useState<InspectionResult | null>(null);
  const [part2Result, setPart2Result] = useState<InspectionResult | null>(null);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Pre-fetch demonstration parts
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      inspectPart(3),
      inspectPart(7),
      inspectPart(2),
      fetchLatestBatch().then((b) => (b.has_run && b.stats ? b.stats : runBatchInspection().then((r) => r.stats))),
    ])
      .then(([p3, p7, p2, stats]) => {
        if (!isMounted) return;
        setPart3Result(p3);
        setPart7Result(p7);
        setPart2Result(p2);
        setBatchStats(stats);
      })
      .catch((err) => console.error('Error pre-loading demo data:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep]);

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => {
      if (currentStep < 5) {
        setCurrentStep((prev) => prev + 1);
      } else {
        setIsPlaying(false);
      }
    }, 9000); // 9 seconds per slide
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep]);

  const handleNext = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const steps = [
    { label: 'Overview', title: 'Stage 3 Engineering Assessment Overview' },
    { label: 'Part 3 (PASS)', title: 'Part 3 — Fully Compliant Inspection (PASS)' },
    { label: 'Part 7 (FAIL)', title: 'Part 7 — Dimensional & Surface Rejection (FAIL)' },
    { label: 'Part 2 (FAIL)', title: 'Part 2 — Defect-Only Surface Rejection (FAIL)' },
    { label: 'Batch Analytics', title: '10-Component Batch Quality Distribution' },
    { label: 'Engineering Summary', title: 'Algorithmic Summary & Simulation Boundaries' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#070b14]/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden animate-fadeIn">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400 font-bold text-xs">
            QMS
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
              ROBOVISION QMS 4.0
              <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-cyan-950/80 text-cyan-400 border border-cyan-800/40">
                GUIDED DEMO MODE
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Stage 3 College Assessment · Om Nathwani
            </div>
          </div>
        </div>

        {/* Step Navigation Tabs */}
        <div className="hidden lg:flex items-center gap-1.5 bg-[#0c121e] p-1 rounded-xl border border-[#1e293b]">
          {steps.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                currentStep === idx
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#111927]'
              }`}
            >
              {idx + 1}. {s.label}
            </button>
          ))}
        </div>

        {/* Playback & Exit Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#111927] hover:bg-[#182338] border border-[#1e293b] text-slate-200 transition-colors cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                <span>Pause Auto-Advance</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
                <span>Auto-Advance</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1e293b] border border-transparent hover:border-[#334155] transition-colors cursor-pointer"
            title="Exit Demonstration Mode (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Slide Content Area */}
      <div className="flex-1 my-4 flex items-center justify-center max-w-[1600px] mx-auto w-full overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
            <RotateCcw className="w-8 h-8 animate-spin text-cyan-400" />
            <span className="text-sm font-medium">Preparing demonstration datasets...</span>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col justify-center">
            {/* ──────── SLIDE 0: PROJECT OVERVIEW ──────── */}
            {currentStep === 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#0c121e] border border-[#1e293b] rounded-2xl p-8 max-w-5xl mx-auto shadow-2xl">
                <div className="lg:col-span-7 space-y-5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 text-xs font-mono">
                    <GraduationCap className="w-4 h-4" />
                    Shah & Anchor Kutchhi Engineering College
                  </div>

                  <h2 className="text-3xl font-extrabold text-slate-100 leading-tight">
                    Automated Object Detection & Quality Inspection using Robot Vision
                  </h2>

                  <p className="text-sm text-slate-300 leading-relaxed">
                    Welcome to the Stage 3 technical defense of ROBOVISION QMS 4.0 by Om Nathwani. This project presents an automated
                    in-line quality management workstation designed to replace subjective manual
                    inspection with a sub-millimeter calibrated vision pipeline and sorting robotics.
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-[#080d17] border border-[#1e293b]">
                      <div className="text-[11px] text-slate-400">Course & Dept</div>
                      <div className="text-xs font-bold text-slate-200">
                        ECCOR2MD201 · Electronics & Computer Science
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#080d17] border border-[#1e293b]">
                      <div className="text-[11px] text-slate-400">Project Developer</div>
                      <div className="text-xs font-bold text-cyan-400">
                        Om Nathwani
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs text-slate-300 space-y-1.5">
                    <div className="font-semibold text-cyan-300">Core Demonstration Objectives:</div>
                    <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                      <li>Deterministic 7-stage classical OpenCV metrology without black-box drift.</li>
                      <li>Rigid tolerance enforcement: 115–125 mm width/height & &lt; 2.0% defect density.</li>
                      <li>Direct coordinate mapping from pixel centroids to 3-DOF robotic sorting targets.</li>
                    </ul>
                  </div>
                </div>

                <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-4">
                  <div className="w-full p-5 rounded-xl bg-[#080d16] border border-[#1e293b] space-y-3">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-cyan-400" /> Inspection Rules
                    </div>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between py-1 border-b border-[#1e293b]/60">
                        <span className="text-slate-400 font-sans">Nominal Size:</span>
                        <span className="text-slate-200">120.0 × 120.0 mm</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#1e293b]/60">
                        <span className="text-slate-400 font-sans">Acceptance Window:</span>
                        <span className="text-emerald-400 font-bold">115.0 – 125.0 mm</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#1e293b]/60">
                        <span className="text-slate-400 font-sans">Max Defect Area:</span>
                        <span className="text-amber-400 font-bold">&lt; 2.000%</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400 font-sans">Optical Scale:</span>
                        <span className="text-cyan-400">5.0 px/mm (Calibrated)</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setCurrentStep(1)}
                    className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-cyan-900/40 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Begin Inspection Demonstration</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ──────── SLIDE 1: PART 3 (PASS) ──────── */}
            {currentStep === 1 && part3Result && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch max-w-6xl mx-auto w-full">
                {/* Inspection Canvas (Col 6) */}
                <div className="lg:col-span-6 bg-[#0c121e] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span className="text-xs font-bold text-slate-200 uppercase font-mono">
                        Specimen: Part 03 (Compliant Sample)
                      </span>
                    </div>
                    <span className="px-3 py-0.5 rounded text-xs font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                      PASS RESULT
                    </span>
                  </div>

                  <div className="relative bg-[#070b14] rounded-xl border border-[#1e293b] overflow-hidden flex items-center justify-center aspect-square max-h-[380px]">
                    <img
                      src={part3Result.stages[6].image}
                      alt="Part 3 Final Inspection"
                      className="w-full h-full object-contain"
                    />
                    {/* Reticle Overlay */}
                    <div className="absolute inset-0 border border-cyan-500/20 pointer-events-none" />
                  </div>

                  <div className="mt-3 p-3 rounded-lg bg-[#080d16] border border-[#1e293b] text-xs text-slate-300">
                    <span className="text-slate-400 font-semibold">Evaluation: </span>
                    {part3Result.failure_reason}
                  </div>
                </div>

                {/* Robot Simulation & Telemetry (Col 6) */}
                <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
                  <div className="h-[340px]">
                    <RobotArmCanvas
                      partId={3}
                      status="PASS"
                      coordinates={part3Result.coordinates}
                    />
                  </div>

                  {/* Telemetry Metrics Card */}
                  <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e293b] grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-lg bg-[#090d16]">
                      <div className="text-[10px] text-slate-400 uppercase">Width (115–125)</div>
                      <div className="text-lg font-bold font-mono text-emerald-400">
                        {part3Result.measurements.width_mm} mm
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#090d16]">
                      <div className="text-[10px] text-slate-400 uppercase">Height (115–125)</div>
                      <div className="text-lg font-bold font-mono text-emerald-400">
                        {part3Result.measurements.height_mm} mm
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#090d16]">
                      <div className="text-[10px] text-slate-400 uppercase">Defect (&lt;2.0%)</div>
                      <div className="text-lg font-bold font-mono text-emerald-400">
                        {part3Result.measurements.defect_percent}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ──────── SLIDE 2: PART 7 (FAIL - DUAL DEFECT) ──────── */}
            {currentStep === 2 && part7Result && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch max-w-6xl mx-auto w-full">
                {/* Inspection Canvas (Col 6) */}
                <div className="lg:col-span-6 bg-[#0c121e] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="text-xs font-bold text-slate-200 uppercase font-mono">
                        Specimen: Part 07 (Dual Out-of-Tolerance)
                      </span>
                    </div>
                    <span className="px-3 py-0.5 rounded text-xs font-mono font-bold bg-red-950 text-red-400 border border-red-500/40">
                      REJECT (DUAL FAIL)
                    </span>
                  </div>

                  <div className="relative bg-[#070b14] rounded-xl border border-[#1e293b] overflow-hidden flex items-center justify-center aspect-square max-h-[380px]">
                    <img
                      src={part7Result.stages[6].image}
                      alt="Part 7 Final Inspection"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="mt-3 p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-xs text-red-300">
                    <span className="font-semibold text-red-200">Rejection Reason: </span>
                    {part7Result.failure_reason}
                  </div>
                </div>

                {/* Robot Simulation & Telemetry (Col 6) */}
                <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
                  <div className="h-[340px]">
                    <RobotArmCanvas
                      partId={7}
                      status="FAIL"
                      coordinates={part7Result.coordinates}
                    />
                  </div>

                  {/* Telemetry Metrics Card */}
                  <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e293b] grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-lg bg-[#090d16] border border-red-500/30">
                      <div className="text-[10px] text-slate-400 uppercase">Width (115–125)</div>
                      <div className="text-lg font-bold font-mono text-red-400">
                        {part7Result.measurements.width_mm} mm
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#090d16] border border-red-500/30">
                      <div className="text-[10px] text-slate-400 uppercase">Height (115–125)</div>
                      <div className="text-lg font-bold font-mono text-red-400">
                        {part7Result.measurements.height_mm} mm
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#090d16] border border-red-500/30">
                      <div className="text-[10px] text-slate-400 uppercase">Defect (&lt;2.0%)</div>
                      <div className="text-lg font-bold font-mono text-red-400">
                        {part7Result.measurements.defect_percent}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ──────── SLIDE 3: PART 2 (FAIL - DEFECT ONLY) ──────── */}
            {currentStep === 3 && part2Result && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch max-w-6xl mx-auto w-full">
                {/* Inspection Canvas (Col 6) */}
                <div className="lg:col-span-6 bg-[#0c121e] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="text-xs font-bold text-slate-200 uppercase font-mono">
                        Specimen: Part 02 (Sub-Surface Anomaly)
                      </span>
                    </div>
                    <span className="px-3 py-0.5 rounded text-xs font-mono font-bold bg-amber-950 text-amber-400 border border-amber-500/40">
                      REJECT (DEFECT ONLY)
                    </span>
                  </div>

                  <div className="relative bg-[#070b14] rounded-xl border border-[#1e293b] overflow-hidden flex items-center justify-center aspect-square max-h-[380px]">
                    <img
                      src={part2Result.stages[6].image}
                      alt="Part 2 Final Inspection"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="mt-3 p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300">
                    <span className="font-semibold text-amber-200">Critical Observation: </span>
                    Dimensions (120.2 × 120.0 mm) pass perfectly, but optical intensity clustering
                    reveals a 2.34% surface defect rate exceeding the 2.0% threshold.
                  </div>
                </div>

                {/* Robot Simulation & Telemetry (Col 6) */}
                <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
                  <div className="h-[340px]">
                    <RobotArmCanvas
                      partId={2}
                      status="FAIL"
                      coordinates={part2Result.coordinates}
                    />
                  </div>

                  {/* Telemetry Metrics Card */}
                  <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e293b] grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-lg bg-[#090d16] border border-emerald-500/30">
                      <div className="text-[10px] text-slate-400 uppercase">Width (115–125)</div>
                      <div className="text-lg font-bold font-mono text-emerald-400">
                        {part2Result.measurements.width_mm} mm
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#090d16] border border-emerald-500/30">
                      <div className="text-[10px] text-slate-400 uppercase">Height (115–125)</div>
                      <div className="text-lg font-bold font-mono text-emerald-400">
                        {part2Result.measurements.height_mm} mm
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#090d16] border border-red-500/30">
                      <div className="text-[10px] text-slate-400 uppercase">Defect (&lt;2.0%)</div>
                      <div className="text-lg font-bold font-mono text-red-400">
                        {part2Result.measurements.defect_percent}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ──────── SLIDE 4: BATCH ANALYTICS ──────── */}
            {currentStep === 4 && batchStats && (
              <div className="bg-[#0c121e] border border-[#1e293b] rounded-2xl p-6 max-w-5xl mx-auto w-full space-y-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-cyan-400" />
                    <span className="text-base font-bold text-slate-100">
                      Batch Statistical Analysis (10 Synthetic Components)
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Execution Mode: Batch Synchronous
                  </div>
                </div>

                {/* 4 Summary Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-[#080d16] border border-[#1e293b] text-center">
                    <div className="text-xs text-slate-400">Pass Rate</div>
                    <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                      {batchStats.pass_rate_percent}%
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {batchStats.passed_components} / {batchStats.total_components} Passed
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080d16] border border-[#1e293b] text-center">
                    <div className="text-xs text-slate-400">Mean Width</div>
                    <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">
                      {batchStats.aggregates?.mean_width_mm ?? 120.2} mm
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Nominal: 120.0 mm</div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080d16] border border-[#1e293b] text-center">
                    <div className="text-xs text-slate-400">Mean Height</div>
                    <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">
                      {batchStats.aggregates?.mean_height_mm ?? 120.1} mm
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Nominal: 120.0 mm</div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080d16] border border-[#1e293b] text-center">
                    <div className="text-xs text-slate-400">Average Defect Area</div>
                    <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                      {batchStats.aggregates?.mean_defect_percent ?? 1.15}%
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Cutoff Limit: &lt; 2.0%</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#080d16] border border-[#1e293b] text-xs text-slate-300 space-y-2">
                  <div className="font-semibold text-slate-200">Statistical Batch Observations:</div>
                  <p className="text-slate-400 leading-relaxed">
                    Out of the 10-specimen test suite, 7 components (70%) adhere strictly to geometric tolerances
                    and defect limits. 3 components (30%) were flagged and rejected:
                    <span className="text-red-400 font-mono"> Part 02</span> (Defect: 2.34%),
                    <span className="text-red-400 font-mono"> Part 07</span> (Width: 128.0 mm, Defect: 4.85%),
                    and <span className="text-red-400 font-mono"> Part 10</span> (Width: 126.8 mm, Defect: 3.12%).
                  </p>
                </div>
              </div>
            )}

            {/* ──────── SLIDE 5: ENGINEERING SUMMARY & BOUNDARIES ──────── */}
            {currentStep === 5 && (
              <div className="bg-[#0c121e] border border-[#1e293b] rounded-2xl p-8 max-w-4xl mx-auto w-full space-y-6 shadow-2xl">
                <div className="flex items-center gap-3 border-b border-[#1e293b] pb-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">
                      Technical Summary & Academic Disclosures
                    </h3>
                    <div className="text-xs text-slate-400">Stage 3 Project Conclusion & Verification</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#080d16] border border-[#1e293b] space-y-2">
                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                      Computer Vision Achievements
                    </div>
                    <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                      <li>Deterministic sub-50ms execution per 800×800 image.</li>
                      <li>Adaptive Otsu binarization with morphological clean-up.</li>
                      <li>Two-sigma statistical surface defect segmentation.</li>
                      <li>Zero external cloud dependency — 100% on-premise execution.</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080d16] border border-[#1e293b] space-y-2">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Simulation Disclosure & Limits
                    </div>
                    <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                      <li>Calibrated synthetic images (5.0 px/mm optical assumption).</li>
                      <li>Arm motion is an illustrative 2-link planar kinematic simulation.</li>
                      <li>No direct hardware drivers or physical industrial arm connected.</li>
                      <li>Lighting assumed uniform without complex telecentric lens distortion.</li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-300">
                    <span className="font-bold text-emerald-300">Stage 3 Review Ready: </span>
                    All 58 automated unit & regression tests pass. Full analytical datasets, CSV/JSON
                    exports, and interactive inspection workbench are operational.
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setCurrentStep(0)}
                    className="px-4 py-2 rounded-lg bg-[#111927] hover:bg-[#182338] border border-[#1e293b] text-xs font-medium text-slate-300 transition-colors cursor-pointer"
                  >
                    Restart Demonstration
                  </button>
                  <button
                    onClick={onClose}
                    className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold transition-colors shadow-md shadow-cyan-900/40 cursor-pointer"
                  >
                    Open Inspection Workbench
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation & Controls */}
      <div className="flex items-center justify-between border-t border-[#1e293b] pt-3 shrink-0">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111927] hover:bg-[#182338] disabled:opacity-40 disabled:hover:bg-[#111927] border border-[#1e293b] text-xs font-medium text-slate-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous Step</span>
        </button>

        <div className="flex items-center gap-2">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentStep === idx
                  ? 'w-8 bg-cyan-400'
                  : currentStep > idx
                  ? 'w-3 bg-cyan-700'
                  : 'w-2 bg-slate-700'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={currentStep === 5}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 border border-transparent text-xs font-bold text-slate-950 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <span>Next Step</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
