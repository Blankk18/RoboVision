"""Automated Object Detection and Quality Inspection using Robot Vision.

Educational simulation: generates grayscale square-part images, runs a classical
OpenCV inspection pipeline, and maps image centroids into illustrative robot
base-frame coordinates. It does not control a physical robot.
"""
from __future__ import annotations

import argparse
import csv
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import cv2
    import numpy as np
    import matplotlib.pyplot as plt
except ImportError as exc:  # Friendly message for first-time setup.
    print("A required library is missing.")
    print("Install the libraries by running: py -m pip install -r requirements.txt")
    print(f"Details: {exc}")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
OUTPUT_DIR = ROOT / "outputs"
CANVAS = 800
SCALE_PX_PER_MM = 5.0
ORIGIN = (400.0, 400.0)
NOMINAL_MM = 120.0
TOLERANCE_MM = 5.0
MAX_DEFECT_PERCENT = 2.0  # Reject at >= 2.0%, per the Stage 1/2 report.


@dataclass(frozen=True)
class TestPart:
    part_id: int
    width_mm: float
    height_mm: float
    defect_percent_target: float
    expected_pick_x: float
    expected_pick_y: float


# Cases and measurements are based on the ten examples documented in Stage 2.
TEST_PARTS = [
    TestPart(1, 131.20, 119.40, 0.812, -12.4, 8.6),
    TestPart(2, 118.60, 121.80, 3.241, 7.2, -5.1),
    TestPart(3, 122.40, 117.60, 0.430, 3.8, 11.2),
    TestPart(4, 113.60, 119.20, 0.115, -8.6, 4.4),
    TestPart(5, 121.00, 122.60, 1.720, 9.0, -14.3),
    TestPart(6, 119.40, 118.00, 0.087, -4.2, 7.8),
    TestPart(7, 127.80, 124.20, 4.650, 6.5, -3.2),
    TestPart(8, 120.60, 119.80, 0.320, -1.8, 9.5),
    TestPart(9, 116.20, 121.40, 0.550, 5.3, -6.7),
    TestPart(10, 124.80, 118.60, 2.180, 11.2, 3.1),
]


