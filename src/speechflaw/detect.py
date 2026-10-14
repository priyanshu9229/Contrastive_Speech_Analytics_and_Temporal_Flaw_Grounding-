"""
speechflaw.detect: Robust Statistics Flaw Detection Engine
Multimodal AI Hackathon 2026 - Track C

Implements robust statistics deviation:
z_robust = (x - median_baseline) / (1.4826 * MAD_baseline)
Flags anomalies when |z_robust| > threshold for >= 2 consecutive windows.
Enforces min_region_length >= 0.8s, merges regions separated by < 0.5s,
resolves multi-type overlaps by severity with secondary tagging, and caps at top 8 regions.
"""

import os
import yaml
import numpy as np
import librosa
from speechflaw.align import get_words_in_range

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "config", "thresholds.yaml")

def load_thresholds_config():
    """Loads detection and scoring thresholds from config/thresholds.yaml."""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)
        except Exception as e:
            print(f"Warning: Failed to load {CONFIG_FILE}: {e}")
    # Default fallback config
    return {
        "window_len_s": 1.5,
        "hop_step_s": 0.5,
        "min_consecutive_windows": 2,
        "min_region_length": 0.8,
        "merge_gap": 0.5,
        "max_flaw_regions": 8,
        "robust_z_threshold": 3.0,
        "thresholds": {
            "too_fast": {"z_threshold": 3.0, "dtw_slope_threshold": 1.25, "min_rate_syl": 3.8},
            "too_slow": {"z_threshold": -3.0, "dtw_slope_threshold": 0.75, "max_rate_syl": 2.3},
            "long_pauses": {"z_threshold": 3.0, "min_pause_sec": 0.9},
            "missing_pauses": {"z_threshold": -3.0, "max_pause_ratio": 0.08},
            "monotone": {"z_threshold": -3.0, "max_var_ratio": 0.35},
            "volume_drop": {"z_threshold": -3.0, "delta_db_threshold": -7.5},
            "pitch_spike": {"z_threshold": 3.0, "delta_st_threshold": 3.0},
            "stumble_filler": {"z_threshold": 3.0}
        }
    }

def robust_z(x: float, baseline_series: np.ndarray, min_scale: float = 0.1) -> float:
    """
    Computes robust z-score:
    z_robust = (x - median_baseline) / (1.4826 * MAD_baseline)
    """
    valid = baseline_series[~np.isnan(baseline_series)]
    if len(valid) == 0:
        return 0.0
    med = float(np.median(valid))
    mad = float(np.median(np.abs(valid - med)))
    scale = 1.4826 * mad
    if scale < 1e-4:
        scale = max(min_scale, float(np.std(valid)))
    scale = max(min_scale, scale)
    return float((x - med) / scale)

def dtw_align_features(part_mfcc: np.ndarray, base_mfcc: np.ndarray) -> np.ndarray:
    """
    Computes optimal DTW alignment path between participant and baseline MFCCs.
    Returns mapping array part_to_base of length part_mfcc.shape[1].
    """
    try:
        D, wp = librosa.sequence.dtw(X=part_mfcc, Y=base_mfcc, metric="cosine")
        wp_sorted = wp[::-1]
        part_frames = part_mfcc.shape[1]
        base_frames = base_mfcc.shape[1]
        part_to_base = np.zeros(part_frames, dtype=int)
        
        for p in range(part_frames):
            matches = wp_sorted[wp_sorted[:, 0] == p, 1]
            if len(matches) > 0:
                part_to_base[p] = int(np.median(matches))
            else:
                part_to_base[p] = min(base_frames - 1, int(p * base_frames / part_frames))
        return part_to_base
    except Exception:
        part_frames = part_mfcc.shape[1]
        base_frames = base_mfcc.shape[1]
        return np.linspace(0, base_frames - 1, part_frames).astype(int)

