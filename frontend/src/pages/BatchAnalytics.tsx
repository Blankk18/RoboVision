import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from 'recharts';
import {
  FileSpreadsheet,
  FileCode,
  Image,
  Archive,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Activity,
  ArrowRight,
  Filter,
} from 'lucide-react';
import type { BatchStats, BatchPartSummary } from '../types/api';
import { getExportUrl } from '../api/client';
import type { PageId } from '../components/Sidebar';
import { padPartId } from '../utils/format';

interface BatchAnalyticsProps {
  stats: BatchStats | null;
  parts: BatchPartSummary[];
  loading: boolean;
  onRunBatch: () => void;
  onSelectPart: (partId: number) => void;
  onSelectPage: (page: PageId) => void;
}

export const BatchAnalytics: React.FC<BatchAnalyticsProps> = ({
  stats,
  parts,
  loading,
  onRunBatch,
  onSelectPart,
  onSelectPage,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'PASS' | 'FAIL'>('ALL');

  const filteredParts = parts.filter((p) => {
    if (filter === 'ALL') return true;
    return p.status === filter;
  });

  // Prepare data for Recharts
  const barChartData = parts.map((p) => ({
    name: `P${padPartId(p.part_id)}`,
    part_id: p.part_id,
    width_mm: p.width_mm,
    height_mm: p.height_mm,
    defect_percent: p.defect_percent,
    status: p.status,
    fill: p.status === 'PASS' ? '#22c55e' : '#ef4444',
  }));

  // Scatter plot data for Width vs Height
  const scatterData = parts.map((p) => ({
    part_id: p.part_id,
    name: `Part ${padPartId(p.part_id)}`,
    width: p.width_mm,
    height: p.height_mm,
    status: p.status,
    fill: p.status === 'PASS' ? '#22c55e' : '#ef4444',
  }));

  // Spatial coordinates data
  const pickCoordsData = parts.map((p) => ({
    name: `P${padPartId(p.part_id)}`,
    x: p.pick_x,
    y: p.pick_y,
    status: p.status,
    fill: p.status === 'PASS' ? '#22c55e' : '#ef4444',
  }));

  const passBin = [{ x: 350, y: -200, name: 'PASS Bin' }];
  const failBin = [{ x: -350, y: -200, name: 'FAIL Bin' }];

  return (
    <div className="p-8 max-w-[1700px] mx-auto space-y-8 animate-fadeIn">
      {/* Top Header & Export Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-[#0c121e] border border-[#1e293b]">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Batch Quality Inspection Workspace
          </h2>
          <p className="text-xs text-slate-400">
            Real-time statistical evaluation of all 10 synthetic aluminium components.
          </p>
        </div>

        {/* Action & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onRunBatch}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 text-slate-950 transition-colors shadow-sm shadow-cyan-500/20 cursor-pointer"
          >
            {loading ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Batch...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Batch Inspection</span>
              </>
            )}
          </button>

          {parts.length > 0 && (
            <>
              <a
                href={getExportUrl('csv')}
                download="inspection_results.csv"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#111c2e] hover:bg-[#182740] border border-[#1e293b] text-slate-200 transition-colors"
                title="Download CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </a>

              <a
                href={getExportUrl('json')}
                download="inspection_summary.json"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#111c2e] hover:bg-[#182740] border border-[#1e293b] text-slate-200 transition-colors"
                title="Download JSON"
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export JSON</span>
              </a>

              <a
                href={getExportUrl('dashboard')}
                download="batch_dashboard.png"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#111c2e] hover:bg-[#182740] border border-[#1e293b] text-slate-200 transition-colors"
                title="Download Consolidated Dashboard PNG"
              >
                <Image className="w-3.5 h-3.5 text-amber-400" />
                <span>Dashboard PNG</span>
              </a>

              <a
                href={getExportUrl('charts-zip')}
                download="robot_vision_analytics_bundle.zip"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#111c2e] hover:bg-[#182740] border border-[#1e293b] text-slate-200 transition-colors"
                title="Download All Charts Archive (ZIP)"
              >
                <Archive className="w-3.5 h-3.5 text-purple-400" />
                <span>All Charts (ZIP)</span>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Batch Stats KPI Cards */}
      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e293b]">
            <div className="text-[11px] font-medium text-slate-400 uppercase">Total Inspected</div>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-1">
              {stats.total_components} <span className="text-xs font-normal text-slate-400">parts</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">10 synthetic test cases</div>
          </div>

          <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e293b]">
            <div className="text-[11px] font-medium text-slate-400 uppercase">Passed Parts</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-5 h-5" />
              {stats.passed_components}
            </div>
            <div className="text-[10px] text-emerald-500/80 mt-1 font-mono">
              Pass Rate: {stats.pass_rate_percent}%
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e293b]">
            <div className="text-[11px] font-medium text-slate-400 uppercase">Rejected Parts</div>
            <div className="text-2xl font-bold font-mono text-red-400 mt-1 flex items-center gap-1.5">
              <XCircle className="w-5 h-5" />
              {stats.failed_components}
            </div>
            <div className="text-[10px] text-red-500/80 mt-1 font-mono">
              Rejection: {(100 - stats.pass_rate_percent).toFixed(1)}%
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e293b]">
            <div className="text-[11px] font-medium text-slate-400 uppercase">Mean Dimensions</div>
            <div className="text-sm font-bold font-mono text-cyan-300 mt-1">
              W: {stats.aggregates.mean_width_mm} mm
            </div>
            <div className="text-sm font-bold font-mono text-cyan-300 mt-0.5">
              H: {stats.aggregates.mean_height_mm} mm
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0c121e] border border-[#1e293b]">
            <div className="text-[11px] font-medium text-slate-400 uppercase">Defect Distribution</div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-1">
              Avg: {stats.aggregates.mean_defect_percent}%
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
              Min: {stats.aggregates.min_defect_percent}% | Max: {stats.aggregates.max_defect_percent}%
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-[#0c121e] border border-dashed border-[#1e293b] text-center text-slate-400 space-y-2">
          <Activity className="w-8 h-8 mx-auto text-slate-600" />
          <div className="text-sm font-medium">No batch execution recorded in this session.</div>
          <div className="text-xs text-slate-500">
            Click &apos;Execute Batch Inspection&apos; above to generate actual results and analytical charts.
          </div>
        </div>
      )}

      {/* 5 Analytical Charts Grid */}
      {parts.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-base font-bold text-slate-200">
            Analytical Inspection Charts (Generated from Live Results)
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Width Measurements */}
            <div className="p-5 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    1. Width Measurements vs Tolerance Band
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Acceptance window: 115.0 – 125.0 mm | Nominal: 120.0 mm
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis domain={[100, 140]} stroke="#64748b" fontSize={11} unit=" mm" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#94a3b8', fontSize: '11px' }}
                      formatter={(val: any) => [`${val} mm`, 'Width']}
                    />
                    <ReferenceArea y1={115} y2={125} fill="#0284c7" fillOpacity={0.12} />
                    <ReferenceLine y={120} stroke="#38bdf8" strokeDasharray="4 4" label={{ value: 'Nominal 120 mm', fill: '#38bdf8', fontSize: 10, position: 'insideTopLeft' }} />
                    <ReferenceLine y={115} stroke="#f59e0b" strokeDasharray="2 2" />
                    <ReferenceLine y={125} stroke="#f59e0b" strokeDasharray="2 2" />
                    <Bar dataKey="width_mm" radius={[4, 4, 0, 0]}>
                      {barChartData.map((entry, index) => (
                        <Cell key={`cell-w-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Height Measurements */}
            <div className="p-5 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    2. Height Measurements vs Tolerance Band
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Acceptance window: 115.0 – 125.0 mm | Nominal: 120.0 mm
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis domain={[100, 140]} stroke="#64748b" fontSize={11} unit=" mm" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#94a3b8', fontSize: '11px' }}
                      formatter={(val: any) => [`${val} mm`, 'Height']}
                    />
                    <ReferenceArea y1={115} y2={125} fill="#0284c7" fillOpacity={0.12} />
                    <ReferenceLine y={120} stroke="#38bdf8" strokeDasharray="4 4" label={{ value: 'Nominal 120 mm', fill: '#38bdf8', fontSize: 10, position: 'insideTopLeft' }} />
                    <ReferenceLine y={115} stroke="#f59e0b" strokeDasharray="2 2" />
                    <ReferenceLine y={125} stroke="#f59e0b" strokeDasharray="2 2" />
                    <Bar dataKey="height_mm" radius={[4, 4, 0, 0]}>
                      {barChartData.map((entry, index) => (
                        <Cell key={`cell-h-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Surface Defect Percentages */}
            <div className="p-5 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    3. Surface Defect Area Percentage
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Rejection threshold: ≥ 2.0% anomalous surface pixels
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} unit="%" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#94a3b8', fontSize: '11px' }}
                      formatter={(val: any) => [`${val}%`, 'Defect Area']}
                    />
                    <ReferenceLine y={2.0} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" label={{ value: 'Reject Threshold 2.0%', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
                    <Bar dataKey="defect_percent" radius={[4, 4, 0, 0]}>
                      {barChartData.map((entry, index) => (
                        <Cell key={`cell-d-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Dimensional Scatter (Width vs Height) */}
            <div className="p-5 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    4. Dimensional Scatter (Width vs. Height)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Acceptance Region: [115, 125] × [115, 125] mm box
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" dataKey="width" domain={[110, 135]} stroke="#64748b" fontSize={11} name="Width" unit=" mm" />
                    <YAxis type="number" dataKey="height" domain={[115, 130]} stroke="#64748b" fontSize={11} name="Height" unit=" mm" />
                    <ZAxis range={[70, 70]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      cursor={{ strokeDasharray: '3 3' }}
                      formatter={(val: any, name: any) => [`${val} mm`, name]}
                    />
                    <ReferenceArea x1={115} x2={125} y1={115} y2={125} fill="#0284c7" fillOpacity={0.12} stroke="#38bdf8" />
                    <Scatter name="Components" data={scatterData}>
                      {scatterData.map((entry, index) => (
                        <Cell key={`scatter-${index}`} fill={entry.fill} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 5: Spatial Robot Pick Coordinates & Bins */}
            <div className="p-5 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    5. Calculated Pick Positions & Sorting Bin Targets (Robot Base Coordinates)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    PASS destination bin at (+350, -200, 10) mm | FAIL destination bin at (-350, -200, 10) mm
                  </p>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" dataKey="x" domain={[-400, 400]} stroke="#64748b" fontSize={11} name="X" unit=" mm" />
                    <YAxis type="number" dataKey="y" domain={[-250, 50]} stroke="#64748b" fontSize={11} name="Y" unit=" mm" />
                    <ZAxis range={[80, 120]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      formatter={(val: any, name: any) => [`${val} mm`, name]}
                    />
                    <ReferenceLine x={0} stroke="#475569" strokeDasharray="3 3" />
                    <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                    <Scatter name="Pick Locations" data={pickCoordsData}>
                      {pickCoordsData.map((entry, index) => (
                        <Cell key={`pick-${index}`} fill={entry.fill} />
                      ))}
                    </Scatter>
                    <Scatter name="PASS Bin (+350, -200)" data={passBin} fill="#22c55e" shape="star" />
                    <Scatter name="FAIL Bin (-350, -200)" data={failBin} fill="#ef4444" shape="star" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Batch Results Table */}
      {parts.length > 0 && (
        <div className="p-6 rounded-xl bg-[#0c121e] border border-[#1e293b] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-200">
                Component Results Table ({filteredParts.length} of {parts.length})
              </h3>
              <p className="text-xs text-slate-400">
                Click any row to jump to the Inspection Workbench for detailed visual examination.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#111927] border border-[#1e293b] text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              <button
                onClick={() => setFilter('ALL')}
                className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                  filter === 'ALL' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                All (10)
              </button>
              <button
                onClick={() => setFilter('PASS')}
                className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                  filter === 'PASS' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                PASS (5)
              </button>
              <button
                onClick={() => setFilter('FAIL')}
                className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                  filter === 'FAIL' ? 'bg-red-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                FAIL (5)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#1e293b]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#0f172a] text-slate-400 font-semibold border-b border-[#1e293b]">
                  <th className="py-3 px-3">Part #</th>
                  <th className="py-3 px-3">Width (mm)</th>
                  <th className="py-3 px-3">Height (mm)</th>
                  <th className="py-3 px-3">Defect %</th>
                  <th className="py-3 px-3">Width OK</th>
                  <th className="py-3 px-3">Height OK</th>
                  <th className="py-3 px-3">Defect OK</th>
                  <th className="py-3 px-3">Pick (X, Y, Z) mm</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Evaluation Reason</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/60 font-mono">
                {filteredParts.map((p) => {
                  const isPass = p.status === 'PASS';
                  return (
                    <tr
                      key={p.part_id}
                      onClick={() => {
                        onSelectPage('workbench');
                        onSelectPart(p.part_id);
                      }}
                      className="hover:bg-[#131c2e] transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-100 flex items-center gap-1.5">
                        <span className="text-cyan-400">P{padPartId(p.part_id)}</span>
                      </td>
                      <td className={`py-2.5 px-3 ${p.width_ok ? 'text-slate-200' : 'text-red-400 font-bold'}`}>
                        {p.width_mm}
                      </td>
                      <td className={`py-2.5 px-3 ${p.height_ok ? 'text-slate-200' : 'text-red-400 font-bold'}`}>
                        {p.height_mm}
                      </td>
                      <td className={`py-2.5 px-3 ${p.defect_ok ? 'text-slate-200' : 'text-red-400 font-bold'}`}>
                        {p.defect_percent}%
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.width_ok ? 'bg-emerald-950/60 text-emerald-400' : 'bg-red-950/60 text-red-400'}`}>
                          {p.width_ok ? 'OK' : 'ERR'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.height_ok ? 'bg-emerald-950/60 text-emerald-400' : 'bg-red-950/60 text-red-400'}`}>
                          {p.height_ok ? 'OK' : 'ERR'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.defect_ok ? 'bg-emerald-950/60 text-emerald-400' : 'bg-red-950/60 text-red-400'}`}>
                          {p.defect_ok ? 'OK' : 'ERR'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-cyan-300">
                        ({p.pick_x}, {p.pick_y}, {p.pick_z})
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isPass
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                              : 'bg-red-950/80 text-red-400 border-red-500/40'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] font-sans text-slate-400 truncate max-w-xs">
                        {p.failure_reason}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-[11px] font-sans text-cyan-400 opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity">
                          Inspect <ArrowRight className="w-3 h-3" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
