"""analytics.py — Chart generation for the batch analytics screen.

All charts are built from actual pipeline results at runtime.
No hardcoded statistics are displayed; if no batch has run, an empty
state is returned instead.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")        # non-interactive backend (no popup windows)
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

from src.vision_pipeline import (
    DIM_MIN_MM, DIM_MAX_MM, MAX_DEFECT_PERCENT, NOMINAL_MM,
    PASS_BIN, FAIL_BIN, OUTPUT_DIR,
)

# Colour palette — matches the UI's visual language.
_PASS_COLOR = "#2a9d5c"
_FAIL_COLOR = "#c0392b"
_ACCENT = "#1c4e8a"
_BAND_ALPHA = 0.13
_GRID_ALPHA = 0.22

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.grid": True,
    "grid.alpha": _GRID_ALPHA,
    "grid.linestyle": "--",
})


def _part_colors(results: list[dict[str, Any]]) -> list[str]:
    return [_PASS_COLOR if r["status"] == "PASS" else _FAIL_COLOR for r in results]


def chart_widths(results: list[dict[str, Any]], save: bool = False) -> plt.Figure:
    """Bar chart — measured widths vs acceptance band."""
    ids = [r["part"] for r in results]
    widths = [r["width_mm"] for r in results]
    colors = _part_colors(results)

    fig, ax = plt.subplots(figsize=(8, 4))
    bars = ax.bar(ids, widths, color=colors, width=0.6, zorder=3)
    ax.axhspan(DIM_MIN_MM, DIM_MAX_MM, alpha=_BAND_ALPHA, color=_ACCENT,
               label=f"Acceptance band {DIM_MIN_MM}–{DIM_MAX_MM} mm")
    ax.axhline(NOMINAL_MM, color=_ACCENT, linestyle="--", linewidth=1.2,
               label=f"Nominal {NOMINAL_MM} mm")
    ax.axhline(DIM_MIN_MM, color="#e67e22", linestyle=":", linewidth=1.0)
    ax.axhline(DIM_MAX_MM, color="#e67e22", linestyle=":", linewidth=1.0)

    # Value labels on bars.
    for bar, val in zip(bars, widths):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.3,
                f"{val:.1f}", ha="center", va="bottom", fontsize=7.5)

    ax.set_title("Width Measurements vs. Acceptance Range", fontweight="bold", fontsize=11)
    ax.set_xlabel("Part Number")
    ax.set_ylabel("Width (mm)")
    ax.set_xticks(ids)
    ax.set_ylim(100, 145)
    pass_patch = mpatches.Patch(color=_PASS_COLOR, label="PASS")
    fail_patch = mpatches.Patch(color=_FAIL_COLOR, label="FAIL")
    ax.legend(handles=[pass_patch, fail_patch,
                        mpatches.Patch(color=_ACCENT, alpha=0.3, label=f"Acceptance {DIM_MIN_MM}–{DIM_MAX_MM} mm")],
              fontsize=8, loc="upper right")
    fig.tight_layout()
    if save:
        _save(fig, "chart_widths.png")
    return fig


def chart_heights(results: list[dict[str, Any]], save: bool = False) -> plt.Figure:
    """Bar chart — measured heights vs acceptance band."""
    ids = [r["part"] for r in results]
    heights = [r["height_mm"] for r in results]
    colors = _part_colors(results)

    fig, ax = plt.subplots(figsize=(8, 4))
    bars = ax.bar(ids, heights, color=colors, width=0.6, zorder=3)
    ax.axhspan(DIM_MIN_MM, DIM_MAX_MM, alpha=_BAND_ALPHA, color=_ACCENT,
               label=f"Acceptance band {DIM_MIN_MM}–{DIM_MAX_MM} mm")
    ax.axhline(NOMINAL_MM, color=_ACCENT, linestyle="--", linewidth=1.2,
               label=f"Nominal {NOMINAL_MM} mm")
    ax.axhline(DIM_MIN_MM, color="#e67e22", linestyle=":", linewidth=1.0)
    ax.axhline(DIM_MAX_MM, color="#e67e22", linestyle=":", linewidth=1.0)

    for bar, val in zip(bars, heights):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.3,
                f"{val:.1f}", ha="center", va="bottom", fontsize=7.5)

    ax.set_title("Height Measurements vs. Acceptance Range", fontweight="bold", fontsize=11)
    ax.set_xlabel("Part Number")
    ax.set_ylabel("Height (mm)")
    ax.set_xticks(ids)
    ax.set_ylim(100, 145)
    pass_patch = mpatches.Patch(color=_PASS_COLOR, label="PASS")
    fail_patch = mpatches.Patch(color=_FAIL_COLOR, label="FAIL")
    ax.legend(handles=[pass_patch, fail_patch,
                        mpatches.Patch(color=_ACCENT, alpha=0.3, label=f"Acceptance {DIM_MIN_MM}–{DIM_MAX_MM} mm")],
              fontsize=8, loc="upper right")
    fig.tight_layout()
    if save:
        _save(fig, "chart_heights.png")
    return fig


def chart_defects(results: list[dict[str, Any]], save: bool = False) -> plt.Figure:
    """Bar chart — defect percentage per part with rejection threshold line."""
    ids = [r["part"] for r in results]
    defects = [r["defect_percent"] for r in results]
    colors = _part_colors(results)

    fig, ax = plt.subplots(figsize=(8, 4))
    bars = ax.bar(ids, defects, color=colors, width=0.6, zorder=3)
    ax.axhline(MAX_DEFECT_PERCENT, color="#c0392b", linestyle="--", linewidth=1.5,
               label=f"Rejection threshold {MAX_DEFECT_PERCENT:.1f}%")

    for bar, val in zip(bars, defects):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.03,
                f"{val:.2f}", ha="center", va="bottom", fontsize=7.5)

    ax.set_title("Surface Defect Percentage per Part", fontweight="bold", fontsize=11)
    ax.set_xlabel("Part Number")
    ax.set_ylabel("Defect Area (%)")
    ax.set_xticks(ids)
    y_max = max(defects) * 1.25 if defects else 6
    ax.set_ylim(0, max(y_max, MAX_DEFECT_PERCENT * 1.5))
    pass_patch = mpatches.Patch(color=_PASS_COLOR, label="PASS")
    fail_patch = mpatches.Patch(color=_FAIL_COLOR, label="FAIL")
    ax.legend(handles=[pass_patch, fail_patch,
                        mpatches.Patch(color="#c0392b", label=f"Threshold {MAX_DEFECT_PERCENT:.1f}%")],
              fontsize=8)
    fig.tight_layout()
    if save:
        _save(fig, "chart_defects.png")
    return fig


def chart_scatter(results: list[dict[str, Any]], save: bool = False) -> plt.Figure:
    """Scatter plot — width vs height with acceptance region highlighted."""
    widths = [r["width_mm"] for r in results]
    heights = [r["height_mm"] for r in results]
    colors = _part_colors(results)
    ids = [r["part"] for r in results]

    fig, ax = plt.subplots(figsize=(6, 5))
    ax.add_patch(mpatches.FancyBboxPatch(
        (DIM_MIN_MM, DIM_MIN_MM),
        DIM_MAX_MM - DIM_MIN_MM, DIM_MAX_MM - DIM_MIN_MM,
        boxstyle="square,pad=0", linewidth=1.5,
        edgecolor=_ACCENT, facecolor=_ACCENT, alpha=0.10,
        zorder=1, label=f"Acceptable region {DIM_MIN_MM}–{DIM_MAX_MM} mm",
    ))
    for w, h, c, pid in zip(widths, heights, colors, ids):
        ax.scatter(w, h, color=c, s=80, zorder=3)
        ax.annotate(str(pid), (w, h), textcoords="offset points",
                    xytext=(5, 4), fontsize=8)

    ax.axvline(DIM_MIN_MM, color="#e67e22", linestyle=":", linewidth=0.9)
    ax.axvline(DIM_MAX_MM, color="#e67e22", linestyle=":", linewidth=0.9)
    ax.axhline(DIM_MIN_MM, color="#e67e22", linestyle=":", linewidth=0.9)
    ax.axhline(DIM_MAX_MM, color="#e67e22", linestyle=":", linewidth=0.9)

    ax.set_title("Width vs. Height — Dimensional Scatter", fontweight="bold", fontsize=11)
    ax.set_xlabel("Width (mm)")
    ax.set_ylabel("Height (mm)")
    margin = 8
    all_vals = widths + heights
    lo = min(all_vals) - margin if all_vals else 100
    hi = max(all_vals) + margin if all_vals else 145
    ax.set_xlim(lo, hi)
    ax.set_ylim(lo, hi)
    pass_patch = mpatches.Patch(color=_PASS_COLOR, label="PASS")
    fail_patch = mpatches.Patch(color=_FAIL_COLOR, label="FAIL")
    ax.legend(handles=[pass_patch, fail_patch,
                        mpatches.Patch(color=_ACCENT, alpha=0.3, label="Acceptable region")],
              fontsize=8, loc="upper left")
    fig.tight_layout()
    if save:
        _save(fig, "chart_scatter.png")
    return fig


def chart_coordinates(results: list[dict[str, Any]], save: bool = False) -> plt.Figure:
    """Coordinate plot — calculated pick positions + sorting bin targets."""
    pick_x = [r["pick_x"] for r in results]
    pick_y = [r["pick_y"] for r in results]
    colors = _part_colors(results)
    ids = [r["part"] for r in results]

    fig, ax = plt.subplots(figsize=(7, 5))

    # Sorting bin target markers.
    ax.scatter(*PASS_BIN[:2], marker="*", s=250, color=_PASS_COLOR,
               zorder=4, label=f"PASS bin {PASS_BIN[:2]} mm")
    ax.scatter(*FAIL_BIN[:2], marker="*", s=250, color=_FAIL_COLOR,
               zorder=4, label=f"FAIL bin {FAIL_BIN[:2]} mm")

    # Draw arrow from pick point toward sorting bin.
    for px, py, c, r in zip(pick_x, pick_y, colors, results):
        target = PASS_BIN if r["status"] == "PASS" else FAIL_BIN
        ax.annotate("", xy=(target[0] * 0.18, target[1] * 0.18),
                    xytext=(px, py),
                    arrowprops=dict(arrowstyle="->", color=c, lw=0.8, alpha=0.5))
        ax.scatter(px, py, color=c, s=70, zorder=3)
        ax.annotate(str(ids[pick_x.index(px)]), (px, py),
                    textcoords="offset points", xytext=(5, 4), fontsize=8)

    ax.axvline(0, color="gray", linewidth=0.7, linestyle="--")
    ax.axhline(0, color="gray", linewidth=0.7, linestyle="--")
    ax.set_title("Calculated Pick Positions & Sorting Targets", fontweight="bold", fontsize=11)
    ax.set_xlabel("X (mm) — Robot base frame")
    ax.set_ylabel("Y (mm) — Robot base frame")
    pass_patch = mpatches.Patch(color=_PASS_COLOR, label="PASS pick")
    fail_patch = mpatches.Patch(color=_FAIL_COLOR, label="FAIL pick")
    ax.legend(handles=[pass_patch, fail_patch], fontsize=8)
    fig.tight_layout()
    if save:
        _save(fig, "chart_coordinates.png")
    return fig


def chart_dashboard(results: list[dict[str, Any]], save: bool = True) -> plt.Figure:
    """2×2 batch dashboard combining dimensions, defects, scatter and coordinates."""
    fig, axes = plt.subplots(2, 2, figsize=(14, 9))
    fig.suptitle(
        "Batch Inspection Dashboard — Simulated Test Components",
        fontsize=14, fontweight="bold", y=0.98,
    )

    # -- Widths & Heights combined --
    ids = [r["part"] for r in results]
    widths = [r["width_mm"] for r in results]
    heights = [r["height_mm"] for r in results]
    defects = [r["defect_percent"] for r in results]
    colors = _part_colors(results)
    pick_x = [r["pick_x"] for r in results]
    pick_y = [r["pick_y"] for r in results]

    ax = axes[0, 0]
    ax.axhspan(DIM_MIN_MM, DIM_MAX_MM, alpha=_BAND_ALPHA, color=_ACCENT)
    ax.axhline(NOMINAL_MM, color=_ACCENT, linestyle="--", linewidth=1.0)
    ax.plot(ids, widths, marker="o", color="#1c4e8a", label="Width")
    ax.plot(ids, heights, marker="s", color="#e67e22", label="Height")
    ax.set_title("Measured Dimensions", fontsize=10, fontweight="bold")
    ax.set_xlabel("Part"); ax.set_ylabel("mm")
    ax.set_xticks(ids); ax.set_ylim(100, 145)
    ax.legend(fontsize=8)

    # -- Defects --
    ax = axes[0, 1]
    ax.bar(ids, defects, color=colors, width=0.6, zorder=3)
    ax.axhline(MAX_DEFECT_PERCENT, color="#c0392b", linestyle="--", linewidth=1.4,
               label=f"Threshold {MAX_DEFECT_PERCENT:.1f}%")
    ax.set_title("Surface Defect %", fontsize=10, fontweight="bold")
    ax.set_xlabel("Part"); ax.set_ylabel("Defect area (%)")
    ax.set_xticks(ids)
    ax.set_ylim(0, max(defects) * 1.3 if defects else 6)
    ax.legend(fontsize=8)

    # -- Scatter --
    ax = axes[1, 0]
    ax.add_patch(mpatches.FancyBboxPatch(
        (DIM_MIN_MM, DIM_MIN_MM), DIM_MAX_MM - DIM_MIN_MM, DIM_MAX_MM - DIM_MIN_MM,
        boxstyle="square,pad=0", edgecolor=_ACCENT, facecolor=_ACCENT, alpha=0.10, linewidth=1.0,
    ))
    for w, h, c, pid in zip(widths, heights, colors, ids):
        ax.scatter(w, h, color=c, s=60, zorder=3)
        ax.annotate(str(pid), (w, h), textcoords="offset points", xytext=(4, 3), fontsize=7)
    ax.set_title("Width vs. Height", fontsize=10, fontweight="bold")
    ax.set_xlabel("Width (mm)"); ax.set_ylabel("Height (mm)")

    # -- Coordinates --
    ax = axes[1, 1]
    ax.scatter(PASS_BIN[0], PASS_BIN[1], marker="*", s=180, color=_PASS_COLOR,
               label="PASS bin", zorder=4)
    ax.scatter(FAIL_BIN[0], FAIL_BIN[1], marker="*", s=180, color=_FAIL_COLOR,
               label="FAIL bin", zorder=4)
    for px, py, c, r in zip(pick_x, pick_y, colors, results):
        ax.scatter(px, py, color=c, s=55, zorder=3)
    ax.axvline(0, color="gray", linewidth=0.6, linestyle="--")
    ax.axhline(0, color="gray", linewidth=0.6, linestyle="--")
    ax.set_title("Pick Coordinates", fontsize=10, fontweight="bold")
    ax.set_xlabel("X (mm)"); ax.set_ylabel("Y (mm)")
    ax.legend(fontsize=8)

    fig.tight_layout(rect=[0, 0, 1, 0.96])
    if save:
        _save(fig, "batch_dashboard.png")
    return fig


def _save(fig: plt.Figure, filename: str) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / filename
    fig.savefig(str(path), dpi=150, bbox_inches="tight")
    return path


def save_all_charts(results: list[dict[str, Any]]) -> list[Path]:
    """Save all five charts and return their paths."""
    paths = []
    for fn, chart_fn in [
        ("chart_widths.png",       lambda: chart_widths(results, save=False)),
        ("chart_heights.png",      lambda: chart_heights(results, save=False)),
        ("chart_defects.png",      lambda: chart_defects(results, save=False)),
        ("chart_scatter.png",      lambda: chart_scatter(results, save=False)),
        ("chart_coordinates.png",  lambda: chart_coordinates(results, save=False)),
        ("batch_dashboard.png",    lambda: chart_dashboard(results, save=False)),
    ]:
        fig = chart_fn()
        p = _save(fig, fn)
        plt.close(fig)
        paths.append(p)
    return paths
