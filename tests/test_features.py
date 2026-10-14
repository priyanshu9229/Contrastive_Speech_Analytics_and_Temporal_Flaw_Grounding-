"""
Unit tests for speechflaw.align and speechflaw.features
Validates synthetic signal feature extraction, semitone pitch normalization,
and forced alignment.
"""

import os
import tempfile
import numpy as np
import soundfile as sf
import pytest

from speechflaw.align import align_transcript, count_syllables
from speechflaw.features import extract_speech_features

def test_count_syllables():
    assert count_syllables("freedom") == 2
    assert count_syllables("opportunity") >= 5
    assert count_syllables("dream") == 1
    assert count_syllables("unpunctuated") >= 4

def test_features_on_synthetic_signal():
    sr = 16000
    duration = 2.0
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    
    # 220 Hz sine wave + quiet white noise
    sine = 0.5 * np.sin(2 * np.pi * 220 * t)
    noise = np.random.normal(0, 0.01, len(t))
    signal = sine + noise
    
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        sf.write(tmp.name, signal, sr)
        tmp_path = tmp.name
        
    try:
        transcript = "This is a synthetic speech test"
        feat = extract_speech_features(tmp_path, transcript=transcript, use_cache=False)
        
        # Validate time series structure
        assert "times" in feat
        assert "f0" in feat
        assert "f0_semitones" in feat
        assert "rms_z" in feat
        assert "mfcc" in feat
        assert "spectral_flux" in feat
        assert "speech_rate" in feat
        assert "hnr" in feat
        
        # Assert shapes match
        n_frames = len(feat["times"])
        assert len(feat["rms_z"]) == n_frames
        assert feat["mfcc"].shape[1] == n_frames
        assert feat["mfcc"].shape[0] == 13
        assert len(feat["spectral_flux"]) == n_frames
        
        # Fundamental frequency around 220 Hz
        voiced = feat["f0"][~np.isnan(feat["f0"])]
        assert len(voiced) > 0
        median_f0 = np.median(voiced)
        assert 210.0 <= median_f0 <= 230.0, f"Expected ~220Hz, got {median_f0}"
        
        # Semitone median should be around 0.0 st
        voiced_semi = feat["f0_semitones"][~np.isnan(feat["f0_semitones"])]
        assert abs(np.median(voiced_semi)) < 0.1
        
        # Test forced alignment
        words = feat["words"]
        assert len(words) == len(transcript.split())
        for w in words:
            assert w["start"] >= 0.0
            assert w["end"] > w["start"]
            assert w["end"] <= duration + 0.1
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
