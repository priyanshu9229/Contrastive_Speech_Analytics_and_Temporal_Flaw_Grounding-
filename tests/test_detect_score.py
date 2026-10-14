"""
Unit tests for speechflaw.detect, speechflaw.explain, and speechflaw.score
Verifies DTW flaw grounding, causal explainability output, and rubric monotonicity.
"""

import os
import pytest
from speechflaw.features import extract_speech_features
from speechflaw.detect import detect_flaws
from speechflaw.explain import explain_all_flaws
from speechflaw.score import compute_rubric_scores

def test_full_detection_and_scoring_pipeline():
    base_wav = "data/raw/stay_hungry.wav"
    l1_wav = "data/dataset/stay_hungry_L1.wav"
    l5_wav = "data/dataset/stay_hungry_L5.wav"
    l6_wav = "data/dataset/stay_hungry_L6.wav"
    txt = "data/raw/stay_hungry.txt"
    
    assert os.path.exists(base_wav)
    assert os.path.exists(l1_wav)
    assert os.path.exists(l5_wav)
    assert os.path.exists(l6_wav)
    
    base_feat = extract_speech_features(base_wav, use_cache=True)
    l1_feat = extract_speech_features(l1_wav, use_cache=True)
    l5_feat = extract_speech_features(l5_wav, use_cache=True)
    l6_feat = extract_speech_features(l6_wav, use_cache=True)
    
    # 1. Detection on L1 (egregious)
    flaws_l1 = detect_flaws(l1_feat, base_feat)
    assert len(flaws_l1) >= 2, f"Expected multiple flaws detected in L1, got {len(flaws_l1)}"
    
    # 2. Causal Explainability
    explained_l1 = explain_all_flaws(flaws_l1)
    for fl in explained_l1:
        assert "time_span" in fl
        assert "mathematical_rationale" in fl
        assert "perceptual_impact" in fl
        assert "actionable_tip" in fl
        assert len(fl["actionable_tip"]) > 10
        
    # 3. Scoring Monotonicity
    score_l1 = compute_rubric_scores(l1_feat, base_feat, flaws_l1)
    
    flaws_l5 = detect_flaws(l5_feat, base_feat)
    score_l5 = compute_rubric_scores(l5_feat, base_feat, flaws_l5)
    
    flaws_l6 = detect_flaws(l6_feat, base_feat)
    score_l6 = compute_rubric_scores(l6_feat, base_feat, flaws_l6)
    
    # Verify score ordering: L6 > L5 > L1
    assert score_l6["overall"] > score_l5["overall"], f"L6 ({score_l6['overall']}) should exceed L5 ({score_l5['overall']})"
    assert score_l5["overall"] > score_l1["overall"], f"L5 ({score_l5['overall']}) should exceed L1 ({score_l1['overall']})"
    assert score_l6["overall"] >= 90.0, f"Baseline L6 score should be >= 90.0, got {score_l6['overall']}"
    assert score_l1["overall"] <= 60.0, f"Egregious L1 score should be <= 60.0, got {score_l1['overall']}"
