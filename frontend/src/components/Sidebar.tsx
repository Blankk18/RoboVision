import React from 'react';
import {
  LayoutDashboard,
  Eye,
  BarChart3,
  Network,
  CheckCircle2,
  Info,
  Cpu,
  Layers,
} from 'lucide-react';

export type PageId =
  | 'overview'
  | 'workbench'
  | 'batch'
  | 'pipeline'
  | 'validation'
  | 'about';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  batchPassRate?: number | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  batchPassRate,
}) => {
  const navItems: Array<{ id: PageId; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'workbench', label: 'Inspection Workbench', icon: <Eye className="w-4 h-4" /> },
    {
      id: 'batch',
      label: 'Batch Analytics',
      icon: <BarChart3 className="w-4 h-4" />,
      badge: batchPassRate !== null && batchPassRate !== undefined ? `${batchPassRate}%` : undefined,
    },
    { id: 'pipeline', label: 'Pipeline Explorer', icon: <Network className="w-4 h-4" /> },
    { id: 'validation', label: 'Validation & Benchmark', icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'about', label: 'About the Project', icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 bg-[#0c121e] border-r border-[#1e293b] flex flex-col justify-between shrink-0 select-none">
      {/* Brand & Identity */}
      <div>
        <div className="p-5 border-b border-[#1e293b]/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-950">
              <Cpu className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="text-[13px] font-black tracking-wider text-slate-100 uppercase">
                ROBOVISION QMS 4.0
              </div>
              <div className="text-[10px] text-cyan-400 font-medium tracking-tight">
                Automated Quality Inspection
              </div>
            </div>
          </div>
          <div className="mt-3 text-[10px] text-slate-400 leading-tight">
            Stage 3 Review · ECCOR2MD201
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Workstation Views
          </div>
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectPage(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-950/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#131c2e]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-cyan-400' : 'text-slate-500'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Identity & Status */}
      <div className="p-4 border-t border-[#1e293b]/70 bg-[#0a0f1a]/80 space-y-3">
        {/* Simulation pill */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-amber-950/30 border border-amber-600/30 text-[10px] text-amber-300/90 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          <span className="tracking-wide">SIMULATION · SYNTHETIC</span>
        </div>

        {/* Institution & authors */}
        <div className="text-[10px] text-slate-400 leading-normal space-y-1">
          <div className="font-medium text-slate-300 truncate">
            Shah & Anchor Kutchhi Eng. College
          </div>
          <div className="text-cyan-400 font-medium">
            Om Nathwani
          </div>
        </div>
      </div>
    </aside>
  );
};
