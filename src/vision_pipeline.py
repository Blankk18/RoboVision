"""vision_pipeline.py — Core image-processing engine.

Generates synthetic test images and runs the classical OpenCV inspection
pipeline (Gaussian blur → Otsu threshold → morphology → contour detection
→ defect scoring → PASS/FAIL decision).

All constants match the Stage 1/2 project specification exactly.
No physical camera, robot, or external service is required.
"""
from __future__ import annotations

import csv
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np

# ── Logging ────────────────────────────────────────────────────────────────────
log = logging.getLogger(__name__)

# ── Project root and folder paths ─────────────────────────────────────────────
ROOT: Path = Path(__file__).resolve().parent.parent
DATA_DIR: Path = ROOT / "data"
OUTPUT_DIR: Path = ROOT / "outputs"

# ── Physical/image parameters from the Stage 1/2 specification ────────────────
CANVAS: int = 800                    # pixels × pixels
SCALE_PX_PER_MM: float = 5.0        # calibration scale (px / mm)
ORIGIN: tuple[float, float] = (400.0, 400.0)  # image centre, mm origin
NOMINAL_MM: float = 120.0           # target component dimension
TOLERANCE_MM: float = 5.0           # ± acceptance window
GAUSS_KERNEL: tuple[int, int] = (5, 5)
GAUSS_SIGMA: float = 1.4
MORPH_KERNEL_SIZE: int = 9          # 9×9 rectangular structuring element
MAX_DEFECT_PERCENT: float = 2.0     # reject threshold (≥ 2.0 % → FAIL)
DIM_MIN_MM: float = NOMINAL_MM - TOLERANCE_MM  # 115 mm
DIM_MAX_MM: float = NOMINAL_MM + TOLERANCE_MM  # 125 mm
PICK_Z: float = 10.0                # fixed approach height (illustrative)

# Sorting bin targets (illustrative software coordinates, no hardware)
PASS_BIN: tuple[float, float, float] = (+350.0, -200.0, 10.0)
FAIL_BIN: tuple[float, float, float] = (-350.0, -200.0, 10.0)


# ── Test-part specification ────────────────────────────────────────────────────
@dataclass(frozen=True)
class TestPart:
    """Specification for one synthetic test component."""

    part_id: int
    width_mm: float          # documented Stage-2 width
    height_mm: float         # documented Stage-2 height
    defect_percent_target: float  # target defect area when generating image
    expected_pick_x: float   # illustrative X offset from image centre (mm)
    expected_pick_y: float   # illustrative Y offset from image centre (mm)


# The ten parts documented in the Stage 2 report.
TEST_PARTS: list[TestPart] = [
    TestPart(1,  131.20, 119.40, 0.812, -12.4,  8.6),
    TestPart(2,  118.60, 121.80, 3.241,   7.2, -5.1),
    TestPart(3,  122.40, 117.60, 0.430,   3.8, 11.2),
    TestPart(4,  113.60, 119.20, 0.115,  -8.6,  4.4),
    TestPart(5,  121.00, 122.60, 1.720,   9.0,-14.3),
    TestPart(6,  119.40, 118.00, 0.087,  -4.2,  7.8),
    TestPart(7,  127.80, 124.20, 4.650,   6.5, -3.2),
    TestPart(8,  120.60, 119.80, 0.320,  -1.8,  9.5),
    TestPart(9,  116.20, 121.40, 0.550,   5.3, -6.7),
    TestPart(10, 124.80, 118.60, 2.180,  11.2,  3.1),
]

# Reference values from the Stage 2 report (for display comparison only).
STAGE2_REFERENCE: dict[int, dict[str, Any]] = {
    1:  {"width_mm": 131.20, "height_mm": 119.40, "defect_percent": 0.812, "status": "FAIL"},
    2:  {"width_mm": 118.60, "height_mm": 121.80, "defect_percent": 3.241, "status": "FAIL"},
    3:  {"width_mm": 122.40, "height_mm": 117.60, "defect_percent": 0.430, "status": "PASS"},
    4:  {"width_mm": 113.60, "height_mm": 119.20, "defect_percent": 0.115, "status": "FAIL"},
    5:  {"width_mm": 121.00, "height_mm": 122.60, "defect_percent": 1.720, "status": "PASS"},
    6:  {"width_mm": 119.40, "height_mm": 118.00, "defect_percent": 0.087, "status": "PASS"},
    7:  {"width_mm": 127.80, "height_mm": 124.20, "defect_percent": 4.650, "status": "FAIL"},
    8:  {"width_mm": 120.60, "height_mm": 119.80, "defect_percent": 0.320, "status": "PASS"},
    9:  {"width_mm": 116.20, "height_mm": 121.40, "defect_percent": 0.550, "status": "PASS"},
    10: {"width_mm": 124.80, "height_mm": 118.60, "defect_percent": 2.180, "status": "FAIL"},
}


