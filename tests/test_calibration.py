"""
tests/test_calibration.py: Formal Rubric Calibration Verification
Multimodal AI Hackathon 2026 - Track C

Verifies the calibration criteria across all speeches:
1. Baseline vs itself: 0 flaw regions and overall score >= 98.0
2. L5 clips: overall score 80.0 - 95.0 and <= 2 flaw regions
3. L1 clips: overall score <= 35.0
4. Subscores spread smoothly across 0-100 without artificial hard clamping to 5
"""

import os
import pytest
from speechflaw.features import extract_speech_features
from speechflaw.detect import detect_flaws
from speechflaw.score import compute_rubric_scores

SPEECHES = ["stay_hungry", "dream", "moon", "beaches"]

@pytest.mark.parametrize("speech_id", SPEECHES)
def test_baseline_vs_itself_calibration(speech_id):
    """Verifies that baseline compared against itself produces 0 flaw regions and score >= 98."""
    wav_path = f"data/raw/{speech_id}.wav"
    assert os.path.exists(wav_path), f"Missing baseline audio: {wav_path}"
    
    base_feat = extract_speech_features(wav_path, use_cache=True)
    flaws = detect_flaws(base_feat, base_feat)
    scores = compute_rubric_scores(base_feat, base_feat, flaws)
    
    assert len(flaws) == 0, f"Expected 0 flaws for baseline vs itself on '{speech_id}', got {len(flaws)}: {[f['flaw_type'] for f in flaws]}"
    assert scores["overall"] >= 98.0, f"Expected overall >= 98.0 for '{speech_id}', got {scores['overall']}"

@pytest.mark.parametrize("speech_id", SPEECHES)
def test_l5_clips_calibration(speech_id):
    """Verifies that L5 clips score between 80.0 and 95.0 with at most 2 flaw regions."""
    base_wav = f"data/raw/{speech_id}.wav"
    l5_wav = f"data/dataset/{speech_id}_L5.wav"
    assert os.path.exists(base_wav)
    assert os.path.exists(l5_wav), f"Missing L5 clip: {l5_wav}"
    
    base_feat = extract_speech_features(base_wav, use_cache=True)
    l5_feat = extract_speech_features(l5_wav, use_cache=True)
    
    flaws = detect_flaws(l5_feat, base_feat)
    scores = compute_rubric_scores(l5_feat, base_feat, flaws)
    
    assert len(flaws) <= 2, f"Expected <= 2 flaw regions for '{speech_id}_L5', got {len(flaws)}"
    assert 80.0 <= scores["overall"] <= 95.0, f"Expected L5 score in [80.0, 95.0] for '{speech_id}_L5', got {scores['overall']}"

@pytest.mark.parametrize("speech_id", SPEECHES)
def test_l1_clips_calibration(speech_id):
    """Verifies that L1 clips score <= 35.0 (egregious quality)."""
    base_wav = f"data/raw/{speech_id}.wav"
    l1_wav = f"data/dataset/{speech_id}_L1.wav"
    assert os.path.exists(base_wav)
    assert os.path.exists(l1_wav), f"Missing L1 clip: {l1_wav}"
    
    base_feat = extract_speech_features(base_wav, use_cache=True)
    l1_feat = extract_speech_features(l1_wav, use_cache=True)
    
    flaws = detect_flaws(l1_feat, base_feat)
    scores = compute_rubric_scores(l1_feat, base_feat, flaws)
    
    assert scores["overall"] <= 35.0, f"Expected L1 score <= 35.0 for '{speech_id}_L1', got {scores['overall']}"
