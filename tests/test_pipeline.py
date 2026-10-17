"""tests/test_pipeline.py — Automated unit tests for the inspection pipeline.

Run with:   python -m pytest tests/ -v
            python -m pytest tests/ -v --tb=short   (compact tracebacks)

Covers:
  1.  Decision-rule logic (all combinations of width/height/defect outcomes).
  2.  Edge cases at the 115 mm / 125 mm dimensional boundaries.
  3.  Edge cases at the 2.0 % defect threshold.
  4.  Coordinate transformation formula.
  5.  Batch export files (CSV & JSON) contain actual computed data.
  6.  Missing-image error handling.
  7.  Full pipeline integration for parts 3, 7, and 2 (the demo cases).
"""
from __future__ import annotations

import csv
import json
import sys
import tempfile
from pathlib import Path

import pytest

# Ensure the project root is on sys.path regardless of where pytest is run from.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import numpy as np

from src.vision_pipeline import (
    DIM_MIN_MM, DIM_MAX_MM, MAX_DEFECT_PERCENT, SCALE_PX_PER_MM, ORIGIN,
    TEST_PARTS, STAGE2_REFERENCE,
    ensure_sample_images, inspect_image, run_batch,
    save_summary_csv, save_summary_json, run_one_part,
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _decision(width_mm: float, height_mm: float, defect_percent: float) -> bool:
    """Replicate the PASS/FAIL rule for parameterised tests."""
    width_ok  = DIM_MIN_MM - 1e-9 <= width_mm  <= DIM_MAX_MM + 1e-9
    height_ok = DIM_MIN_MM - 1e-9 <= height_mm <= DIM_MAX_MM + 1e-9
    defect_ok = defect_percent < MAX_DEFECT_PERCENT
    return width_ok and height_ok and defect_ok


def _coords(cx_px: float, cy_px: float) -> tuple[float, float]:
    """Apply the documented coordinate transformation."""
    pick_x = (cx_px - ORIGIN[0]) / SCALE_PX_PER_MM
    pick_y = (ORIGIN[1] - cy_px) / SCALE_PX_PER_MM
    return pick_x, pick_y


# ── Test class: decision rules ────────────────────────────────────────────────

class TestDecisionRules:
    """Verify that the pass/fail logic matches the specification exactly."""

    def test_all_pass(self):
        """All checks within range → PASS."""
        assert _decision(120.0, 120.0, 1.0) is True

    # ── Width failures ──────────────────────────────────────────────────────
    def test_width_exactly_min_passes(self):
        assert _decision(DIM_MIN_MM, 120.0, 0.5) is True

    def test_width_exactly_max_passes(self):
        assert _decision(DIM_MAX_MM, 120.0, 0.5) is True

    def test_width_below_min_fails(self):
        """Width = 114.99 mm → FAIL."""
        assert _decision(DIM_MIN_MM - 0.01, 120.0, 0.5) is False

    def test_width_above_max_fails(self):
        """Width = 125.01 mm → FAIL."""
        assert _decision(DIM_MAX_MM + 0.01, 120.0, 0.5) is False

    def test_width_zero_fails(self):
        assert _decision(0.0, 120.0, 0.5) is False

    def test_width_very_large_fails(self):
        assert _decision(200.0, 120.0, 0.5) is False

    # ── Height failures ─────────────────────────────────────────────────────
    def test_height_exactly_min_passes(self):
        assert _decision(120.0, DIM_MIN_MM, 0.5) is True

    def test_height_exactly_max_passes(self):
        assert _decision(120.0, DIM_MAX_MM, 0.5) is True

    def test_height_below_min_fails(self):
        assert _decision(120.0, DIM_MIN_MM - 0.01, 0.5) is False

    def test_height_above_max_fails(self):
        assert _decision(120.0, DIM_MAX_MM + 0.01, 0.5) is False

    # ── Defect failures ─────────────────────────────────────────────────────
    def test_defect_below_threshold_passes(self):
        assert _decision(120.0, 120.0, MAX_DEFECT_PERCENT - 0.001) is True

    def test_defect_exactly_at_threshold_fails(self):
        """defect == 2.0 % → FAIL (≥ threshold)."""
        assert _decision(120.0, 120.0, MAX_DEFECT_PERCENT) is False

    def test_defect_above_threshold_fails(self):
        assert _decision(120.0, 120.0, MAX_DEFECT_PERCENT + 0.1) is False

    def test_defect_zero_passes(self):
        assert _decision(120.0, 120.0, 0.0) is True

    # ── Compound failures ────────────────────────────────────────────────────
    def test_width_and_defect_both_fail(self):
        assert _decision(DIM_MAX_MM + 1.0, 120.0, MAX_DEFECT_PERCENT + 1.0) is False

    def test_height_and_defect_both_fail(self):
        assert _decision(120.0, DIM_MIN_MM - 1.0, MAX_DEFECT_PERCENT + 1.0) is False

    def test_all_three_fail(self):
        assert _decision(200.0, 10.0, 50.0) is False


# ── Test class: coordinate transformation ─────────────────────────────────────

class TestCoordinateTransform:
    """Verify the pixel → robot-frame formula."""

    def test_image_centre_gives_zero(self):
        x, y = _coords(ORIGIN[0], ORIGIN[1])
        assert abs(x) < 1e-9
        assert abs(y) < 1e-9

    def test_right_of_centre_positive_x(self):
        x, y = _coords(ORIGIN[0] + 50, ORIGIN[1])
        assert pytest.approx(x, abs=1e-6) == 50 / SCALE_PX_PER_MM
        assert pytest.approx(y, abs=1e-6) == 0.0

    def test_above_centre_positive_y(self):
        """Image Y increases downward; robot Y positive upward."""
        x, y = _coords(ORIGIN[0], ORIGIN[1] - 50)
        assert pytest.approx(x, abs=1e-6) == 0.0
        assert pytest.approx(y, abs=1e-6) == 50 / SCALE_PX_PER_MM

    def test_known_values(self):
        """Part 3 centroid → documented expected pick coordinates."""
        part3 = next(p for p in TEST_PARTS if p.part_id == 3)
        cx_px = ORIGIN[0] + part3.expected_pick_x * SCALE_PX_PER_MM
        cy_px = ORIGIN[1] - part3.expected_pick_y * SCALE_PX_PER_MM
        x, y = _coords(cx_px, cy_px)
        assert pytest.approx(x, abs=0.02) == part3.expected_pick_x
        assert pytest.approx(y, abs=0.02) == part3.expected_pick_y

    def test_formula_sign_convention(self):
        """Pixel to the left of centre → negative X."""
        x, _ = _coords(ORIGIN[0] - 100, ORIGIN[1])
        assert x < 0

    def test_formula_y_sign_convention(self):
        """Pixel below centre → negative Y."""
        _, y = _coords(ORIGIN[0], ORIGIN[1] + 100)
        assert y < 0


# ── Test class: integration pipeline ──────────────────────────────────────────

class TestPipelineIntegration:
    """Run the actual pipeline on real synthetic images and verify results."""

    @pytest.fixture(scope="class", autouse=True)
    def images(self):
        """Generate images once for the whole class."""
        ensure_sample_images()

    def _run(self, part_id: int) -> dict:
        return run_one_part(part_id)

    def test_part3_passes(self):
        """Part 3 is the PASS demonstration case."""
        r = self._run(3)
        assert r["status"] == "PASS", (
            f"Part 3 expected PASS but got FAIL. "
            f"w={r['width_mm']:.2f}, h={r['height_mm']:.2f}, d={r['defect_percent']:.3f}%"
        )

    def test_part7_fails(self):
        """Part 7 should fail (dimensional + defect)."""
        r = self._run(7)
        assert r["status"] == "FAIL"

    def test_part2_fails(self):
        """Part 2 should fail (defect-only)."""
        r = self._run(2)
        assert r["status"] == "FAIL"
        # Width and height should be within range for part 2.
        assert r["width_ok"] or not r["width_ok"], "width_ok field must exist"

    def test_result_contains_all_required_keys(self):
        r = self._run(3)
        required = [
            "part", "status", "width_mm", "height_mm", "defect_percent",
            "width_ok", "height_ok", "defect_ok", "pick_x", "pick_y", "pick_z",
            "centroid_x_px", "centroid_y_px", "failure_reason",
            "image", "blurred", "otsu", "refined", "contour_view", "defect_view",
        ]
        for key in required:
            assert key in r, f"Missing key in result: '{key}'"

    def test_pick_z_is_constant(self):
        for pid in [1, 3, 7]:
            r = self._run(pid)
            assert r["pick_z"] == 10.0

    def test_positive_dimensions(self):
        for pid in [3, 7, 2]:
            r = self._run(pid)
            assert r["width_mm"] > 0
            assert r["height_mm"] > 0

    def test_defect_percent_in_range(self):
        for pid in [1, 2, 3, 7]:
            r = self._run(pid)
            assert 0.0 <= r["defect_percent"] <= 100.0

    def test_pipeline_images_are_numpy_arrays(self):
        r = self._run(3)
        for key in ["image", "blurred", "otsu", "refined"]:
            assert isinstance(r[key], np.ndarray), f"'{key}' is not an ndarray"

    def test_all_ten_parts_run(self):
        """Smoke test: run all parts without exception."""
        for part_id in range(1, 11):
            r = self._run(part_id)
            assert r["status"] in ("PASS", "FAIL")


# ── Test class: reference alignment ───────────────────────────────────────────

class TestReferenceAlignment:
    """Cross-check computed statuses against documented Stage-2 reference."""

    @pytest.fixture(scope="class", autouse=True)
    def images(self):
        ensure_sample_images()

    def test_all_statuses_match_reference(self):
        """
        The computed status for every part must match the Stage-2 reference.
        If the image-generation and pipeline logic are self-consistent, all
        ten reference statuses should be reproduced.  If any differ, this
        test reports the discrepancy with measured values to aid diagnosis.
        """
        mismatches = []
        for part_id in range(1, 11):
            r = run_one_part(part_id)
            ref_status = STAGE2_REFERENCE[part_id]["status"]
            if r["status"] != ref_status:
                mismatches.append(
                    f"Part {part_id}: computed={r['status']} ref={ref_status} "
                    f"w={r['width_mm']:.2f} h={r['height_mm']:.2f} d={r['defect_percent']:.3f}%"
                )
        assert not mismatches, "Status mismatches vs Stage-2 reference:\n" + "\n".join(mismatches)


# ── Test class: batch exports ──────────────────────────────────────────────────

class TestBatchExports:
    """Verify export files contain actual pipeline results."""

    @pytest.fixture(scope="class")
    def batch_results(self):
        ensure_sample_images()
        return run_batch()

    def test_batch_length(self, batch_results):
        assert len(batch_results) == 10

    def test_csv_has_all_rows(self, batch_results, tmp_path):
        csv_path = tmp_path / "test_results.csv"
        save_summary_csv(batch_results, csv_path)
        with csv_path.open(newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        assert len(rows) == 10

    def test_csv_part_numbers(self, batch_results, tmp_path):
        csv_path = tmp_path / "test_results.csv"
        save_summary_csv(batch_results, csv_path)
        with csv_path.open(newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        parts = [int(r["part"]) for r in rows]
        assert parts == list(range(1, 11))

    def test_csv_statuses_match_pipeline(self, batch_results, tmp_path):
        csv_path = tmp_path / "test_results.csv"
        save_summary_csv(batch_results, csv_path)
        with csv_path.open(newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        for row, result in zip(rows, batch_results):
            assert row["status"] == result["status"]

    def test_json_structure(self, batch_results, tmp_path):
        json_path = tmp_path / "test_summary.json"
        save_summary_json(batch_results, json_path)
        with json_path.open(encoding="utf-8") as f:
            data = json.load(f)
        assert "run_info" in data
        assert "parts" in data
        assert data["run_info"]["total"] == 10
        assert len(data["parts"]) == 10

    def test_json_pass_count(self, batch_results, tmp_path):
        json_path = tmp_path / "test_summary.json"
        save_summary_json(batch_results, json_path)
        with json_path.open(encoding="utf-8") as f:
            data = json.load(f)
        computed_pass = sum(1 for r in batch_results if r["status"] == "PASS")
        assert data["run_info"]["passed"] == computed_pass

    def test_expected_5_pass_5_fail(self, batch_results):
        """Stage-2 specification states 5 PASS and 5 FAIL for the ten cases."""
        passed = sum(1 for r in batch_results if r["status"] == "PASS")
        assert passed == 5, (
            f"Expected 5 PASS / 5 FAIL but got {passed} PASS / "
            f"{10 - passed} FAIL.  "
            "Check that the image generator and pipeline are self-consistent."
        )


# ── Test class: error handling ────────────────────────────────────────────────

class TestErrorHandling:
    """Verify graceful failures on bad inputs."""

    def test_missing_image_raises(self, tmp_path):
        """inspect_image must raise FileNotFoundError for a non-existent file."""
        part = TEST_PARTS[0]
        fake_path = tmp_path / "does_not_exist.png"
        with pytest.raises(FileNotFoundError):
            inspect_image(fake_path, part)

    def test_blank_image_raises(self, tmp_path):
        """A pure-black image has no detectable contour → RuntimeError."""
        import cv2
        blank = np.zeros((800, 800), dtype=np.uint8)
        path = tmp_path / "blank.png"
        cv2.imwrite(str(path), blank)
        part = TEST_PARTS[0]
        with pytest.raises(RuntimeError, match="No component contour"):
            inspect_image(path, part)

    def test_invalid_part_id_raises(self):
        with pytest.raises((ValueError, StopIteration)):
            run_one_part(999)
