import React from 'react';
import {
  GraduationCap,
  Users,
  Code2,
  Cpu,
  Layers,
  ShieldAlert,
  BookOpen,
  Award,
  Binary,
  CheckCircle2,
} from 'lucide-react';

export const AboutProject: React.FC = () => {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Title & Institutional Banner */}
      <div className="p-6 md:p-8 rounded-2xl bg-[#0c121e] border border-[#1e293b] space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-xs font-mono text-cyan-400">
          <GraduationCap className="w-4 h-4" />
          Academic Micro-Project Documentation
        </div>

        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-100 tracking-tight">
            ROBOT VISION: Automated Object Detection & Quality Inspection
          </h2>
          <p className="text-sm text-cyan-400 font-medium mt-1">
            Stage 3 Comprehensive Review · Essentials of Computer Science for Robotics (ECCOR2MD201)
          </p>
        </div>

        <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b] space-y-1.5">
            <div className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">
              Institution & Department
            </div>
            <div className="text-sm font-bold text-slate-100">
              Shah & Anchor Kutchhi Engineering College
            </div>
            <div className="text-slate-400">
              Department of Electronics & Computer Science
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b] space-y-1.5">
            <div className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">
              Project Developer
            </div>
            <div className="text-slate-100 font-bold text-sm flex items-center justify-between">
              <span>Om Nathwani</span>
              <span className="font-mono text-cyan-400 text-xs">Roll No. 34</span>
            </div>
            <div className="text-slate-400 text-[11px]">
              Essentials of Computer Science for Robotics (ECCOR2MD201)
            </div>
          </div>
        </div>
      </div>

      {/* Software Simulation Notice */}
      <div className="p-5 rounded-xl bg-amber-950/20 border border-amber-600/30 text-xs text-amber-200/90 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-amber-300">
            SIMULATION STATUS & BOUNDARIES
          </div>
          <p className="leading-relaxed text-amber-200/80">
            This application operates entirely on mathematically calibrated synthetic test images representing precision aluminium workpieces. All image processing, dimensional extraction, and pick coordinates are executed in software using classical computer vision. No physical camera, conveyor belt, or industrial robot manipulator is attached.
          </p>
        </div>
      </div>

      {/* Mathematical Formulations & Derivations */}
      <div className="p-6 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Binary className="w-4 h-4 text-cyan-400" />
          Mathematical & Algorithmic Formulations
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Spatial Calibration */}
          <div className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b] space-y-2">
            <div className="font-semibold text-slate-200">1. Spatial Calibration Scale</div>
            <p className="text-slate-400 leading-relaxed">
              Converts pixel dimensions into physical millimeters using calibrated scale factor:
            </p>
            <div className="p-2.5 rounded bg-[#070b14] border border-[#1e293b] font-mono text-cyan-300 text-[11px]">
              Width_{`{mm}`} = w_{`{px}`} / 5.0, \quad Height_{`{mm}`} = h_{`{px}`} / 5.0
            </div>
          </div>

          {/* Centroid Moments */}
          <div className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b] space-y-2">
            <div className="font-semibold text-slate-200">2. Spatial Moments & Centroid</div>
            <p className="text-slate-400 leading-relaxed">
              Component center of gravity computed from raw contour moments:
            </p>
            <div className="p-2.5 rounded bg-[#070b14] border border-[#1e293b] font-mono text-cyan-300 text-[11px]">
              c_x = m_{`{10}`} / m_{`{00}`}, \quad c_y = m_{`{01}`} / m_{`{00}`}
            </div>
          </div>

          {/* Otsu Binarization */}
          <div className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b] space-y-2">
            <div className="font-semibold text-slate-200">3. Otsu Binarization Threshold</div>
            <p className="text-slate-400 leading-relaxed">
              Determines optimal separation by maximizing between-class variance:
            </p>
            <div className="p-2.5 rounded bg-[#070b14] border border-[#1e293b] font-mono text-cyan-300 text-[11px]">
              \sigma_B^2(t) = \omega_0(t)\omega_1(t)[\mu_0(t) - \mu_1(t)]^2
            </div>
          </div>

          {/* Statistical Defect Cutoff */}
          <div className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b] space-y-2">
            <div className="font-semibold text-slate-200">4. 2-Sigma Defect Threshold</div>
            <p className="text-slate-400 leading-relaxed">
              Isolates anomalous surface pits and scratches below two standard deviations:
            </p>
            <div className="p-2.5 rounded bg-[#070b14] border border-[#1e293b] font-mono text-cyan-300 text-[11px]">
              I_{`{defect}`}(x, y) &lt; (\mu_{`{surface}`} - 2.0 \times \sigma_{`{surface}`})
            </div>
          </div>
        </div>
      </div>

      {/* Technology Stack & Architecture */}
      <div className="p-6 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Code2 className="w-4 h-4 text-cyan-400" />
          Full-Stack Technology Architecture
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b] space-y-2">
            <div className="font-semibold text-cyan-400">Backend Engineering</div>
            <ul className="space-y-1 text-slate-300">
              <li>• <span className="font-medium text-white">Python 3.14</span>: Core computation environment</li>
              <li>• <span className="font-medium text-white">FastAPI</span>: High-performance async REST API</li>
              <li>• <span className="font-medium text-white">OpenCV (cv2)</span>: Classical computer vision algorithms</li>
              <li>• <span className="font-medium text-white">NumPy</span>: Array processing and statistical derivations</li>
              <li>• <span className="font-medium text-white">Matplotlib</span>: Static chart dashboard generation</li>
              <li>• <span className="font-medium text-white">PyTest</span>: Automated regression testing suite (44+ tests)</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b] space-y-2">
            <div className="font-semibold text-cyan-400">Frontend Engineering</div>
            <ul className="space-y-1 text-slate-300">
              <li>• <span className="font-medium text-white">React 19 + TypeScript</span>: Type-safe modular user interface</li>
              <li>• <span className="font-medium text-white">Vite 8</span>: Lightning-fast build tooling and HMR</li>
              <li>• <span className="font-medium text-white">Tailwind CSS v4</span>: Industrial design system styling</li>
              <li>• <span className="font-medium text-white">Recharts</span>: Interactive analytical charts & scatter plots</li>
              <li>• <span className="font-medium text-white">Lucide Icons</span>: Clean engineering iconography</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
