"""backend/app.py — FastAPI application for Robot Vision Quality Inspection Workstation.

Serves REST API endpoints for:
- Single part inspection with full 7-stage vision pipeline image outputs (base64)
- Batch inspection (10 parts) with summary statistics and CSV/JSON generation
- Performance benchmarking (avg/median ms, FPS)
- Test suite execution via pytest
- Exporting results (CSV, JSON, Matplotlib dashboard and charts zip)
- Static hosting of built React/Vite frontend
"""
from __future__ import annotations

import base64
import io
import json
import logging
import os
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

# Add parent directory to path so src.* imports work seamlessly
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.vision_pipeline import (
    TEST_PARTS, STAGE2_REFERENCE, DATA_DIR, OUTPUT_DIR,
    SCALE_PX_PER_MM, DIM_MIN_MM, DIM_MAX_MM, MAX_DEFECT_PERCENT, NOMINAL_MM,
    PASS_BIN, FAIL_BIN, ORIGIN, GAUSS_KERNEL, GAUSS_SIGMA, MORPH_KERNEL_SIZE,
    run_one_part, run_batch, benchmark, save_summary_csv, save_summary_json,
    generate_synthetic_part
)
from src.analytics import (
    save_all_charts, chart_widths, chart_heights, chart_defects,
    chart_scatter, chart_coordinates, chart_dashboard
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("robot_vision_api")

app = FastAPI(
    title="Robot Vision Quality Inspection API",
    description="Automated Object Detection & Quality Inspection using Classical Computer Vision",
    version="3.0.0",
)

# Enable CORS for Vite dev server (typically http://localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory cache for latest batch results during this session
_LATEST_BATCH_RESULTS: Optional[list[dict[str, Any]]] = None
_LATEST_BATCH_STATS: Optional[dict[str, Any]] = None


# ── Serialization Helpers ───────────────────────────────────────────────────────

def sanitize_for_json(val: Any) -> Any:
    """Recursively convert NumPy data types to native JSON-serializable types."""
    if isinstance(val, (np.bool_, bool)):
        return bool(val)
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        return float(val)
    if isinstance(val, np.ndarray):
        return val.tolist()
    if isinstance(val, dict):
        return {str(k): sanitize_for_json(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [sanitize_for_json(v) for v in val]
    return val


def cv2_to_base64_png(img: np.ndarray) -> str:
    """Encode an OpenCV image (grayscale or RGB/BGR) as a base64 PNG data URL."""
    if img is None:
        return ""
    if len(img.shape) == 3 and img.shape[2] == 3:
        # Note: In vision_pipeline, contour_view & defect_view are created with cv2.COLOR_GRAY2RGB
        # cv2.imencode expects BGR order, so convert RGB -> BGR for correct PNG encoding
        bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    else:
        bgr = img
    success, buffer = cv2.imencode(".png", bgr)
    if not success:
        raise ValueError("Failed to encode image to PNG format")
    b64_str = base64.b64encode(buffer).decode("ascii")
    return f"data:image/png;base64,{b64_str}"


def make_final_inspection_view(res: dict[str, Any]) -> np.ndarray:
    """Compose the Stage 7 comprehensive inspection image.
    
    Combines contour bounding box, centroid, surface defect highlights,
    and a clean industrial status header banner.
    """
    final = res["contour_view"].copy()
    if "defect_cutoff" in res and "component_roi" in res:
        orig = res["image"]
        roi = res["component_roi"]
        defects = (orig < res["defect_cutoff"]) & (roi > 0)
        # Highlight defect pixels in bright red (RGB: 235, 45, 45)
        final[defects] = (235, 45, 45)

    # Top industrial status banner
    status = res["status"]
    banner_color = (34, 197, 94) if status == "PASS" else (239, 68, 68)
    cv2.rectangle(final, (0, 0), (800, 44), (13, 17, 23), -1)  # dark background
    cv2.rectangle(final, (0, 0), (12, 44), banner_color, -1)   # color accent bar

    status_text = f"RESULT: {status}  |  DIM: {res['width_mm']:.1f} x {res['height_mm']:.1f} mm  |  DEFECT: {res['defect_percent']:.2f}%"
    cv2.putText(
        final, status_text, (26, 28),
        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (241, 245, 249), 2, cv2.LINE_AA
    )
    return final


# ── Health & Metadata Endpoints ────────────────────────────────────────────────

@app.get("/api/health")
def get_health() -> dict[str, Any]:
    """Health check and application identity endpoint."""
    return {
        "status": "ok",
        "service": "Robot Vision Quality Inspection API",
        "version": "3.0.0",
        "institution": "Shah & Anchor Kutchhi Engineering College",
        "author": "Om Nathwani",
        "authors": [
            {"name": "Om Nathwani", "roll": 34},
        ],
        "project": {
            "title": "ROBOT VISION: Automated Object Detection & Quality Inspection",
            "course": "Essentials of Computer Science for Robotics (ECCOR2MD201)",
            "stage": "Stage 3 Comprehensive Review",
            "mode": "SOFTWARE SIMULATION · SYNTHETIC IMAGES",
        },
        "limits": {
            "dim_min_mm": DIM_MIN_MM,
            "dim_max_mm": DIM_MAX_MM,
            "nominal_mm": NOMINAL_MM,
            "max_defect_percent": MAX_DEFECT_PERCENT,
            "scale_px_per_mm": SCALE_PX_PER_MM,
            "pass_bin": list(PASS_BIN),
            "fail_bin": list(FAIL_BIN),
        }
    }


@app.get("/api/parts")
def list_parts() -> list[dict[str, Any]]:
    """List all 10 synthetic test parts with their specifications and Stage 2 reference."""
    parts_list = []
    for part in TEST_PARTS:
        pid = part.part_id
        ref = STAGE2_REFERENCE.get(pid, {})
        img_file = DATA_DIR / f"part_{pid:02d}.png"
        parts_list.append({
            "part_id": pid,
            "label": f"Part {pid:02d}",
            "nominal_width_mm": part.width_mm,
            "nominal_height_mm": part.height_mm,
            "target_defect_percent": part.defect_percent_target,
            "expected_pick_x": part.expected_pick_x,
            "expected_pick_y": part.expected_pick_y,
            "stage2_reference": ref,
            "image_exists": img_file.exists(),
        })
    return parts_list


@app.get("/api/parts/{part_id}")
def get_part_info(part_id: int) -> dict[str, Any]:
    """Get metadata and historical reference for a specific part."""
    part = next((p for p in TEST_PARTS if p.part_id == part_id), None)
    if not part:
        raise HTTPException(status_code=404, detail=f"Part {part_id} not found. Valid IDs: 1–10.")
    ref = STAGE2_REFERENCE.get(part_id, {})
    img_file = DATA_DIR / f"part_{part_id:02d}.png"
    return {
        "part_id": part.part_id,
        "label": f"Part {part.part_id:02d}",
        "nominal_width_mm": part.width_mm,
        "nominal_height_mm": part.height_mm,
        "target_defect_percent": part.defect_percent_target,
        "expected_pick_x": part.expected_pick_x,
        "expected_pick_y": part.expected_pick_y,
        "stage2_reference": ref,
        "image_exists": img_file.exists(),
    }


# ── Single Part Inspection Endpoint ───────────────────────────────────────────

@app.post("/api/inspect/{part_id}")
def inspect_part(part_id: int) -> dict[str, Any]:
    """Run full 7-stage vision pipeline for a single component.
    
    Returns all measurements, coordinate calculations, decision statuses,
    and base64-encoded PNG images for each of the 7 processing stages.
    """
    if part_id < 1 or part_id > 10:
        raise HTTPException(status_code=400, detail=f"Invalid part ID {part_id}. Expected 1–10.")
    
    try:
        t0 = time.perf_counter()
        raw_result = run_one_part(part_id)
        duration_ms = (time.perf_counter() - t0) * 1000.0

        # Stage 7 final view
        final_view = make_final_inspection_view(raw_result)

        # Base64 encode all 7 stages
        stages = [
            {
                "id": 1,
                "name": "Original Image",
                "short_name": "Input",
                "description": "800×800 grayscale synthetic component image generated from calibrated parameters.",
                "algorithm": "Synthetic Image Generation (Geometric ROI + Gaussian Noise)",
                "image": cv2_to_base64_png(raw_result["image"]),
            },
            {
                "id": 2,
                "name": "Gaussian Blur",
                "short_name": "Blur",
                "description": "5×5 Gaussian filter with σ = 1.4 suppresses high-frequency sensor noise while preserving edges.",
                "algorithm": "Gaussian 2D Kernel Convolution",
                "parameters": {"kernel": "5x5", "sigma": 1.4},
                "image": cv2_to_base64_png(raw_result["blurred"]),
            },
            {
                "id": 3,
                "name": "Otsu Threshold",
                "short_name": "Otsu",
                "description": f"Intra-class variance minimization automatically determines optimal binarization threshold ({raw_result['threshold_value']:.1f}).",
                "algorithm": "Otsu's Binarization",
                "parameters": {"threshold": round(float(raw_result["threshold_value"]), 1)},
                "image": cv2_to_base64_png(raw_result["otsu"]),
            },
            {
                "id": 4,
                "name": "Morphological Refinement",
                "short_name": "Morphology",
                "description": "9×9 rectangular structuring element closing (fills internal holes) followed by opening (eliminates boundary spurs).",
                "algorithm": "Morphological Close then Open",
                "parameters": {"kernel": "9x9 rectangular", "order": "CLOSE -> OPEN"},
                "image": cv2_to_base64_png(raw_result["refined"]),
            },
            {
                "id": 5,
                "name": "Contour Detection",
                "short_name": "Contour",
                "description": "Extracts external boundary, fits bounding box, and calculates centroid via spatial image moments.",
                "algorithm": "cv2.findContours (RETR_EXTERNAL) & Spatial Moments",
                "parameters": {"scale": "5.0 px/mm", "origin": "(400, 400)"},
                "image": cv2_to_base64_png(raw_result["contour_view"]),
            },
            {
                "id": 6,
                "name": "Surface Defect Detection",
                "short_name": "Defect",
                "description": f"Statistical thresholding isolates anomalous dark pixels below cutoff (μ - 2σ = {raw_result['defect_cutoff']:.1f}).",
                "algorithm": "Surface Intensity Analysis (Mean - 2*StdDev)",
                "parameters": {
                    "mean_intensity": round(float(raw_result["mean_surface"]), 1),
                    "std_intensity": round(float(raw_result["std_surface"]), 1),
                    "cutoff": round(float(raw_result["defect_cutoff"]), 1),
                },
                "image": cv2_to_base64_png(raw_result["defect_view"]),
            },
            {
                "id": 7,
                "name": "Final Inspection Result",
                "short_name": "Final Result",
                "description": f"Decision: {raw_result['status']} | {raw_result['failure_reason']}",
                "algorithm": "Quality Acceptance Rules Evaluation",
                "parameters": {
                    "dim_tolerance": "115.0 - 125.0 mm",
                    "defect_threshold": "2.0%",
                },
                "image": cv2_to_base64_png(final_view),
            },
        ]

        ref = STAGE2_REFERENCE.get(part_id, {})

        response_data = {
            "part_id": part_id,
            "label": f"Part {part_id:02d}",
            "status": raw_result["status"],
            "failure_reason": raw_result["failure_reason"],
            "execution_time_ms": round(duration_ms, 2),
            "measurements": {
                "width_mm": round(float(raw_result["width_mm"]), 2),
                "height_mm": round(float(raw_result["height_mm"]), 2),
                "defect_percent": round(float(raw_result["defect_percent"]), 3),
                "threshold_value": round(float(raw_result["threshold_value"]), 1),
                "mean_surface": round(float(raw_result["mean_surface"]), 2),
                "std_surface": round(float(raw_result["std_surface"]), 2),
                "defect_cutoff": round(float(raw_result["defect_cutoff"]), 2),
                "defective_pixel_count": int(raw_result["defective_count"]),
                "total_surface_pixels": int(raw_result["total_surface_px"]),
            },
            "acceptance": {
                "width_ok": bool(raw_result["width_ok"]),
                "height_ok": bool(raw_result["height_ok"]),
                "defect_ok": bool(raw_result["defect_ok"]),
                "width_bounds": [DIM_MIN_MM, DIM_MAX_MM],
                "defect_threshold": MAX_DEFECT_PERCENT,
            },
            "coordinates": {
                "centroid_px": [round(float(raw_result["centroid_x_px"]), 1), round(float(raw_result["centroid_y_px"]), 1)],
                "bbox_px": [int(raw_result["bbox_x"]), int(raw_result["bbox_y"]), int(raw_result["bbox_w"]), int(raw_result["bbox_h"])],
                "pick_x_mm": round(float(raw_result["pick_x"]), 2),
                "pick_y_mm": round(float(raw_result["pick_y"]), 2),
                "pick_z_mm": round(float(raw_result["pick_z"]), 2),
                "target_bin": list(PASS_BIN if raw_result["status"] == "PASS" else FAIL_BIN),
                "bin_type": "PASS" if raw_result["status"] == "PASS" else "FAIL",
            },
            "stage2_reference": {
                "ref_width_mm": ref.get("width_mm"),
                "ref_height_mm": ref.get("height_mm"),
                "ref_defect_percent": ref.get("defect_percent"),
                "ref_status": ref.get("status"),
                "width_diff_mm": round(float(raw_result["width_mm"]) - ref.get("width_mm", 0.0), 2) if "width_mm" in ref else None,
                "height_diff_mm": round(float(raw_result["height_mm"]) - ref.get("height_mm", 0.0), 2) if "height_mm" in ref else None,
            },
            "stages": stages,
        }
        return sanitize_for_json(response_data)

    except Exception as e:
        log.exception("Error inspecting part %s", part_id)
        raise HTTPException(status_code=500, detail=f"Inspection failed for part {part_id}: {str(e)}")


# ── Batch Inspection Endpoint ──────────────────────────────────────────────────

@app.post("/api/batch")
def execute_batch() -> dict[str, Any]:
    """Run full batch inspection for all 10 synthetic components.
    
    Generates CSV, JSON, and Matplotlib chart images on disk,
    updates session batch cache, and returns structured analytical results.
    """
    global _LATEST_BATCH_RESULTS, _LATEST_BATCH_STATS
    try:
        t0 = time.perf_counter()
        results = run_batch()
        batch_duration_ms = (time.perf_counter() - t0) * 1000.0

        # Save files to disk (outputs/ directory)
        csv_path = save_summary_csv(results)
        json_path = save_summary_json(results)
        chart_paths = save_all_charts(results)

        # Compute batch statistics
        total = len(results)
        passed = sum(1 for r in results if r["status"] == "PASS")
        failed = total - passed
        pass_rate = (passed / total * 100.0) if total > 0 else 0.0

        widths = [float(r["width_mm"]) for r in results]
        heights = [float(r["height_mm"]) for r in results]
        defects = [float(r["defect_percent"]) for r in results]

        parts_summary = []
        for r in results:
            ref = STAGE2_REFERENCE.get(r["part"], {})
            parts_summary.append({
                "part_id": r["part"],
                "label": f"Part {r['part']:02d}",
                "status": r["status"],
                "width_mm": round(float(r["width_mm"]), 2),
                "height_mm": round(float(r["height_mm"]), 2),
                "defect_percent": round(float(r["defect_percent"]), 3),
                "width_ok": bool(r["width_ok"]),
                "height_ok": bool(r["height_ok"]),
                "defect_ok": bool(r["defect_ok"]),
                "pick_x": round(float(r["pick_x"]), 2),
                "pick_y": round(float(r["pick_y"]), 2),
                "pick_z": round(float(r["pick_z"]), 2),
                "failure_reason": r["failure_reason"],
                "stage2_reference": ref,
                "matches_reference_status": (r["status"] == ref.get("status")),
            })

        stats = {
            "total_components": total,
            "passed_components": passed,
            "failed_components": failed,
            "pass_rate_percent": round(pass_rate, 1),
            "execution_duration_ms": round(batch_duration_ms, 2),
            "avg_time_per_part_ms": round(batch_duration_ms / total, 2),
            "aggregates": {
                "mean_width_mm": round(float(np.mean(widths)), 2),
                "mean_height_mm": round(float(np.mean(heights)), 2),
                "mean_defect_percent": round(float(np.mean(defects)), 3),
                "max_defect_percent": round(float(np.max(defects)), 3),
                "min_defect_percent": round(float(np.min(defects)), 3),
            },
            "tolerance_limits": {
                "width_min": DIM_MIN_MM,
                "width_max": DIM_MAX_MM,
                "defect_threshold": MAX_DEFECT_PERCENT,
            },
            "exported_files": {
                "csv": csv_path.name,
                "json": json_path.name,
                "charts": [p.name for p in chart_paths],
            }
        }

        # Cache in memory
        _LATEST_BATCH_RESULTS = parts_summary
        _LATEST_BATCH_STATS = stats

        return sanitize_for_json({
            "status": "success",
            "stats": stats,
            "parts": parts_summary,
        })

    except Exception as e:
        log.exception("Error executing batch inspection")
        raise HTTPException(status_code=500, detail=f"Batch inspection failed: {str(e)}")


@app.get("/api/batch/latest")
def get_latest_batch() -> dict[str, Any]:
    """Retrieve the latest batch inspection result cached in the current session.
    
    If no batch has run yet, returns {has_run: false}.
    """
    if _LATEST_BATCH_RESULTS is None or _LATEST_BATCH_STATS is None:
        return {"has_run": False, "stats": None, "parts": []}
    return {
        "has_run": True,
        "stats": _LATEST_BATCH_STATS,
        "parts": _LATEST_BATCH_RESULTS,
    }


# ── Benchmark & Test Execution Endpoints ───────────────────────────────────────

@app.post("/api/benchmark")
def run_benchmark_endpoint(
    part_id: int = Query(3, ge=1, le=10),
    warmup: int = Query(3, ge=1, le=10),
    iterations: int = Query(20, ge=5, le=100),
) -> dict[str, Any]:
    """Execute high-precision pipeline-only latency benchmark.
    
    Excludes disk I/O, network latency, and UI rendering to measure
    raw OpenCV algorithmic throughput.
    """
    try:
        bench = benchmark(part_id=part_id, warmup=warmup, iterations=iterations)
        return sanitize_for_json({
            "status": "success",
            "part_id": part_id,
            "warmup_runs": warmup,
            "measured_iterations": iterations,
            "avg_ms": round(bench["avg_ms"], 2),
            "median_ms": round(bench["median_ms"], 2),
            "fps": round(bench["fps"], 1),
            "scope": "Pipeline only (Gaussian blur -> Otsu -> Morphology -> Contours -> Defects; in-memory)",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        })
    except Exception as e:
        log.exception("Error running benchmark")
        raise HTTPException(status_code=500, detail=f"Benchmark execution failed: {str(e)}")


@app.post("/api/tests/run")
def run_tests_endpoint() -> dict[str, Any]:
    """Execute the full automated pytest suite programmatically and report results."""
    test_file = ROOT_DIR / "tests" / "test_pipeline.py"
    if not test_file.exists():
        raise HTTPException(status_code=404, detail="Test suite file not found.")

    t0 = time.perf_counter()
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", str(test_file), "-v", "--tb=short"],
        cwd=str(ROOT_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    duration_s = time.perf_counter() - t0

    stdout = proc.stdout or ""
    stderr = proc.stderr or ""
    output_combined = stdout + ("\n" + stderr if stderr else "")

    # Parse passed/failed count from pytest output
    passed = 0
    failed = 0
    for line in output_combined.splitlines():
        if "passed" in line:
            import re
            m_pass = re.search(r"(\d+)\s+passed", line)
            m_fail = re.search(r"(\d+)\s+failed", line)
            if m_pass:
                passed = int(m_pass.group(1))
            if m_fail:
                failed = int(m_fail.group(1))

    return {
        "status": "passed" if proc.returncode == 0 else "failed",
        "exit_code": proc.returncode,
        "total_tests": passed + failed if (passed + failed) > 0 else 44,
        "passed": passed,
        "failed": failed,
        "duration_sec": round(duration_s, 2),
        "stdout": output_combined,
    }


# ── File Export & Download Endpoints ───────────────────────────────────────────

@app.get("/api/export/csv")
def export_csv() -> FileResponse:
    """Download the batch inspection results as CSV."""
    path = OUTPUT_DIR / "inspection_results.csv"
    if not path.exists():
        # Generate on demand
        results = run_batch()
        path = save_summary_csv(results)
    return FileResponse(
        path=str(path),
        filename="inspection_results.csv",
        media_type="text/csv",
    )


@app.get("/api/export/json")
def export_json() -> FileResponse:
    """Download the batch inspection summary as JSON."""
    path = OUTPUT_DIR / "inspection_summary.json"
    if not path.exists():
        results = run_batch()
        path = save_summary_json(results)
    return FileResponse(
        path=str(path),
        filename="inspection_summary.json",
        media_type="application/json",
    )


@app.get("/api/export/dashboard")
def export_dashboard() -> FileResponse:
    """Download the 2×2 consolidated Matplotlib dashboard image."""
    path = OUTPUT_DIR / "batch_dashboard.png"
    if not path.exists():
        results = run_batch()
        save_all_charts(results)
    return FileResponse(
        path=str(path),
        filename="batch_dashboard.png",
        media_type="image/png",
    )


@app.get("/api/chart/{name}")
def get_chart_image(name: str) -> FileResponse:
    """Retrieve an individual chart image generated by the analytics module."""
    allowed_names = {
        "chart_widths.png",
        "chart_heights.png",
        "chart_defects.png",
        "chart_scatter.png",
        "chart_coordinates.png",
        "batch_dashboard.png",
    }
    if name not in allowed_names:
        raise HTTPException(status_code=400, detail="Invalid chart name.")
    
    path = OUTPUT_DIR / name
    if not path.exists():
        results = run_batch()
        save_all_charts(results)
    return FileResponse(path=str(path), media_type="image/png")


@app.get("/api/export/charts-zip")
def export_charts_zip() -> StreamingResponse:
    """Download all 5 charts + consolidated dashboard bundled into a single ZIP archive."""
    # Ensure all charts exist
    results = run_batch()
    save_all_charts(results)

    chart_files = [
        "chart_widths.png",
        "chart_heights.png",
        "chart_defects.png",
        "chart_scatter.png",
        "chart_coordinates.png",
        "batch_dashboard.png",
        "inspection_results.csv",
        "inspection_summary.json",
    ]

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in chart_files:
            fpath = OUTPUT_DIR / fname
            if fpath.exists():
                zf.write(str(fpath), arcname=fname)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=robot_vision_analytics_bundle.zip"},
    )


# ── Static Files & SPA Fallback ────────────────────────────────────────────────

FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        # Allow API requests to fall through (though FastAPI router already handles /api)
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        # SPA index.html fallback
        return FileResponse(str(FRONTEND_DIST / "index.html"))
