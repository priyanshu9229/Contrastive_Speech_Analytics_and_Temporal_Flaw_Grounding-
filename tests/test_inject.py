"""
Unit tests for speechflaw.inject
Verifies that all injected flaw regions strictly adhere to file durations,
manifest structure, and non-empty valid audio generation.
"""

import os
import csv
import soundfile as sf
import pytest

MANIFEST_PATH = "data/manifest.csv"

def test_manifest_exists():
    assert os.path.exists(MANIFEST_PATH), "manifest.csv must exist"

def test_manifest_entries_validity():
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))
    
    assert len(reader) > 0, "Manifest should contain entries"

    for row in reader:
        flawed_path = row["flawed_path"]
        assert os.path.exists(flawed_path), f"Flawed file does not exist: {flawed_path}"
        
        info = sf.info(flawed_path)
        duration = info.duration
        
        start_s = float(row["start_s"])
        end_s = float(row["end_s"])
        
        assert start_s >= 0.0, f"start_s must be >= 0: {start_s}"
        assert end_s > start_s, f"end_s must be > start_s: {end_s} vs {start_s}"
        assert start_s < duration, f"start_s {start_s} exceeds file duration {duration} in {flawed_path}"
        assert end_s <= duration + 0.1, f"end_s {end_s} exceeds file duration {duration} in {flawed_path}"
        assert row["flaw_type"] in [
            "too_fast", "too_slow", "missing_pauses", "long_pauses",
            "monotone", "volume_drop", "pitch_spike", "stumble_filler"
        ]

def test_l6_baselines_exist():
    for spk in ["stay_hungry", "dream", "moon", "beaches"]:
        l6_path = f"data/dataset/{spk}_L6.wav"
        assert os.path.exists(l6_path), f"L6 baseline file {l6_path} must exist"
        info = sf.info(l6_path)
        assert info.samplerate == 16000
        assert info.channels == 1
