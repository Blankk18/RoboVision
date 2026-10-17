"""tests/test_api.py — Automated test suite for FastAPI backend endpoints."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app import app

client = TestClient(app)


def test_api_health():
    """Verify health endpoint returns 200 with complete application metadata."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert len(data["authors"]) >= 1
    assert data["authors"][0]["name"] == "Om Nathwani"
    assert "limits" in data
    assert data["limits"]["nominal_mm"] == 120.0


def test_list_parts():
    """Verify all 10 parts are returned with valid structure."""
    resp = client.get("/api/parts")
    assert resp.status_code == 200
    parts = resp.json()
    assert len(parts) == 10
    assert parts[0]["part_id"] == 1
    assert parts[9]["part_id"] == 10


def test_get_valid_part():
    """Verify individual part metadata lookup."""
    resp = client.get("/api/parts/3")
    assert resp.status_code == 200
    part = resp.json()
    assert part["part_id"] == 3
    assert part["stage2_reference"]["status"] == "PASS"


def test_get_invalid_part():
    """Verify 404 response for non-existent part ID."""
    resp = client.get("/api/parts/99")
    assert resp.status_code == 404


def test_inspect_part_3_pass():
    """Verify single-part inspection returns PASS for Part 3 with all 7 stages."""
    resp = client.post("/api/inspect/3")
    assert resp.status_code == 200
    data = resp.json()
    assert data["part_id"] == 3
    assert data["status"] == "PASS"
    assert data["acceptance"]["width_ok"] is True
    assert data["acceptance"]["height_ok"] is True
    assert data["acceptance"]["defect_ok"] is True
    assert len(data["stages"]) == 7
    for stage in data["stages"]:
        assert "image" in stage
        assert stage["image"].startswith("data:image/png;base64,")


def test_inspect_part_7_fail():
    """Verify single-part inspection returns FAIL for Part 7 (dimensional and defect failure)."""
    resp = client.post("/api/inspect/7")
    assert resp.status_code == 200
    data = resp.json()
    assert data["part_id"] == 7
    assert data["status"] == "FAIL"
    assert (not data["acceptance"]["width_ok"]) or (not data["acceptance"]["defect_ok"])


def test_inspect_part_2_fail():
    """Verify single-part inspection returns FAIL for Part 2 (defect failure)."""
    resp = client.post("/api/inspect/2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["part_id"] == 2
    assert data["status"] == "FAIL"
    assert data["acceptance"]["defect_ok"] is False


def test_inspect_invalid_part_id():
    """Verify invalid part ID handling (status 400)."""
    resp = client.post("/api/inspect/15")
    assert resp.status_code == 400


def test_batch_inspection():
    """Verify batch inspection runs on all 10 parts and returns 5 PASS / 5 FAIL."""
    resp = client.post("/api/batch")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    stats = data["stats"]
    assert stats["total_components"] == 10
    assert stats["passed_components"] == 5
    assert stats["failed_components"] == 5
    assert len(data["parts"]) == 10


def test_latest_batch_endpoint():
    """Verify cached latest batch retrieval."""
    # Since batch was run in previous test, latest should return has_run: true
    resp = client.get("/api/batch/latest")
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_run"] is True
    assert len(data["parts"]) == 10


def test_benchmark_endpoint():
    """Verify benchmark execution returns FPS and latency."""
    resp = client.post("/api/benchmark?part_id=3&warmup=2&iterations=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["avg_ms"] > 0
    assert data["fps"] > 0


def test_csv_export():
    """Verify CSV export returns valid CSV content."""
    resp = client.get("/api/export/csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    content = resp.content.decode("utf-8")
    assert "part,width_mm,height_mm" in content


def test_json_export():
    """Verify JSON export returns valid JSON structure."""
    resp = client.get("/api/export/json")
    assert resp.status_code == 200
    assert "application/json" in resp.headers["content-type"]
    data = resp.json()
    assert "run_info" in data
    assert "parts" in data


def test_dashboard_export():
    """Verify dashboard export returns PNG."""
    resp = client.get("/api/export/dashboard")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert len(resp.content) > 1000
