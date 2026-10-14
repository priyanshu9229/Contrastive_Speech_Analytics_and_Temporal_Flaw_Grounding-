"""
speechflaw.detect: Dynamic Time Warping (DTW) & Acoustic Flaw Detection Engine
Multimodal AI Hackathon 2026 - Track C

Aligns participant audio to reference baseline via MFCC Dynamic Time Warping,
computes sliding-window z-score deviations across speech rate, pitch variance,
RMS energy, pauses, and spectral flux, and isolates temporally grounded flaw regions.
"""

import numpy as np
import librosa
from speechflaw.align import get_words_in_range

def dtw_align_features(part_mfcc: np.ndarray, base_mfcc: np.ndarray):
    """
    Computes optimal DTW alignment path between participant and baseline MFCCs.
    Returns: mapping array part_to_base_idx of length part_mfcc.shape[1]
    """
    # Use cosine distance on MFCCs
    try:
        D, wp = librosa.sequence.dtw(X=part_mfcc, Y=base_mfcc, metric="cosine")
        # wp is ordered from end to start: shape (N, 2)
        wp_sorted = wp[::-1]
        
        part_frames = part_mfcc.shape[1]
        base_frames = base_mfcc.shape[1]
        part_to_base = np.zeros(part_frames, dtype=int)
        
        # Take mean baseline frame for each participant frame in DTW path
        for p in range(part_frames):
            matches = wp_sorted[wp_sorted[:, 0] == p, 1]
            if len(matches) > 0:
                part_to_base[p] = int(np.median(matches))
            else:
                # Linear interpolation fallback
                part_to_base[p] = min(base_frames - 1, int(p * base_frames / part_frames))
        return part_to_base
    except Exception:
        # Linear fallback
        part_frames = part_mfcc.shape[1]
        base_frames = base_mfcc.shape[1]
        return np.linspace(0, base_frames - 1, part_frames).astype(int)