def make_clustered_defect_mask(shape: tuple[int, int], roi_mask: np.ndarray,
                                target_count: int, rng: np.random.Generator) -> np.ndarray:
    """Create clustered dark synthetic defects with an exact pixel count."""
    h, w = shape
    candidate = np.zeros((h, w), dtype=np.uint8)
    ys, xs = np.where(roi_mask > 0)
    if target_count <= 0 or len(xs) == 0:
        return candidate
    # Draw compact ellipses inside the component, then sample exactly target_count
    # pixels from their union so the synthetic target is reproducible and exact.
    xmin, xmax = int(xs.min()), int(xs.max())
    ymin, ymax = int(ys.min()), int(ys.max())
    max_attempts = max(1000, target_count // 2)
    attempts = 0
    while int(np.count_nonzero(candidate & roi_mask)) < target_count and attempts < max_attempts:
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
        # Rare fallback: fill with random valid ROI pixels, still deterministically.
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
    """Create one simulated grayscale aluminium component image."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(202600 + part.part_id)
    width_px = int(round(part.width_mm * SCALE_PX_PER_MM))
    height_px = int(round(part.height_mm * SCALE_PX_PER_MM))
    # Position each part so its intended centroid maps to the documented pick point.
    cx = int(round(ORIGIN[0] + part.expected_pick_x * SCALE_PX_PER_MM))
    cy = int(round(ORIGIN[1] - part.expected_pick_y * SCALE_PX_PER_MM))
    x0 = cx - width_px // 2
    y0 = cy - height_px // 2
    x1 = x0 + width_px
    y1 = y0 + height_px
    if x0 < 2 or y0 < 2 or x1 >= CANVAS - 2 or y1 >= CANVAS - 2:
        raise ValueError(f"Part {part.part_id} does not fit on the simulated canvas.")

    base = np.full((CANVAS, CANVAS), 38, dtype=np.uint8)  # dark conveyor/background
    # Slight noise gives Gaussian smoothing a meaningful role in the demo.
    noise = rng.normal(0, 1.0, size=(height_px, width_px))
    component = np.clip(205 + noise, 0, 255).astype(np.uint8)
    base[y0:y1, x0:x1] = component
    roi_mask = np.zeros((CANVAS, CANVAS), dtype=np.uint8)
    roi_mask[y0:y1, x0:x1] = 255

    target_count = int(round(width_px * height_px * part.defect_percent_target / 100.0))
    defect_mask = make_clustered_defect_mask((CANVAS, CANVAS), roi_mask, target_count, rng)
    # Defects are darker than the surface, so the statistical lower-tail model detects them.
    base[defect_mask > 0] = rng.integers(55, 85, size=int(np.count_nonzero(defect_mask)), dtype=np.uint8)

    out_path = DATA_DIR / f"part_{part.part_id:02d}.png"
    cv2.imwrite(str(out_path), base)
    return out_path


def ensure_sample_images() -> None:
    """Generate all sample images from the supplied test scenario."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for part in TEST_PARTS:
        generate_synthetic_part(part)


def inspect_image(image_path: Path, part: TestPart) -> dict[str, Any]:
    """Run acquisition/calibration, smoothing, Otsu, morphology, metrology and scoring."""
    original = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if original is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")

    blurred = cv2.GaussianBlur(original, (5, 5), sigmaX=1.4)
    threshold_value, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    closed = cv2.morphologyEx(otsu, cv2.MORPH_CLOSE, kernel)
    refined = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(refined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise RuntimeError(f"No component contour detected in {image_path.name}.")
    contour = max(contours, key=cv2.contourArea)
    x, y, w_px, h_px = cv2.boundingRect(contour)
    width_mm = w_px / SCALE_PX_PER_MM
    height_mm = h_px / SCALE_PX_PER_MM

    moments = cv2.moments(contour)
    if moments["m00"]:
        cx = moments["m10"] / moments["m00"]
        cy = moments["m01"] / moments["m00"]
    else:
        cx, cy = x + w_px / 2.0, y + h_px / 2.0

    # The simulated components are axis-aligned rectangles. Use the measured
    # bounding box as the part ROI so internal dark marks remain included.
    component_roi = np.zeros_like(original)
    component_roi[y:y + h_px, x:x + w_px] = 255
    surface_pixels = original[component_roi > 0]
    mean_surface = float(np.mean(surface_pixels))
    std_surface = float(np.std(surface_pixels))
    defect_cutoff = mean_surface - 2.0 * std_surface
    defective_count = int(np.count_nonzero(surface_pixels < defect_cutoff))
    defect_percent = (defective_count / max(1, len(surface_pixels))) * 100.0

    width_ok = abs(width_mm - NOMINAL_MM) <= TOLERANCE_MM + 1e-9
    height_ok = abs(height_mm - NOMINAL_MM) <= TOLERANCE_MM + 1e-9
    defect_ok = defect_percent < MAX_DEFECT_PERCENT
    passed = width_ok and height_ok and defect_ok

    # Convert image coordinates to an illustrative robot base-frame coordinate.
    pick_x = (cx - ORIGIN[0]) / SCALE_PX_PER_MM
    pick_y = (ORIGIN[1] - cy) / SCALE_PX_PER_MM
    pick_z = 10.0

    # Visual overlays.
    contour_view = cv2.cvtColor(original, cv2.COLOR_GRAY2RGB)
    cv2.drawContours(contour_view, [contour], -1, (30, 110, 220), 2)
    cv2.rectangle(contour_view, (x, y), (x + w_px - 1, y + h_px - 1), (30, 160, 60), 2)
    cv2.circle(contour_view, (int(round(cx)), int(round(cy))), 6, (220, 70, 30), -1)

    defect_view = cv2.cvtColor(original, cv2.COLOR_GRAY2RGB)
    # Highlight pixels classified as defects within the component ROI.
    detected_defects = (original < defect_cutoff) & (component_roi > 0)
    defect_view[detected_defects] = (230, 40, 40)
    cv2.rectangle(defect_view, (x, y), (x + w_px - 1, y + h_px - 1), (35, 150, 65), 2)

    result = {
        "part": part.part_id,
        "image": original,
        "blurred": blurred,
        "otsu": otsu,
        "closed": closed,
        "refined": refined,
        "contour_view": contour_view,
        "defect_view": defect_view,
        "component_roi": component_roi,
        "threshold_value": float(threshold_value),
        "width_mm": width_mm,
        "height_mm": height_mm,
        "defect_percent": defect_percent,
        "defect_cutoff": defect_cutoff,
        "mean_surface": mean_surface,
        "std_surface": std_surface,
        "width_ok": width_ok,
        "height_ok": height_ok,
        "defect_ok": defect_ok,
        "status": "PASS" if passed else "FAIL",
        "pick_x": pick_x,
        "pick_y": pick_y,
        "pick_z": pick_z,
        "centroid_x_px": cx,
        "centroid_y_px": cy,
        "target_defect_percent": part.defect_percent_target,
        "input_path": str(image_path),
    }
    return result


def save_pipeline_figure(result: dict[str, Any], show: bool = True) -> Path:
    """Save and optionally display the pipeline and final classification."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    part_id = result["part"]
    fig, axes = plt.subplots(2, 4, figsize=(14, 7.5))
    fig.suptitle(f"Robot Vision Inspection — Part {part_id:02d} — {result['status']}", fontsize=15, fontweight="bold")
    items = [
        ("Input image", result["image"], "gray"),
        ("1. Gaussian blur", result["blurred"], "gray"),
        (f"2. Otsu threshold ({result['threshold_value']:.0f})", result["otsu"], "gray"),
        ("3. Morphological closing", result["closed"], "gray"),
        ("4. Refined mask", result["refined"], "gray"),
        ("5. Contour + bounding box", result["contour_view"], None),
        ("6. Defect pixels highlighted", result["defect_view"], None),
    ]
    for ax, (title, img, cmap) in zip(axes.flat[:7], items):
        ax.imshow(img, cmap=cmap, vmin=0 if cmap == "gray" else None, vmax=255 if cmap == "gray" else None)
        ax.set_title(title, fontsize=9)
        ax.axis("off")
    ax = axes.flat[7]
    ax.axis("off")
    status_color = "#23794b" if result["status"] == "PASS" else "#b33434"
    text_block = (
        f"STATUS: {result['status']}\n\n"
        f"Width:  {result['width_mm']:.2f} mm  ({'OK' if result['width_ok'] else 'FAIL'})\n"
        f"Height: {result['height_mm']:.2f} mm  ({'OK' if result['height_ok'] else 'FAIL'})\n"
        f"Defects: {result['defect_percent']:.3f}%  ({'OK' if result['defect_ok'] else 'FAIL'})\n\n"
        f"Pick target (illustrative):\n"
        f"X = {result['pick_x']:+.2f} mm\n"
        f"Y = {result['pick_y']:+.2f} mm\n"
        f"Z = {result['pick_z']:.1f} mm\n\n"
        f"Rules: size 115–125 mm\nDefects < {MAX_DEFECT_PERCENT:.1f}%"
    )
    ax.text(0.04, 0.95, text_block, va="top", ha="left", fontsize=10, linespacing=1.55,
            bbox={"boxstyle": "round,pad=0.7", "facecolor": "white", "edgecolor": status_color, "linewidth": 2})
    ax.set_title("7. Final decision", fontsize=9)
    fig.tight_layout(rect=(0, 0, 1, 0.94))
    out_path = OUTPUT_DIR / f"part_{part_id:02d}_pipeline.png"
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    if show:
        plt.show()
    else:
        plt.close(fig)
    return out_path


def save_summary_csv(results: list[dict[str, Any]]) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / "inspection_results.csv"
    fields = ["part", "width_mm", "height_mm", "defect_percent", "width_ok", "height_ok", "defect_ok", "status", "pick_x", "pick_y", "pick_z"]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for r in results:
            row = {key: r[key] for key in fields}
            writer.writerow(row)
    return path


def save_dashboard(results: list[dict[str, Any]], show: bool = True) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ids = [r["part"] for r in results]
    defects = [r["defect_percent"] for r in results]
    widths = [r["width_mm"] for r in results]
    heights = [r["height_mm"] for r in results]
    statuses = [r["status"] for r in results]
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.8))
    ax = axes[0]
    ax.axhspan(115, 125, alpha=0.14, label="Accepted size range (115–125 mm)")
    ax.axhline(120, linestyle="--", linewidth=1, label="Nominal 120 mm")
    ax.plot(ids, widths, marker="o", label="Width")
    ax.plot(ids, heights, marker="s", label="Height")
    ax.set_title("Measured dimensions")
    ax.set_xlabel("Part ID")
    ax.set_ylabel("mm")
    ax.set_xticks(ids)
    ax.grid(alpha=0.2)
    ax.legend(fontsize=8)

    ax = axes[1]
    bar_colors = ["#31875a" if s == "PASS" else "#bd4545" for s in statuses]
    ax.bar(ids, defects, color=bar_colors)
    ax.axhline(MAX_DEFECT_PERCENT, color="#282828", linestyle="--", label="Reject at 2.0%")
    ax.set_title("Surface defect percentage")
    ax.set_xlabel("Part ID")
    ax.set_ylabel("Defect area (%)")
    ax.set_xticks(ids)
    ax.grid(axis="y", alpha=0.2)
    ax.legend(fontsize=8)
    fig.suptitle("Batch validation summary — simulated test cases", fontsize=14, fontweight="bold")
    fig.tight_layout()
    out_path = OUTPUT_DIR / "batch_dashboard.png"
    fig.savefig(out_path, dpi=160, bbox_inches="tight")
    if show:
        plt.show()
    else:
        plt.close(fig)
    return out_path


def print_result(r: dict[str, Any]) -> None:
    print("\n" + "=" * 58)
    print(f"PART {r['part']:02d} — {r['status']}")
    print("=" * 58)
    print(f"Measured width        : {r['width_mm']:.2f} mm  -> {'PASS' if r['width_ok'] else 'FAIL'}")
    print(f"Measured height       : {r['height_mm']:.2f} mm  -> {'PASS' if r['height_ok'] else 'FAIL'}")
    print(f"Detected defect area  : {r['defect_percent']:.3f}% -> {'PASS' if r['defect_ok'] else 'FAIL'}")
    print(f"Centroid (pixels)     : ({r['centroid_x_px']:.2f}, {r['centroid_y_px']:.2f})")
    print(f"Calculated pick target: X={r['pick_x']:+.2f} mm, Y={r['pick_y']:+.2f} mm, Z={r['pick_z']:.1f} mm")
    print("Note: the robot coordinates are simulated targets; no physical robot is controlled.")


def run_one(part_id: int, show: bool = True) -> dict[str, Any]:
    part = next((p for p in TEST_PARTS if p.part_id == part_id), None)
    if part is None:
        raise ValueError("Part ID must be between 1 and 10.")
    img = DATA_DIR / f"part_{part_id:02d}.png"
    if not img.exists():
        generate_synthetic_part(part)
    result = inspect_image(img, part)
    print_result(result)
    out_path = save_pipeline_figure(result, show=show)
    print(f"Pipeline figure saved to: {out_path}")
    return result


def run_batch(show: bool = True) -> list[dict[str, Any]]:
    results = []
    for part in TEST_PARTS:
        img = DATA_DIR / f"part_{part.part_id:02d}.png"
        if not img.exists():
            generate_synthetic_part(part)
        r = inspect_image(img, part)
        results.append(r)
    csv_path = save_summary_csv(results)
    dashboard = save_dashboard(results, show=show)
    print("\nBATCH SUMMARY — SYNTHETIC TEST IMAGES")
    print("ID | Width (mm) | Height (mm) | Defects (%) | Status")
    print("---|------------|-------------|-------------|-------")
    for r in results:
        print(f"{r['part']:>2} | {r['width_mm']:>10.2f} | {r['height_mm']:>11.2f} | {r['defect_percent']:>11.3f} | {r['status']}")
    passed = sum(r["status"] == "PASS" for r in results)
    failed = len(results) - passed
    print(f"\nPASS: {passed}    FAIL: {failed}    Total: {len(results)}")
    print(f"CSV saved to: {csv_path}")
    print(f"Dashboard saved to: {dashboard}")
    print("These are simulated examples, not physical factory measurements.")
    return results


def interactive_menu() -> None:
    print("\nAUTOMATED OBJECT DETECTION & QUALITY INSPECTION USING ROBOT VISION")
    print("Educational simulation | synthetic grayscale components | OpenCV")
    print("Choose a test case or run the entire batch.")
    while True:
        choice = input("\nEnter part number 1-10, B for batch analytics, or Q to quit: ").strip().lower()
        if choice == "q":
            print("Done. Output files are in the outputs folder.")
            break
        if choice == "b":
            run_batch(show=True)
            continue
        try:
            part_id = int(choice)
            if 1 <= part_id <= 10:
                run_one(part_id, show=True)
            else:
                print("Enter a number from 1 to 10, B, or Q.")
        except ValueError:
            print("Enter a number from 1 to 10, B, or Q.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulated robot-vision quality inspection demo")
    parser.add_argument("--part", type=int, help="Run one test part (1 to 10)")
    parser.add_argument("--batch", action="store_true", help="Run all ten test cases and save a CSV/dashboard")
    parser.add_argument("--no-show", action="store_true", help="Save figures without opening plot windows")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ensure_sample_images()
    show = not args.no_show
    if args.part is not None:
        run_one(args.part, show=show)
    elif args.batch:
        run_batch(show=show)
    else:
        interactive_menu()


if __name__ == "__main__":
    main()
