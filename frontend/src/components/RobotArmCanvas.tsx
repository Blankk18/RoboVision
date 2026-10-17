import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Compass,
  Layers,
  Activity,
  Zap,
} from 'lucide-react';
import type { RobotCoordinates } from '../types/api';

interface RobotArmCanvasProps {
  partId: number;
  status: 'PASS' | 'FAIL';
  coordinates: RobotCoordinates;
  isInspecting?: boolean;
}

type SimulationPhase = 'idle' | 'approach' | 'grip' | 'transport' | 'release' | 'return';

export const RobotArmCanvas: React.FC<RobotArmCanvasProps> = ({
  partId,
  status,
  coordinates,
  isInspecting = false,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [phase, setPhase] = useState<SimulationPhase>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [gripperClosed, setGripperClosed] = useState<boolean>(false);
  const [carriedPart, setCarriedPart] = useState<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Canvas coordinate mapping
  // SVG ViewBox: 560 x 420
  // Base at center bottom: (280, 360)
  // Inspection area / Pick zone: around center (280, 240)
  // Left REJECT Bin (-350mm): around (80, 320)
  // Right PASS Bin (+350mm): around (480, 320)

  // Map mm coordinates to SVG canvas coordinates
  // Calibration: 1 mm -> 0.45 SVG px, X inverted or scaled, Y scaled
  const pickSvgX = 280 + coordinates.pick_x_mm * 0.9;
  const pickSvgY = 250 - coordinates.pick_y_mm * 0.9;

  const isPass = status === 'PASS';
  const binSvgX = isPass ? 470 : 90;
  const binSvgY = 320;
  const homeSvgX = 280;
  const homeSvgY = 150;

  // Kinematic link lengths
  const L1 = 135; // Shoulder to elbow
  const L2 = 120; // Elbow to wrist
  const basePos = { x: 280, y: 350 };

  // Calculate current target position based on phase and progress
  const getInterpolatedTarget = (p: number, currentPhase: SimulationPhase) => {
    switch (currentPhase) {
      case 'idle':
        return { x: homeSvgX, y: homeSvgY };
      case 'approach': {
        // Move from home to pick point
        const t = Math.min(1, Math.max(0, p));
        // Smooth ease-in-out
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        return {
          x: homeSvgX + (pickSvgX - homeSvgX) * ease,
          y: homeSvgY + (pickSvgY - homeSvgY) * ease,
        };
      }
      case 'grip':
        return { x: pickSvgX, y: pickSvgY };
      case 'transport': {
        // Move from pick to bin in an upward arched trajectory
        const t = Math.min(1, Math.max(0, p));
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        // Parabolic arc for realistic lifting
        const arcHeight = 70 * Math.sin(Math.PI * t);
        return {
          x: pickSvgX + (binSvgX - pickSvgX) * ease,
          y: pickSvgY + (binSvgY - pickSvgY) * ease - arcHeight,
        };
      }
      case 'release':
        return { x: binSvgX, y: binSvgY };
      case 'return': {
        // Move from bin back to home
        const t = Math.min(1, Math.max(0, p));
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const arcHeight = 40 * Math.sin(Math.PI * t);
        return {
          x: binSvgX + (homeSvgX - binSvgX) * ease,
          y: binSvgY + (homeSvgY - binSvgY) * ease - arcHeight,
        };
      }
      default:
        return { x: homeSvgX, y: homeSvgY };
    }
  };

  // Planar 2-Link Analytic Inverse Kinematics
  const solveIK = (targetX: number, targetY: number) => {
    const dx = targetX - basePos.x;
    const dy = targetY - basePos.y;
    const distSq = dx * dx + dy * dy;
    let dist = Math.sqrt(distSq);

    const maxReach = (L1 + L2) * 0.995;
    const minReach = Math.abs(L1 - L2) * 1.05;
    dist = Math.max(minReach, Math.min(maxReach, dist));

    const cosTheta2 = (dist * dist - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    const theta2 = Math.acos(Math.max(-1, Math.min(1, cosTheta2)));

    const alpha = Math.atan2(dy, dx);
    const beta = Math.atan2(L2 * Math.sin(theta2), L1 + L2 * Math.cos(theta2));
    const theta1 = alpha - beta;

    const elbowX = basePos.x + L1 * Math.cos(theta1);
    const elbowY = basePos.y + L1 * Math.sin(theta1);
    const wristX = elbowX + L2 * Math.cos(theta1 + theta2);
    const wristY = elbowY + L2 * Math.sin(theta1 + theta2);

    return {
      elbow: { x: elbowX, y: elbowY },
      wrist: { x: wristX, y: wristY },
      angles: {
        shoulderDeg: (theta1 * 180) / Math.PI,
        elbowDeg: (theta2 * 180) / Math.PI,
      },
    };
  };

  // Run animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    let phaseStartTime = performance.now();
    let currentPhase: SimulationPhase = 'approach';
    setPhase(currentPhase);

    // Durations for each phase in ms (scaled by speed)
    const phaseDurations: Record<SimulationPhase, number> = {
      idle: 800 / speed,
      approach: 1400 / speed,
      grip: 600 / speed,
      transport: 2000 / speed,
      release: 600 / speed,
      return: 1400 / speed,
    };

    const nextPhaseMap: Record<SimulationPhase, SimulationPhase> = {
      idle: 'approach',
      approach: 'grip',
      grip: 'transport',
      transport: 'release',
      release: 'return',
      return: 'idle',
    };

    const tick = (now: number) => {
      const elapsed = now - phaseStartTime;
      const duration = phaseDurations[currentPhase];
      const p = Math.min(1, elapsed / duration);

      setProgress(p);

      if (currentPhase === 'grip' && p > 0.5) {
        setGripperClosed(true);
        setCarriedPart(true);
      } else if (currentPhase === 'release' && p > 0.5) {
        setGripperClosed(false);
        setCarriedPart(false);
      }

      if (elapsed >= duration) {
        currentPhase = nextPhaseMap[currentPhase];
        setPhase(currentPhase);
        phaseStartTime = now;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, speed, partId, status]);

  const currentTarget = getInterpolatedTarget(progress, phase);
  const kinematics = solveIK(currentTarget.x, currentTarget.y);

  const handleReset = () => {
    setPhase('approach');
    setProgress(0);
    setGripperClosed(false);
    setCarriedPart(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0c121e] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
      {/* Simulation Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#090d16] border-b border-[#1e293b]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-200 tracking-wide uppercase">
            Articulated Arm Simulation
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-950/80 text-orange-400 border border-orange-500/40 font-mono">
            3-DOF Kinematics
          </span>
        </div>

        {/* Phase Pill */}
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#111927] border border-[#1e293b] text-slate-300">
            Phase:{' '}
            <span className="text-cyan-400 font-semibold uppercase">
              {phase === 'grip'
                ? 'Grip Part'
                : phase === 'transport'
                ? isPass
                  ? 'Sort → PASS'
                  : 'Sort → REJECT'
                : phase}
            </span>
          </div>
        </div>
      </div>

      {/* SVG Interactive Workspace */}
      <div className="relative flex-1 bg-[#070b14] overflow-hidden flex items-center justify-center p-2">
        <svg
          viewBox="0 0 560 400"
          className="w-full h-full max-h-[380px] select-none"
          style={{ filter: 'drop-shadow(0 0 10px rgba(0, 240, 255, 0.05))' }}
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#131e33" strokeWidth="0.8" />
            </pattern>
            {/* Link Gradient (Industrial Orange) */}
            <linearGradient id="linkOrange" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#c2410c" />
            </linearGradient>
            {/* Cyan Glow for Pick Zone */}
            <radialGradient id="cyanGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(6, 182, 212, 0.35)" />
              <stop offset="100%" stopColor="rgba(6, 182, 212, 0)" />
            </radialGradient>
            {/* Target Bin Glows */}
            <radialGradient id="passGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.3)" />
              <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
            </radialGradient>
            <radialGradient id="failGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(239, 68, 68, 0.3)" />
              <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
            </radialGradient>
          </defs>

          {/* Background Technical Grid */}
          <rect width="560" height="400" fill="url(#grid)" />

          {/* Coordinate Reference Axes */}
          <line x1="280" y1="20" x2="280" y2="380" stroke="#1e293b" strokeDasharray="3,3" strokeWidth="1" />
          <line x1="20" y1="250" x2="540" y2="250" stroke="#1e293b" strokeDasharray="3,3" strokeWidth="1" />
          <text x="285" y="32" fill="#475569" fontSize="9" fontFamily="monospace">
            +Y (mm)
          </text>
          <text x="520" y="245" fill="#475569" fontSize="9" fontFamily="monospace">
            +X (mm)
          </text>

          {/* PASS BIN (+350, -200, 10 mm) */}
          <g transform="translate(470, 320)">
            <ellipse cx="0" cy="0" rx="42" ry="22" fill="url(#passGlow)" />
            <rect
              x="-35"
              y="-15"
              width="70"
              height="30"
              rx="6"
              fill="#062e20"
              stroke="#10b981"
              strokeWidth={isPass ? 2 : 1}
              strokeDasharray={isPass ? 'none' : '3,3'}
            />
            <text x="0" y="-1" fill="#34d399" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              PASS BIN
            </text>
            <text x="0" y="11" fill="#6ee7b7" fontSize="7.5" textAnchor="middle" fontFamily="monospace">
              (+350, -200) mm
            </text>
          </g>

          {/* REJECT BIN (-350, -200, 10 mm) */}
          <g transform="translate(90, 320)">
            <ellipse cx="0" cy="0" rx="42" ry="22" fill="url(#failGlow)" />
            <rect
              x="-35"
              y="-15"
              width="70"
              height="30"
              rx="6"
              fill="#2e0d11"
              stroke="#ef4444"
              strokeWidth={!isPass ? 2 : 1}
              strokeDasharray={!isPass ? 'none' : '3,3'}
            />
            <text x="0" y="-1" fill="#f87171" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              REJECT BIN
            </text>
            <text x="0" y="11" fill="#fca5a5" fontSize="7.5" textAnchor="middle" fontFamily="monospace">
              (-350, -200) mm
            </text>
          </g>

          {/* Inspection Worktable / Component Pick Zone */}
          <g transform={`translate(${pickSvgX}, ${pickSvgY})`}>
            <circle cx="0" cy="0" r="28" fill="url(#cyanGlow)" />
            <rect
              x="-20"
              y="-20"
              width="40"
              height="40"
              rx="3"
              fill="#0f172a"
              stroke="#06b6d4"
              strokeWidth="1.5"
              strokeDasharray="4,2"
            />
            {/* Pick Point Reticle */}
            <circle cx="0" cy="0" r="3" fill="#22d3ee" />
            <line x1="-8" y1="0" x2="8" y2="0" stroke="#22d3ee" strokeWidth="1" />
            <line x1="0" y1="-8" x2="0" y2="8" stroke="#22d3ee" strokeWidth="1" />
            <text x="0" y="30" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              PICK: ({coordinates.pick_x_mm}, {coordinates.pick_y_mm})
            </text>
          </g>

          {/* Trajectory Guide Arc */}
          <path
            d={`M ${pickSvgX} ${pickSvgY} Q ${(pickSvgX + binSvgX) / 2} ${Math.min(pickSvgY, binSvgY) - 60} ${binSvgX} ${binSvgY}`}
            fill="none"
            stroke={isPass ? '#10b981' : '#ef4444'}
            strokeWidth="1.5"
            strokeDasharray="4,4"
            opacity="0.45"
          />

          {/* Robot Base Pedestal */}
          <g transform="translate(280, 360)">
            {/* Heavy Base Plate */}
            <path d="M -45 15 L 45 15 L 35 -10 L -35 -10 Z" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
            {/* Turret Swivel */}
            <rect x="-24" y="-22" width="48" height="15" rx="3" fill="#0f172a" stroke="#f97316" strokeWidth="1.5" />
            <circle cx="0" cy="-10" r="6" fill="#f97316" />
          </g>

          {/* ARM KINEMATIC LINKS & JOINTS */}
          {/* Link 1: Shoulder -> Elbow */}
          <line
            x1={basePos.x}
            y1={basePos.y}
            x2={kinematics.elbow.x}
            y2={kinematics.elbow.y}
            stroke="url(#linkOrange)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Hydraulic Ram on Link 1 */}
          <line
            x1={basePos.x + 8}
            y1={basePos.y - 12}
            x2={kinematics.elbow.x * 0.75 + basePos.x * 0.25}
            y2={kinematics.elbow.y * 0.75 + basePos.y * 0.25}
            stroke="#94a3b8"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Link 2: Elbow -> Wrist */}
          <line
            x1={kinematics.elbow.x}
            y1={kinematics.elbow.y}
            x2={kinematics.wrist.x}
            y2={kinematics.wrist.y}
            stroke="url(#linkOrange)"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Shoulder Pivot Hub */}
          <circle cx={basePos.x} cy={basePos.y} r="10" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2.5" />
          <circle cx={basePos.x} cy={basePos.y} r="4" fill="#f97316" />

          {/* Elbow Joint Hub */}
          <circle
            cx={kinematics.elbow.x}
            cy={kinematics.elbow.y}
            r="8"
            fill="#0f172a"
            stroke="#cbd5e1"
            strokeWidth="2"
          />
          <circle cx={kinematics.elbow.x} cy={kinematics.elbow.y} r="3" fill="#f97316" />

          {/* Wrist Joint Hub */}
          <circle
            cx={kinematics.wrist.x}
            cy={kinematics.wrist.y}
            r="6"
            fill="#0f172a"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />

          {/* Gripper / End-Effector */}
          <g transform={`translate(${kinematics.wrist.x}, ${kinematics.wrist.y})`}>
            {/* Gripper Tool Flange */}
            <circle cx="0" cy="0" r="4" fill="#38bdf8" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" strokeWidth="3" />
            <line x1="-8" y1="8" x2="8" y2="8" stroke="#cbd5e1" strokeWidth="2.5" />

            {/* Gripper Fingers */}
            <line
              x1={gripperClosed ? -4 : -8}
              y1="8"
              x2={gripperClosed ? -3 : -7}
              y2="18"
              stroke="#f97316"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1={gripperClosed ? 4 : 8}
              y1="8"
              x2={gripperClosed ? 3 : 7}
              y2="18"
              stroke="#f97316"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Carried Part Preview when in transit */}
            {carriedPart && (
              <rect
                x="-10"
                y="14"
                width="20"
                height="10"
                rx="2"
                fill={isPass ? '#059669' : '#dc2626'}
                stroke={isPass ? '#34d399' : '#f87171'}
                strokeWidth="1"
              />
            )}
          </g>

          {/* Academic Transparency Label */}
          <text x="280" y="392" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">
            GEOMETRIC 2-LINK PLANAR SIMULATION · ILLUSTRATIVE SORTING WORKSPACE
          </text>
        </svg>

        {/* Live Kinematic HUD Overlay */}
        <div className="absolute top-3 left-3 bg-[#0a0f1a]/85 backdrop-blur border border-[#1e293b] rounded-lg p-2 text-[10px] font-mono space-y-1">
          <div className="text-slate-400 flex items-center gap-1 font-sans font-semibold">
            <Compass className="w-3 h-3 text-cyan-400" />
            Kinematic Telemetry
          </div>
          <div className="flex justify-between gap-3 text-slate-300">
            <span>θ1 (Shoulder):</span>
            <span className="text-orange-400 font-bold">{kinematics.angles.shoulderDeg.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between gap-3 text-slate-300">
            <span>θ2 (Elbow):</span>
            <span className="text-orange-400 font-bold">{kinematics.angles.elbowDeg.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between gap-3 text-slate-300">
            <span>Target Z:</span>
            <span className="text-cyan-400 font-bold">{coordinates.pick_z_mm.toFixed(1)} mm</span>
          </div>
        </div>

        {/* Destination Target Indicator */}
        <div className="absolute top-3 right-3 bg-[#0a0f1a]/85 backdrop-blur border border-[#1e293b] rounded-lg p-2 text-[10px] font-mono space-y-1">
          <div className="text-slate-400 flex items-center gap-1 font-sans font-semibold">
            <Activity className="w-3 h-3 text-emerald-400" />
            Sort Destination
          </div>
          <div className="flex items-center gap-1.5">
            {isPass ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className={`font-bold ${isPass ? 'text-emerald-400' : 'text-red-400'}`}>
              {coordinates.bin_type} BIN
            </span>
          </div>
          <div className="text-slate-400 text-[9px]">
            Coords: ({coordinates.target_bin[0]}, {coordinates.target_bin[1]}, {coordinates.target_bin[2]}) mm
          </div>
        </div>
      </div>

      {/* Simulation Controls Bar */}
      <div className="px-4 py-2 bg-[#090d16] border-t border-[#1e293b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#111927] hover:bg-[#182338] border border-[#1e293b] text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3 h-3 text-amber-400" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-emerald-400 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            className="p-1 rounded bg-[#111927] hover:bg-[#182338] border border-[#1e293b] text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Reset Arm to Home Position"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
          <span className="mr-1">Speed:</span>
          {[0.5, 1, 2].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                speed === s
                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/40'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
