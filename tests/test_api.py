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

def test_analyze_endpoint_with_m4a_audio():
    m4a_path = "data/raw/test_sample.m4a"
    assert os.path.exists(m4a_path)
    
    with open(m4a_path, "rb") as f:
        response = client.post(
            "/analyze",
            files={"participant_audio": ("test_speech.m4a", f, "audio/mp4")},
            data={"baseline_id": "stay_hungry"}
        )
    assert response.status_code == 200
    data = response.json()
    assert "scores" in data
    assert data["scores"]["overall"] >= 80.0
    assert "time_series" in data
    assert data["audio_url"].endswith(".wav")

def test_analyze_endpoint_wer_warning_banner_mismatch():
    """Verifies that an audio with mismatched transcript generates the exact warning string."""
    wav_path = "data/dataset/stay_hungry_L1.wav"
    assert os.path.exists(wav_path)
    
    # Intentionally mismatched transcript (Churchill's beaches speech text against Jobs' stay_hungry audio)
    mismatched_text = open("data/raw/beaches.txt", "r", encoding="utf-8").read()
    
    with open(wav_path, "rb") as f:
        response = client.post(
            "/analyze",
            files={"participant_audio": ("stay_hungry.wav", f, "audio/wav")},
            data={
                "baseline_id": "stay_hungry",
                "transcript": mismatched_text
            }
        )
    assert response.status_code == 200
    data = response.json()
    assert "warning" in data
    assert data["warning"] == "audio does not match the transcript/reference"
    assert "wer" in data
    assert data["wer"] > 0.5

def test_analyze_endpoint_matching_transcript():
    """Verifies that matching transcript has no warning banner."""
    wav_path = "data/dataset/stay_hungry_L5.wav"
    matching_text = open("data/raw/stay_hungry.txt", "r", encoding="utf-8").read()
    
    with open(wav_path, "rb") as f:
        response = client.post(
            "/analyze",
            files={"participant_audio": ("stay_hungry.wav", f, "audio/wav")},
            data={
                "baseline_id": "stay_hungry",
                "transcript": matching_text
            }
        )
    assert response.status_code == 200
    data = response.json()
    assert data.get("warning") is None
    assert data.get("wer", 0.0) <= 0.5
