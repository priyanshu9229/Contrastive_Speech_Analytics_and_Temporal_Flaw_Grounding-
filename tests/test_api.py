"""
Unit tests for api.main FastAPI endpoints
Validates /health, /baselines, /demo, /analyze, and error handling for bad formats.
"""

import os
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data

def test_baselines_endpoint():
    response = client.get("/baselines")
    assert response.status_code == 200
    baselines = response.json()
    assert len(baselines) >= 4
    for b in baselines:
        assert "id" in b
        assert "title" in b
        assert "speaker" in b
        assert "duration" in b
        assert "transcript" in b

def test_demo_endpoint():
    response = client.get("/demo")
    assert response.status_code == 200
    data = response.json()
    assert "scores" in data
    assert "overall" in data["scores"]
    assert "flaw_regions" in data
    assert "time_series" in data
    assert "participant" in data["time_series"]
    assert "baseline" in data["time_series"]
    assert len(data["flaw_regions"]) > 0

def test_analyze_endpoint_with_valid_audio():
    wav_path = "data/dataset/stay_hungry_L5.wav"
    assert os.path.exists(wav_path)
    
    with open(wav_path, "rb") as f:
        response = client.post(
            "/analyze",
            files={"participant_audio": ("test.wav", f, "audio/wav")},
            data={"baseline_id": "stay_hungry"}
        )
    assert response.status_code == 200
    data = response.json()
    assert data["scores"]["overall"] >= 75.0
    assert "time_series" in data

def test_analyze_unsupported_format_error():
    response = client.post(
        "/analyze",
        files={"participant_audio": ("bad.exe", b"not audio", "application/octet-stream")},
        data={"baseline_id": "stay_hungry"}
    )
    assert response.status_code == 400
    assert "Unsupported audio format" in response.json()["detail"]