# ── Image generation ───────────────────────────────────────────────────────────

def _make_clustered_defect_mask(
    shape: tuple[int, int],
    roi_mask: np.ndarray,
    target_count: int,
    rng: np.random.Generator,
) -> np.ndarray:
    """Create clustered dark synthetic defects with an exact pixel count.

    Ellipses are drawn randomly inside the ROI and clipped to it.
    If the ellipse method underproduces, remaining pixels are filled from
    valid ROI positions using the same deterministic RNG.
    """
    h, w = shape
    candidate = np.zeros((h, w), dtype=np.uint8)
    ys, xs = np.where(roi_mask > 0)
    if target_count <= 0 or len(xs) == 0:
        return candidate

    xmin, xmax = int(xs.min()), int(xs.max())
    ymin, ymax = int(ys.min()), int(ys.max())
    max_attempts = max(1000, target_count // 2)
    attempts = 0
    while (int(np.count_nonzero(candidate & roi_mask)) < target_count
           and attempts < max_attempts):
        attempts += 1
        cx = int(rng.integers(xmin + 14, max(xmin + 15, xmax - 13)))
        cy = int(rng.integers(ymin + 12, max(ymin + 13, ymax - 11)))
        rx = int(rng.integers(2, 10))
        ry = int(rng.integers(2, 8))
        angle = int(rng.integers(0, 180))
        cv2.ellipse(candidate, (cx, cy), (rx, ry), angle, 0, 360, 255, -1)
        candidate = cv2.bitwise_and(candidate, roi_mask)

    eligible_y, eligible_x = np.where(candidate > 0)
    if len(eligible_x) < target_count:
        remaining = target_count - len(eligible_x)
        valid = (roi_mask > 0) & (candidate == 0)
        vy, vx = np.where(valid)
        choose = rng.choice(len(vx), size=min(remaining, len(vx)), replace=False)
        candidate[vy[choose], vx[choose]] = 255
        eligible_y, eligible_x = np.where(candidate > 0)
    if len(eligible_x) > target_count:
        choose = rng.choice(len(eligible_x), size=target_count, replace=False)
        exact = np.zeros((h, w), dtype=np.uint8)
        exact[eligible_y[choose], eligible_x[choose]] = 255
        candidate = exact
    return candidate


def generate_synthetic_part(part: TestPart) -> Path:
    """Create one simulated 800×800 grayscale aluminium-component image.

    The component is placed so that its centroid matches the documented
    Stage-2 pick coordinates.  A controlled number of clustered dark
    pixels represents surface defects at the specified percentage.
    The RNG seed is fixed (202600 + part_id) for reproducibility.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(202600 + part.part_id)
    width_px = int(round(part.width_mm * SCALE_PX_PER_MM))
    height_px = int(round(part.height_mm * SCALE_PX_PER_MM))

    # Place centroid at the documented illustrative pick location.
    cx_px = int(round(ORIGIN[0] + part.expected_pick_x * SCALE_PX_PER_MM))
    cy_px = int(round(ORIGIN[1] - part.expected_pick_y * SCALE_PX_PER_MM))
    x0 = cx_px - width_px // 2
    y0 = cy_px - height_px // 2
    x1 = x0 + width_px
    y1 = y0 + height_px

    if x0 < 2 or y0 < 2 or x1 >= CANVAS - 2 or y1 >= CANVAS - 2:
        raise ValueError(
            f"Part {part.part_id} does not fit on the simulated canvas "
            f"({x0},{y0})→({x1},{y1})."
        )

    # Dark conveyor background + bright aluminium component with mild Gaussian noise.
    base = np.full((CANVAS, CANVAS), 38, dtype=np.uint8)
    noise = rng.normal(0, 1.0, size=(height_px, width_px))
    component = np.clip(205 + noise, 0, 255).astype(np.uint8)
    base[y0:y1, x0:x1] = component

    roi_mask = np.zeros((CANVAS, CANVAS), dtype=np.uint8)
    roi_mask[y0:y1, x0:x1] = 255

    # Paint darker defect pixels so the statistical lower-tail test finds them.
    target_count = int(round(width_px * height_px * part.defect_percent_target / 100.0))
    defect_mask = _make_clustered_defect_mask((CANVAS, CANVAS), roi_mask, target_count, rng)
    defect_values = rng.integers(55, 85, size=int(np.count_nonzero(defect_mask)), dtype=np.uint8)
    base[defect_mask > 0] = defect_values

    out_path = DATA_DIR / f"part_{part.part_id:02d}.png"
    cv2.imwrite(str(out_path), base)
    log.debug("Generated synthetic image -> %s", out_path)
    return out_path


def ensure_sample_images() -> None:
    """Generate all ten synthetic sample images if they do not already exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for part in TEST_PARTS:
        path = DATA_DIR / f"part_{part.part_id:02d}.png"
        if not path.exists():
            generate_synthetic_part(part)
            log.info("Created missing image: %s", path.name)


def regenerate_all_images() -> None:
    """Force-regenerate all ten images (overwrites existing files)."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for part in TEST_PARTS:
        generate_synthetic_part(part)


# ── Inspection pipeline ────────────────────────────────────────────────────────

def inspect_image(image_path: Path, part: TestPart) -> dict[str, Any]:
    """Run the seven-stage inspection pipeline and return a result dictionary.

    Stages:
    1. Load image (acquisition / calibration)
    2. Gaussian blur  (noise reduction)
    3. Otsu thresholding  (binarisation)
    4. Morphological close → open  (mask refinement)
    5. Contour detection + bounding rectangle  (metrology)
    6. Statistical defect detection  (surface quality)
    7. PASS / FAIL decision + pick-coordinate calculation

    Returns a dict with images for every pipeline stage and all numeric
    measurements.  Raises ValueError / RuntimeError on unrecoverable errors.
    """
    original = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if original is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    # ── Stage 2 — Gaussian blur ────────────────────────────────────────────────
    blurred = cv2.GaussianBlur(original, GAUSS_KERNEL, sigmaX=GAUSS_SIGMA)

    # ── Stage 3 — Otsu thresholding ────────────────────────────────────────────
    threshold_value, otsu = cv2.threshold(
        blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )

    # ── Stage 4 — Morphological closing then opening ──────────────────────────
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (MORPH_KERNEL_SIZE, MORPH_KERNEL_SIZE))
    closed = cv2.morphologyEx(otsu, cv2.MORPH_CLOSE, kernel)
    refined = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel)

    # ── Stage 5 — Contour detection + bounding rectangle ─────────────────────
    contours, _ = cv2.findContours(refined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise RuntimeError(
            f"No component contour detected in {image_path.name}. "
            "The image may be blank or corrupted."
        )
    contour = max(contours, key=cv2.contourArea)
    x, y, w_px, h_px = cv2.boundingRect(contour)
    width_mm = w_px / SCALE_PX_PER_MM
    height_mm = h_px / SCALE_PX_PER_MM

    # Centroid from image moments.
    moments = cv2.moments(contour)
    if moments["m00"]:
        cx = moments["m10"] / moments["m00"]
        cy = moments["m01"] / moments["m00"]
    else:
        cx, cy = x + w_px / 2.0, y + h_px / 2.0

    # ── Stage 6 — Surface-defect detection ────────────────────────────────────
    # Use the bounding box as the ROI (axis-aligned rectangle).
    component_roi = np.zeros_like(original)
    component_roi[y:y + h_px, x:x + w_px] = 255
    surface_pixels = original[component_roi > 0]
    mean_surface = float(np.mean(surface_pixels))
    std_surface = float(np.std(surface_pixels))
    defect_cutoff = mean_surface - 2.0 * std_surface
    defective_count = int(np.count_nonzero(surface_pixels < defect_cutoff))
    defect_percent = (defective_count / max(1, len(surface_pixels))) * 100.0

    # ── Stage 7 — PASS/FAIL decision ──────────────────────────────────────────
    width_ok = DIM_MIN_MM - 1e-9 <= width_mm <= DIM_MAX_MM + 1e-9
    height_ok = DIM_MIN_MM - 1e-9 <= height_mm <= DIM_MAX_MM + 1e-9
    defect_ok = defect_percent < MAX_DEFECT_PERCENT
    passed = width_ok and height_ok and defect_ok

    # Illustrative robot pick coordinates (no hardware commands).
    pick_x = (cx - ORIGIN[0]) / SCALE_PX_PER_MM
    pick_y = (ORIGIN[1] - cy) / SCALE_PX_PER_MM
    pick_z = PICK_Z

    # ── Visual overlay images ─────────────────────────────────────────────────
    # Contour + bounding box overlay.
    contour_view = cv2.cvtColor(original, cv2.COLOR_GRAY2RGB)
    cv2.drawContours(contour_view, [contour], -1, (30, 110, 220), 2)
    cv2.rectangle(contour_view, (x, y), (x + w_px - 1, y + h_px - 1), (30, 160, 60), 2)
    cv2.circle(contour_view, (int(round(cx)), int(round(cy))), 6, (220, 70, 30), -1)
    label = f"{width_mm:.1f}x{height_mm:.1f} mm"
    cv2.putText(contour_view, label, (x, max(0, y - 8)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 200, 0), 1, cv2.LINE_AA)

    # Defect highlight overlay.
    defect_view = cv2.cvtColor(original, cv2.COLOR_GRAY2RGB)
    detected_defects = (original < defect_cutoff) & (component_roi > 0)
    defect_view[detected_defects] = (230, 40, 40)
    cv2.rectangle(defect_view, (x, y), (x + w_px - 1, y + h_px - 1), (35, 150, 65), 2)
    defect_label = f"Defects: {defect_percent:.2f}%"
    cv2.putText(defect_view, defect_label, (x, max(0, y - 8)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 200, 0), 1, cv2.LINE_AA)

    # Build failure reason string.
    reasons: list[str] = []
    if not width_ok:
        reasons.append(
            f"Width {width_mm:.2f} mm outside 115–125 mm range"
        )
    if not height_ok:
        reasons.append(
            f"Height {height_mm:.2f} mm outside 115–125 mm range"
        )
    if not defect_ok:
        reasons.append(
            f"Defect area {defect_percent:.3f}% ≥ {MAX_DEFECT_PERCENT:.1f}% threshold"
        )
    failure_reason = "; ".join(reasons) if reasons else "All checks passed"

    result: dict[str, Any] = {
        "part": part.part_id,
        # Pipeline images (all 800×800, grayscale or BGR).
        "image": original,
        "blurred": blurred,
        "otsu": otsu,
        "closed": closed,
        "refined": refined,
        "contour_view": contour_view,
        "defect_view": defect_view,
        "component_roi": component_roi,
        # Measurements (from the actual pipeline).
        "threshold_value": float(threshold_value),
        "width_mm": width_mm,
        "height_mm": height_mm,
        "defect_percent": defect_percent,
        "defect_cutoff": defect_cutoff,
        "mean_surface": mean_surface,
        "std_surface": std_surface,
        "defective_count": defective_count,
        "total_surface_px": len(surface_pixels),
        # Check flags.
        "width_ok": width_ok,
        "height_ok": height_ok,
        "defect_ok": defect_ok,
        "status": "PASS" if passed else "FAIL",
        "failure_reason": failure_reason,
        # Coordinates.
        "pick_x": pick_x,
        "pick_y": pick_y,
        "pick_z": pick_z,
        "centroid_x_px": cx,
        "centroid_y_px": cy,
        "bbox_x": x, "bbox_y": y, "bbox_w": w_px, "bbox_h": h_px,
        # Reference (documented Stage-2 values, not pipeline output).
        "target_defect_percent": part.defect_percent_target,
        "ref_width_mm": part.width_mm,
        "ref_height_mm": part.height_mm,
        "input_path": str(image_path),
    }
    return result


def run_one_part(part_id: int) -> dict[str, Any]:
    """Inspect a single part by ID. Generates image if absent."""
    part = next((p for p in TEST_PARTS if p.part_id == part_id), None)
    if part is None:
        raise ValueError(f"Part ID {part_id} is not in range 1–10.")
    img = DATA_DIR / f"part_{part_id:02d}.png"
    if not img.exists():
        generate_synthetic_part(part)
    return inspect_image(img, part)


def run_batch() -> list[dict[str, Any]]:
    """Inspect all ten parts and return a list of result dicts."""
    results: list[dict[str, Any]] = []
    for part in TEST_PARTS:
        img = DATA_DIR / f"part_{part.part_id:02d}.png"
        if not img.exists():
            generate_synthetic_part(part)
        r = inspect_image(img, part)
        results.append(r)
    return results


# ── Export helpers ─────────────────────────────────────────────────────────────

def save_summary_csv(results: list[dict[str, Any]], path: Path | None = None) -> Path:
    """Write batch results to a CSV file. Returns the file path."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if path is None:
        path = OUTPUT_DIR / "inspection_results.csv"
    fields = [
        "part", "width_mm", "height_mm", "defect_percent",
        "width_ok", "height_ok", "defect_ok", "status",
        "pick_x", "pick_y", "pick_z",
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for r in results:
            writer.writerow({k: r[k] for k in fields})
    log.info("CSV saved -> %s", path)
    return path


def save_summary_json(results: list[dict[str, Any]], path: Path | None = None) -> Path:
    """Write a JSON summary of the batch run. Returns the file path."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if path is None:
        path = OUTPUT_DIR / "inspection_summary.json"
    passed = sum(1 for r in results if r["status"] == "PASS")
    rows = []
    for r in results:
        rows.append({
            "part": r["part"],
            "width_mm": round(r["width_mm"], 2),
            "height_mm": round(r["height_mm"], 2),
            "defect_percent": round(r["defect_percent"], 3),
            "width_ok": r["width_ok"],
            "height_ok": r["height_ok"],
            "defect_ok": r["defect_ok"],
            "status": r["status"],
            "pick_x": round(r["pick_x"], 2),
            "pick_y": round(r["pick_y"], 2),
            "pick_z": r["pick_z"],
            "failure_reason": r["failure_reason"],
        })
    summary = {
        "run_info": {
            "total": len(results),
            "passed": passed,
            "failed": len(results) - passed,
            "scale_px_per_mm": SCALE_PX_PER_MM,
            "dim_range_mm": [DIM_MIN_MM, DIM_MAX_MM],
            "max_defect_percent": MAX_DEFECT_PERCENT,
        },
        "parts": rows,
    }
    with path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    log.info("JSON saved -> %s", path)
    return path


# ── Benchmark ─────────────────────────────────────────────────────────────────

def benchmark(part_id: int = 3, warmup: int = 3, iterations: int = 20) -> dict[str, float]:
    """Measure image-processing time (pipeline only, excludes UI and file I/O).

    Returns a dict with keys: avg_ms, median_ms, fps, iterations.
    """
    part = next(p for p in TEST_PARTS if p.part_id == part_id)
    img_path = DATA_DIR / f"part_{part_id:02d}.png"
    if not img_path.exists():
        generate_synthetic_part(part)

    # Load the image once; we measure only the in-memory processing pipeline.
    original = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
    if original is None:
        raise FileNotFoundError(f"Benchmark image not found: {img_path}")

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (MORPH_KERNEL_SIZE, MORPH_KERNEL_SIZE))

    def _process() -> None:
        blurred = cv2.GaussianBlur(original, GAUSS_KERNEL, sigmaX=GAUSS_SIGMA)
        _, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        closed = cv2.morphologyEx(otsu, cv2.MORPH_CLOSE, kernel)
        refined = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel)
        contours, _ = cv2.findContours(refined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            c = max(contours, key=cv2.contourArea)
            x_, y_, w_, h_ = cv2.boundingRect(c)
            roi = np.zeros_like(original)
            roi[y_:y_ + h_, x_:x_ + w_] = 255
            sp = original[roi > 0]
            mean_s = float(np.mean(sp))
            std_s = float(np.std(sp))
            _ = float(np.count_nonzero(sp < mean_s - 2.0 * std_s)) / max(1, len(sp)) * 100.0

    # Warm-up (exclude from timing).
    for _ in range(warmup):
        _process()

    times: list[float] = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        _process()
        times.append((time.perf_counter() - t0) * 1000.0)  # convert to ms

    avg_ms = float(np.mean(times))
    med_ms = float(np.median(times))
    fps = 1000.0 / avg_ms if avg_ms > 0 else 0.0
    return {"avg_ms": avg_ms, "median_ms": med_ms, "fps": fps, "iterations": iterations}