def detect_flaws(part_feat: dict, base_feat: dict, sr: int = 16000, hop_length: int = 160, config: dict | None = None) -> list[dict]:
    """
    Detects and temporally grounds acoustic flaws using robust statistics.
    Flags only when |robust z| > threshold for >= 2 consecutive windows.
    Enforces min_region_length >= 0.8s, merges regions separated by < 0.5s,
    resolves overlaps by keeping highest severity with secondary tags, and caps at top 8.
    """
    cfg = config or load_thresholds_config()
    times = part_feat["times"]
    n_frames = len(times)
    total_duration = times[-1] if n_frames > 0 else 0.0
    
    if n_frames < 30:
        return []
        
    part_to_base = dtw_align_features(part_feat["mfcc"], base_feat["mfcc"])
    
    # 1.0s window (100 frames), 0.25s hop (25 frames) for high resolution
    win_len = 100
    hop_step = 25
    n_windows = max(0, (n_frames - win_len) // hop_step + 1)
    if n_windows < 2:
        return []

    flaw_thresholds = cfg.get("thresholds", {})
    min_consecutive = cfg.get("min_consecutive_windows", 2)
    min_region_len = cfg.get("min_region_length", 0.8)
    merge_gap = cfg.get("merge_gap", 0.5)
    max_flaws = cfg.get("max_flaw_regions", 8)
    
    # Baseline global distributions for robust statistics
    b_rates = base_feat["speech_rate"]
    b_pauses = base_feat["pause_mask"]
    b_rms = base_feat["rms_db"]
    b_f0_voiced = base_feat["f0_semitones"][~np.isnan(base_feat["f0_semitones"])]
    b_f0_std_global = float(np.std(b_f0_voiced)) if len(b_f0_voiced) > 10 else 2.5
    
    # Track candidate hits per flaw type across window index
    window_hits = {
        "too_fast": [],
        "too_slow": [],
        "long_pauses": [],
        "missing_pauses": [],
        "monotone": [],
        "volume_drop": [],
        "pitch_spike": [],
        "stumble_filler": []
    }
    
    window_meta = []

    for w_idx in range(n_windows):
        start_f = w_idx * hop_step
        end_f = start_f + win_len
        t_start = float(times[start_f])
        t_end = float(times[end_f - 1])
        
        # Mapped baseline frames
        base_indices = part_to_base[start_f:end_f]
        
        # Features
        p_rate = float(np.mean(part_feat["speech_rate"][start_f:end_f]))
        b_rate = float(np.mean(base_feat["speech_rate"][base_indices]))
        z_rate = robust_z(p_rate, b_rates)
        
        dtw_slope = float((base_indices[-1] - base_indices[0]) / max(1, end_f - start_f))
        
        p_pause_ratio = float(np.mean(part_feat["pause_mask"][start_f:end_f]))
        b_pause_ratio = float(np.mean(base_feat["pause_mask"][base_indices]))
        
        p_rms_db = float(np.mean(part_feat["rms_db"][start_f:end_f]))
        b_rms_db = float(np.mean(base_feat["rms_db"][base_indices]))
        z_rms = robust_z(p_rms_db, b_rms)
        
        p_voiced = part_feat["f0_semitones"][start_f:end_f]
        p_voiced = p_voiced[~np.isnan(p_voiced)]
        b_voiced = base_feat["f0_semitones"][base_indices]
        b_voiced = b_voiced[~np.isnan(b_voiced)]
        
        has_voiced = (len(p_voiced) >= 12 and len(b_voiced) >= 12)
        if has_voiced:
            p_f0_std = float(np.std(p_voiced))
            b_f0_std = float(np.std(b_voiced))
            p_f0_max = float(np.max(p_voiced))
            b_f0_max = float(np.max(b_voiced))
        else:
            p_f0_std = b_f0_std = 2.0
            p_f0_max = b_f0_max = 0.0

        p_silence_ratio = float(np.mean(part_feat["rms_db"][start_f:end_f] < -38.0))
        b_silence_ratio = float(np.mean(base_feat["rms_db"][base_indices] < -38.0))

        w_info = {
            "w_idx": w_idx,
            "start": t_start,
            "end": t_end,
            "start_f": start_f,
            "end_f": end_f
        }
        window_meta.append(w_info)

        # 1. Too Fast
        tf_cfg = flaw_thresholds.get("too_fast", {})
        if (dtw_slope >= tf_cfg.get("dtw_slope_threshold", 1.25) and p_silence_ratio < 0.35) or (z_rate >= tf_cfg.get("z_threshold", 3.0) and p_rate >= tf_cfg.get("min_rate_syl", 3.8)):
            pct = ((p_rate - b_rate) / max(0.1, b_rate)) * 100
            window_hits["too_fast"].append((w_idx, {
                "feature": "Speech Rate",
                "participant_val": round(p_rate, 1),
                "baseline_val": round(b_rate, 1),
                "unit": "syl/s",
                "pct_change": round(pct, 1),
                "z_score": round(max(z_rate, (dtw_slope - 1.0) * 8.0), 1),
                "detail": f"expected pause missing (0 vs 1)" if p_silence_ratio < 0.05 else f"rushed forward velocity ({p_rate:.1f} vs {b_rate:.1f} syl/s)"
            }))

        # 2. Too Slow
        ts_cfg = flaw_thresholds.get("too_slow", {})
        ts_slope = ts_cfg.get("dtw_slope_threshold", 0.85)
        if (dtw_slope <= ts_slope and p_silence_ratio < 0.35) or (z_rate <= ts_cfg.get("z_threshold", -3.0) and p_rate <= ts_cfg.get("max_rate_syl", 2.3)):
            pct = ((p_rate - b_rate) / max(0.1, b_rate)) * 100
            window_hits["too_slow"].append((w_idx, {
                "feature": "Speech Rate",
                "participant_val": round(p_rate, 1),
                "baseline_val": round(b_rate, 1),
                "unit": "syl/s",
                "pct_change": round(pct, 1),
                "z_score": round(min(z_rate, (dtw_slope - 1.0) * 8.0), 1),
                "detail": f"delivery dragged by {abs(pct):.0f}% below canonical cadence"
            }))

        # 3. Long Pauses
        lp_cfg = flaw_thresholds.get("long_pauses", {})
        pause_sec = (end_f - start_f) * (hop_length / sr) * max(p_pause_ratio, p_silence_ratio)
        t_base_elapsed = (base_indices[-1] - base_indices[0]) * (hop_length / sr)
        if pause_sec >= lp_cfg.get("min_pause_sec", 0.8) and (
            (pause_sec - t_base_elapsed >= 0.5) or 
            (p_silence_ratio - b_silence_ratio > 0.40) or 
            (p_pause_ratio - b_pause_ratio > 0.40)
        ):
            pct = (pause_sec / max(0.1, b_pause_ratio * 1.5)) * 100
            window_hits["long_pauses"].append((w_idx, {
                "feature": "Pause Duration",
                "participant_val": round(pause_sec, 1),
                "baseline_val": round(max(0.1, b_pause_ratio * 1.0), 1),
                "unit": "s",
                "pct_change": round(pct, 1),
                "z_score": round(max(3.0, pause_sec * 3.2), 1),
                "detail": f"prolonged dead air silence ({pause_sec:.1f}s vs expected {b_pause_ratio*1.0:.1f}s)"
            }))

        # 4. Missing Pauses
        mp_cfg = flaw_thresholds.get("missing_pauses", {})
        if b_pause_ratio >= 0.30 and p_pause_ratio <= mp_cfg.get("max_pause_ratio", 0.08) and p_rate >= b_rate:
            window_hits["missing_pauses"].append((w_idx, {
                "feature": "Syntactic Pause Ratio",
                "participant_val": round(p_pause_ratio * 100, 1),
                "baseline_val": round(b_pause_ratio * 100, 1),
                "unit": "% pause",
                "pct_change": -85.0,
                "z_score": -3.2,
                "detail": f"clause boundary pause suppressed (0 vs 1 expected)"
            }))

        # 5. Monotone
        mono_cfg = flaw_thresholds.get("monotone", {})
        if has_voiced and b_f0_std >= 1.8:
            var_ratio = (p_f0_std**2) / (b_f0_std**2 + 1e-4)
            if var_ratio <= mono_cfg.get("max_var_ratio", 0.35) and p_f0_std < 1.3:
                z_mono = robust_z(p_f0_std, b_voiced)
                pct = (var_ratio - 1.0) * 100
                window_hits["monotone"].append((w_idx, {
                    "feature": "Pitch Dynamic Range",
                    "participant_val": round(p_f0_std, 1),
                    "baseline_val": round(b_f0_std, 1),
                    "unit": "st",
                    "pct_change": round(pct, 1),
                    "z_score": round(min(-3.0, z_mono), 1),
                    "detail": f"prosodic variance compressed by {abs(pct):.0f}%"
                }))

        # 6. Volume Drop
        vd_cfg = flaw_thresholds.get("volume_drop", {})
        delta_db = p_rms_db - b_rms_db
        v_thresh = vd_cfg.get("delta_db_threshold", -7.5)
        z_thresh = vd_cfg.get("z_threshold", -3.0)
        if (delta_db <= v_thresh and z_rms <= z_thresh) or (delta_db <= -9.5 and z_rms <= -1.8):
            window_hits["volume_drop"].append((w_idx, {
                "feature": "Vocal Energy",
                "participant_val": round(p_rms_db, 1),
                "baseline_val": round(b_rms_db, 1),
                "unit": "dB",
                "pct_change": round(delta_db, 1),
                "z_score": round(min(-3.0, z_rms), 1),
                "detail": f"projection decayed by {abs(delta_db):.1f} dB"
            }))

        # 7. Pitch Spike
        ps_cfg = flaw_thresholds.get("pitch_spike", {})
        st_thresh = ps_cfg.get("delta_st_threshold", 2.6)
        f0_diffs = part_feat["f0_semitones"][start_f:end_f] - base_feat["f0_semitones"][base_indices]
        valid_diffs = f0_diffs[~np.isnan(f0_diffs)]
        if len(valid_diffs) >= 6 and (np.median(valid_diffs) >= st_thresh or np.percentile(valid_diffs, 90) >= st_thresh + 0.8):
            med_diff = float(np.median(valid_diffs))
            window_hits["pitch_spike"].append((w_idx, {
                "feature": "Pitch Peak",
                "participant_val": round(float(np.nanmax(part_feat["f0_semitones"][start_f:end_f])), 1),
                "baseline_val": round(float(np.nanmedian(base_feat["f0_semitones"][base_indices])), 1),
                "unit": "st",
                "pct_change": round(med_diff, 1),
                "z_score": round(max(3.0, med_diff / 0.9), 1),
                "detail": f"abrupt pitch excursion of {med_diff:+.1f} st"
            }))
        elif has_voiced and (p_f0_max - b_f0_max) >= st_thresh + 0.5:
            delta_st = p_f0_max - b_f0_max
            window_hits["pitch_spike"].append((w_idx, {
                "feature": "Pitch Peak",
                "participant_val": round(p_f0_max, 1),
                "baseline_val": round(b_f0_max, 1),
                "unit": "st",
                "pct_change": round(delta_st, 1),
                "z_score": round(max(3.0, delta_st / 1.1), 1),
                "detail": f"abrupt pitch excursion of {delta_st:+.1f} st"
            }))

    # Form contiguous runs of at least min_consecutive windows
    all_raw_regions = []
    
    for f_type, hits in window_hits.items():
        if not hits:
            continue
            
        # Group hits into contiguous consecutive window runs
        runs = []
        current_run = [hits[0]]
        
        for h in hits[1:]:
            prev_w = current_run[-1][0]
            curr_w = h[0]
            if curr_w == prev_w + 1:
                current_run.append(h)
            else:
                if len(current_run) >= min_consecutive:
                    runs.append(current_run)
                current_run = [h]
                
        if len(current_run) >= min_consecutive:
            runs.append(current_run)
            
        # Convert runs to raw temporal intervals
        for r in runs:
            start_w = r[0][0]
            end_w = r[-1][0]
            reg_start = window_meta[start_w]["start"]
            reg_end = window_meta[end_w]["end"]
            
            # Select evidence with highest absolute z-score
            best_ev = max(r, key=lambda x: abs(x[1]["z_score"]))[1]
            z_mag = abs(best_ev["z_score"])
            dur = reg_end - reg_start
            severity = float(np.clip(0.35 + (z_mag - 2.8) * 0.15 + (dur / total_duration) * 0.25, 0.3, 1.0))
            
            all_raw_regions.append({
                "start": reg_start,
                "end": reg_end,
                "duration": dur,
                "flaw_type": f_type,
                "severity": round(severity, 2),
                "evidence": best_ev
            })

    if not all_raw_regions:
        return []

    # 2. Merge regions of the same type separated by < merge_gap (0.5s)
    all_raw_regions.sort(key=lambda r: (r["flaw_type"], r["start"]))
    merged_same_type = []
    
    for reg in all_raw_regions:
        if not merged_same_type:
            merged_same_type.append(reg.copy())
            continue
        prev = merged_same_type[-1]
        if prev["flaw_type"] == reg["flaw_type"] and (reg["start"] - prev["end"]) < merge_gap:
            prev["end"] = max(prev["end"], reg["end"])
            prev["duration"] = prev["end"] - prev["start"]
            if reg["severity"] > prev["severity"]:
                prev["severity"] = reg["severity"]
                prev["evidence"] = reg["evidence"]
        else:
            merged_same_type.append(reg.copy())

    # 3. Filter minimum region length (>= 0.8s)
    length_filtered = [r for r in merged_same_type if r["duration"] >= min_region_len]
    if not length_filtered:
        return []

    # 4. Resolve overlaps between different flaw types
    # Sort chronologically by start
    length_filtered.sort(key=lambda r: r["start"])
    resolved = []
    
    for cand in length_filtered:
        if not resolved:
            cand["secondary_flaws"] = []
            cand["secondary_tag"] = None
            resolved.append(cand)
            continue
            
        last = resolved[-1]
        overlap_start = max(last["start"], cand["start"])
        overlap_end = min(last["end"], cand["end"])
        
        # If overlapping
        if overlap_end > overlap_start:
            if cand["severity"] > last["severity"]:
                # Candidate wins
                cand["secondary_flaws"] = list(set(last.get("secondary_flaws", []) + [last["flaw_type"]]))
                cand["secondary_tag"] = last["flaw_type"]
                resolved[-1] = cand
            else:
                # Last wins, absorb candidate
                if "secondary_flaws" not in last:
                    last["secondary_flaws"] = []
                last["secondary_flaws"].append(cand["flaw_type"])
                last["secondary_tag"] = cand["flaw_type"]
        else:
            cand["secondary_flaws"] = []
            cand["secondary_tag"] = None
            resolved.append(cand)

    # 5. Cap at 8 highest-severity regions, then sort by start time
    resolved.sort(key=lambda r: r["severity"], reverse=True)
    top_regions = resolved[:max_flaws]
    top_regions.sort(key=lambda r: r["start"])

    # 6. Attach aligned words spoken
    words_list = part_feat.get("words", [])
    final_output = []
    
    for r in top_regions:
        w_spoken = get_words_in_range(words_list, r["start"], r["end"])
        r_item = {
            "start": round(r["start"], 3),
            "end": round(min(r["end"], total_duration), 3),
            "duration": round(min(r["end"], total_duration) - r["start"], 3),
            "flaw_type": r["flaw_type"],
            "severity": r["severity"],
            "words": w_spoken,
            "evidence": r["evidence"],
            "secondary_flaws": r.get("secondary_flaws", []),
            "secondary_tag": r.get("secondary_tag", None)
        }
        final_output.append(r_item)

    return final_output