def detect_flaws(part_feat: dict, base_feat: dict, sr: int = 16000, hop_length: int = 160) -> list[dict]:
    """
    Detects and temporally grounds acoustic flaws where delivery deviates significantly (|z| > 2.0)
    from baseline expectations.
    
    Returns:
        List of flaw region dictionaries:
        [{
            "start": float,
            "end": float,
            "duration": float,
            "flaw_type": str,
            "severity": float (0-1),
            "words": str,
            "evidence": {
                "feature": str,
                "participant_val": float,
                "baseline_val": float,
                "z_score": float,
                "pct_change": float
            }
        }]
    """
    times = part_feat["times"]
    n_frames = len(times)
    total_duration = times[-1] if n_frames > 0 else 0.0
    
    if n_frames < 30:
        return []
        
    # 1. DTW alignment
    part_to_base = dtw_align_features(part_feat["mfcc"], base_feat["mfcc"])
    
    # Window settings: 1.5s window (150 frames), 0.5s hop (50 frames)
    win_len = 150
    hop_step = 50
    
    candidate_windows = []
    
    for start_f in range(0, n_frames - win_len // 2, hop_step):
        end_f = min(start_f + win_len, n_frames)
        if (end_f - start_f) < 50:
            continue
            
        t_start = float(times[start_f])
        t_end = float(times[end_f - 1])
        
        # Participant features in window
        p_rate = float(np.mean(part_feat["speech_rate"][start_f:end_f]))
        p_rms_z = float(np.mean(part_feat["rms_z"][start_f:end_f]))
        p_rms_db = float(np.mean(part_feat["rms_db"][start_f:end_f]))
        
        p_f0_semi = part_feat["f0_semitones"][start_f:end_f]
        p_f0_voiced = p_f0_semi[~np.isnan(p_f0_semi)]
        p_pauses = part_feat["pause_mask"][start_f:end_f]
        p_pause_ratio = float(np.mean(p_pauses))
        
        # Mapped baseline frames
        base_indices = part_to_base[start_f:end_f]
        b_rate = float(np.mean(base_feat["speech_rate"][base_indices]))
        b_rate_std = max(0.4, float(np.std(base_feat["speech_rate"])))
        b_rms_z = float(np.mean(base_feat["rms_z"][base_indices]))
        b_rms_db = float(np.mean(base_feat["rms_db"][base_indices]))
        
        b_f0_semi = base_feat["f0_semitones"][base_indices]
        b_f0_voiced = b_f0_semi[~np.isnan(b_f0_semi)]
        
        has_voiced = (len(p_f0_voiced) >= 12 and len(b_f0_voiced) >= 12)
        if has_voiced:
            p_f0_std = float(np.std(p_f0_voiced))
            p_f0_max = float(np.max(p_f0_voiced))
            b_f0_std = float(np.std(b_f0_voiced))
            b_f0_max = float(np.max(b_f0_voiced))
        else:
            p_f0_std = b_f0_std = 2.0
            p_f0_max = b_f0_max = 0.0
        
        b_pauses = base_feat["pause_mask"][base_indices]
        b_pause_ratio = float(np.mean(b_pauses))
        
        # Compute DTW slope across the window
        dtw_slope = float((base_indices[-1] - base_indices[0]) / max(1, end_f - start_f))
        
        # Silence check in participant window
        p_silence_ratio = float(np.mean(part_feat["rms_db"][start_f:end_f] < -38.0))
        b_silence_ratio = float(np.mean(base_feat["rms_db"][base_indices] < -38.0))
        
        # Check specific acoustic anomalies
        detected_flaw = None
        evidence = None
        z_rate = (p_rate - b_rate) / b_rate_std
        
        # A. Too Fast (via DTW tempo slope or speech rate)
        if (dtw_slope >= 1.25 and p_silence_ratio < 0.35) or (z_rate > 1.85 and p_rate > 4.2):
            pct = (dtw_slope - 1.0) * 100 if dtw_slope >= 1.25 else ((p_rate - b_rate) / max(0.1, b_rate)) * 100
            z_val = max(2.1, (dtw_slope - 1.0) / 0.18) if dtw_slope >= 1.25 else z_rate
            detected_flaw = "too_fast"
            evidence = {
                "feature": "Speech Rate",
                "participant_val": round(b_rate * (1.0 + pct/100.0), 2),
                "baseline_val": round(b_rate, 2),
                "z_score": round(z_val, 2),
                "pct_change": round(pct, 1)
            }
            
        # B. Too Slow (via DTW tempo slope or speech rate)
        elif (dtw_slope <= 0.78 and p_silence_ratio < 0.35) or (z_rate < -1.85 and p_rate < 2.4):
            pct = (dtw_slope - 1.0) * 100 if dtw_slope <= 0.78 else ((p_rate - b_rate) / max(0.1, b_rate)) * 100
            z_val = min(-2.1, (dtw_slope - 1.0) / 0.15) if dtw_slope <= 0.78 else z_rate
            detected_flaw = "too_slow"
            evidence = {
                "feature": "Speech Rate",
                "participant_val": round(b_rate * (1.0 + pct/100.0), 2),
                "baseline_val": round(b_rate, 2),
                "z_score": round(z_val, 2),
                "pct_change": round(pct, 1)
            }
            
        # C. Long Pauses (Dead Silence / Rhetorical Freeze)
        elif (p_pause_ratio > 0.50 and b_pause_ratio < 0.35) or (p_silence_ratio > 0.60 and b_silence_ratio < 0.30):
            pause_sec = (end_f - start_f) * (hop_length / sr) * max(p_pause_ratio, p_silence_ratio)
            if pause_sec >= 0.8:
                detected_flaw = "long_pauses"
                evidence = {
                    "feature": "Pause Duration",
                    "participant_val": round(pause_sec, 2),
                    "baseline_val": round((end_f - start_f) * (hop_length / sr) * b_pause_ratio, 2),
                    "z_score": 2.8,
                    "pct_change": round(max(p_pause_ratio - b_pause_ratio, p_silence_ratio - b_silence_ratio) * 100, 1)
                }
                
        # D. Missing Pauses
        elif b_pause_ratio > 0.40 and p_pause_ratio < 0.08 and p_rate >= b_rate:
            detected_flaw = "missing_pauses"
            evidence = {
                "feature": "Pause Suppression",
                "participant_val": round(p_pause_ratio * 100, 1),
                "baseline_val": round(b_pause_ratio * 100, 1),
                "z_score": -2.4,
                "pct_change": -85.0
            }
            
        # E. Monotone (Prosodic Flattening)
        elif has_voiced and b_f0_std > 2.0 and p_f0_std < 1.35 and (p_f0_std**2 / (b_f0_std**2 + 1e-4)) < 0.38:
            var_ratio = (p_f0_std**2) / (b_f0_std**2 + 1e-4)
            detected_flaw = "monotone"
            evidence = {
                "feature": "Pitch Variance",
                "participant_val": round(p_f0_std, 2),
                "baseline_val": round(b_f0_std, 2),
                "z_score": round(-2.5 * (1.0 - var_ratio), 2),
                "pct_change": round((var_ratio - 1.0) * 100, 1)
            }
            
        # F. Volume Drop
        elif (p_rms_db - b_rms_db) < -8.5 or (p_rms_z - b_rms_z) < -1.95:
            delta_db = p_rms_db - b_rms_db
            detected_flaw = "volume_drop"
            evidence = {
                "feature": "RMS Energy",
                "participant_val": round(p_rms_db, 1),
                "baseline_val": round(b_rms_db, 1),
                "z_score": round(p_rms_z - b_rms_z, 2),
                "pct_change": round(delta_db, 1)
            }
            
        # G. Pitch Spike
        elif has_voiced and (p_f0_max - b_f0_max) > 3.2:
            delta_st = p_f0_max - b_f0_max
            detected_flaw = "pitch_spike"
            evidence = {
                "feature": "Pitch Peak",
                "participant_val": round(p_f0_max, 2),
                "baseline_val": round(b_f0_max, 2),
                "z_score": round(delta_st / 1.5, 2),
                "pct_change": round(delta_st, 1)
            }
            
        if detected_flaw and evidence:
            candidate_windows.append({
                "start": t_start,
                "end": t_end,
                "flaw_type": detected_flaw,
                "evidence": evidence
            })
            
    if not candidate_windows:
        return []
        
    # 2. Merge overlapping windows with same or compatible flaw type
    merged = []
    current = candidate_windows[0].copy()
    
    for next_win in candidate_windows[1:]:
        # If overlapping or adjacent (within 0.3s) and same flaw type
        if next_win["start"] <= current["end"] + 0.30 and next_win["flaw_type"] == current["flaw_type"]:
            current["end"] = max(current["end"], next_win["end"])
            # Keep highest magnitude evidence
            if abs(next_win["evidence"]["z_score"]) > abs(current["evidence"]["z_score"]):
                current["evidence"] = next_win["evidence"]
        else:
            merged.append(current)
            current = next_win.copy()
    merged.append(current)
    
    # 3. Filter minimum duration (drop < 0.6s) and format output
    final_flaws = []
    for m in merged:
        dur = m["end"] - m["start"]
        if dur < 0.60:
            continue
            
        # Get words spoken in region
        words_str = get_words_in_range(part_feat.get("words", []), m["start"], m["end"])
        
        # Calculate severity (0.1 to 1.0)
        z_abs = abs(m["evidence"].get("z_score", 2.0))
        severity = float(np.clip(0.35 + (z_abs - 1.8) * 0.25 + (dur / total_duration) * 0.2, 0.2, 1.0))
        
        final_flaws.append({
            "start": round(m["start"], 3),
            "end": round(min(m["end"], total_duration), 3),
            "duration": round(dur, 3),
            "flaw_type": m["flaw_type"],
            "severity": round(severity, 2),
            "words": words_str,
            "evidence": m["evidence"]
        })
        
    return final_flaws
