export interface PartMetadata {
  part_id: number;
  label: string;
  nominal_width_mm: number;
  nominal_height_mm: number;
  target_defect_percent: number;
  expected_pick_x: number;
  expected_pick_y: number;
  stage2_reference: {
    width_mm?: number;
    height_mm?: number;
    defect_percent?: number;
    status?: 'PASS' | 'FAIL';
  };
  image_exists: boolean;
}

export interface PipelineStage {
  id: number;
  name: string;
  short_name: string;
  description: string;
  algorithm: string;
  parameters?: Record<string, any>;
  image: string; // base64 data URL
}

export interface InspectionResult {
  part_id: number;
  label: string;
  status: 'PASS' | 'FAIL';
  failure_reason: string;
  execution_time_ms: number;
  measurements: {
    width_mm: number;
    height_mm: number;
    defect_percent: number;
    threshold_value: number;
    mean_surface: number;
    std_surface: number;
    defect_cutoff: number;
    defective_pixel_count: number;
    total_surface_pixels: number;
  };
  acceptance: {
    width_ok: boolean;
    height_ok: boolean;
    defect_ok: boolean;
    width_bounds: [number, number];
    defect_threshold: number;
  };
  coordinates: {
    centroid_px: [number, number];
    bbox_px: [number, number, number, number];
    pick_x_mm: number;
    pick_y_mm: number;
    pick_z_mm: number;
    target_bin: [number, number, number];
    bin_type: 'PASS' | 'FAIL';
  };
  stage2_reference: {
    ref_width_mm?: number;
    ref_height_mm?: number;
    ref_defect_percent?: number;
    ref_status?: 'PASS' | 'FAIL';
    width_diff_mm?: number | null;
    height_diff_mm?: number | null;
  };
  stages: PipelineStage[];
}

export type RobotCoordinates = InspectionResult['coordinates'];

export interface BatchPartSummary {
  part_id: number;
  label: string;
  status: 'PASS' | 'FAIL';
  width_mm: number;
  height_mm: number;
  defect_percent: number;
  width_ok: boolean;
  height_ok: boolean;
  defect_ok: boolean;
  pick_x: number;
  pick_y: number;
  pick_z: number;
  failure_reason: string;
  stage2_reference: {
    width_mm?: number;
    height_mm?: number;
    defect_percent?: number;
    status?: 'PASS' | 'FAIL';
  };
  matches_reference_status: boolean;
}

export interface BatchStats {
  total_components: number;
  passed_components: number;
  failed_components: number;
  pass_rate_percent: number;
  execution_duration_ms: number;
  avg_time_per_part_ms: number;
  aggregates: {
    mean_width_mm: number;
    mean_height_mm: number;
    mean_defect_percent: number;
    max_defect_percent: number;
    min_defect_percent: number;
  };
  tolerance_limits: {
    width_min: number;
    width_max: number;
    defect_threshold: number;
  };
  exported_files: {
    csv: string;
    json: string;
    charts: string[];
  };
}

export interface BatchResultResponse {
  status: string;
  stats: BatchStats;
  parts: BatchPartSummary[];
}

export interface LatestBatchResponse {
  has_run: boolean;
  stats: BatchStats | null;
  parts: BatchPartSummary[];
}

export interface BenchmarkResult {
  status: string;
  part_id: number;
  warmup_runs: number;
  measured_iterations: number;
  avg_ms: number;
  median_ms: number;
  fps: number;
  scope: string;
  timestamp: string;
}

export interface TestRunResult {
  status: 'passed' | 'failed';
  exit_code: number;
  total_tests: number;
  passed: number;
  failed: number;
  duration_sec: number;
  stdout: string;
}

export interface AppHealth {
  status: string;
  service: string;
  version: string;
  institution: string;
  group: string;
  authors: Array<{ name: string; roll: number }>;
  project: {
    title: string;
    course: string;
    stage: string;
    mode: string;
  };
  limits: {
    dim_min_mm: number;
    dim_max_mm: number;
    nominal_mm: number;
    max_defect_percent: number;
    scale_px_per_mm: number;
    pass_bin: [number, number, number];
    fail_bin: [number, number, number];
  };
}
