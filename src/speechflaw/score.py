"""
speechflaw.score: Calibrated Rubric Scoring Engine
Multimodal AI Hackathon 2026 - Track C

Computes calibrated 0-100 rubric subscores and a weighted aggregate score:
- Pacing (weight 0.25)
- Pauses (weight 0.20)
- Pitch Variation (weight 0.20)
- Energy (weight 0.15)
- Clarity (weight 0.20)

Calibration targets:
- Baseline vs itself: 0 regions and overall >= 98.0
- L5 clips: overall 80-95 and <= 2 regions
- L1 clips: overall <= 35.0
Scores spread smoothly across 0-100 without artificial hard clamping to 5.
"""

import os
import yaml
import numpy as np

RUBRIC_WEIGHTS = {
    "pacing": 0.25,
    "pauses": 0.20,
    "pitch_variation": 0.20,
    "energy": 0.15,
    "clarity": 0.20,
}

FLAW_IMPACT_MATRIX = {
    "too_fast": {"pacing": 1.0, "pauses": 0.40, "clarity": 0.30},
    "too_slow": {"pacing": 1.0, "energy": 0.35},
    "missing_pauses": {"pauses": 1.0, "pacing": 0.40, "clarity": 0.30},
    "long_pauses": {"pauses": 1.0, "pacing": 0.35, "energy": 0.30},
    "monotone": {"pitch_variation": 1.0, "energy": 0.35},
    "volume_drop": {"energy": 1.0, "clarity": 0.40},
    "pitch_spike": {"pitch_variation": 1.0, "clarity": 0.35},
    "stumble_filler": {"clarity": 1.0, "pacing": 0.30},
}

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "config", "thresholds.yaml")

def load_scoring_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = yaml.safe_load(f)
                return cfg.get("scoring", {})
        except Exception:
            pass
    return {
        "per_region_penalty": 22.0,
        "coherence_penalty": 6.0,
        "multi_flaw_compound": 16.5,
        "max_subscore_penalty": 95.0
    }

def compute_rubric_scores(
    part_feat: dict,
    base_feat: dict,
    flaw_regions: list[dict]
) -> dict:
    """
    Computes calibrated rubric subscores and overall score based on acoustic feature deltas
    and grounded flaw penalties.
    """
    total_duration = float(part_feat["times"][-1]) if len(part_feat["times"]) > 0 else 1.0
    score_cfg = load_scoring_config()
    
    penalties = {
        "pacing": 0.0,
        "pauses": 0.0,
        "pitch_variation": 0.0,
        "energy": 0.0,
        "clarity": 0.0,
    }

    # 1. Deduct for temporally grounded flaw regions
    base_penalty = score_cfg.get("per_region_penalty", 22.0)
    coherence_penalty = score_cfg.get("coherence_penalty", 6.0)
    multi_compound = score_cfg.get("multi_flaw_compound", 16.5)
    n_flaws = len(flaw_regions)
    
    for flaw in flaw_regions:
        f_type = flaw["flaw_type"]
        sev = flaw.get("severity", 0.5)
        dur = flaw.get("duration", 1.0)
        dur_ratio = min(1.0, dur / max(1.0, total_duration))
        
        region_penalty = base_penalty * (0.7 + 0.6 * sev) * (0.8 + 0.4 * np.sqrt(dur_ratio))
        
        impacts = FLAW_IMPACT_MATRIX.get(f_type, {"clarity": 0.5})
        for dim, weight in impacts.items():
            penalties[dim] += region_penalty * weight

        # If secondary tags were absorbed, add fractional impact
        for s_type in flaw.get("secondary_flaws", []):
            s_impacts = FLAW_IMPACT_MATRIX.get(s_type, {})
            for dim, weight in s_impacts.items():
                penalties[dim] += (region_penalty * 0.45) * weight

    # 2. General delivery coherence deduction when flaw regions are present
    if n_flaws > 0:
        for dim in penalties:
            penalties[dim] += coherence_penalty * min(2, n_flaws)

    # 3. Multi-flaw compounding penalty for clips with 3+ flaws (e.g. L1 clips)
    if n_flaws >= 3:
        compound = (n_flaws - 1) * multi_compound
        for dim in penalties:
            penalties[dim] += compound

    # 4. Global acoustic divergence adjustments
    # Pacing: Mean speech rate divergence
    p_mean_rate = float(np.mean(part_feat["speech_rate"]))
    b_mean_rate = float(np.mean(base_feat["speech_rate"]))
    rate_diff = abs(p_mean_rate - b_mean_rate)
    if rate_diff > 0.15:
        penalties["pacing"] += min(40.0, (rate_diff - 0.15) * 25.0)
        
    # Pauses: Global silence ratio divergence
    p_pause_ratio = float(np.mean(part_feat["pause_mask"]))
    b_pause_ratio = float(np.mean(base_feat["pause_mask"]))
    pause_diff = abs(p_pause_ratio - b_pause_ratio)
    if pause_diff > 0.04:
        penalties["pauses"] += min(40.0, (pause_diff - 0.04) * 70.0)
        
    # Pitch Variation: Dynamic semitone spread
    p_semi = part_feat["f0_semitones"]
    p_voiced = p_semi[~np.isnan(p_semi)]
    p_std = float(np.std(p_voiced)) if len(p_voiced) > 10 else 0.5
    
    b_semi = base_feat["f0_semitones"]
    b_voiced = b_semi[~np.isnan(b_semi)]
    b_std = float(np.std(b_voiced)) if len(b_voiced) > 10 else 2.5
    
    if p_std < b_std * 0.85:
        penalties["pitch_variation"] += min(35.0, (b_std * 0.85 - p_std) * 14.0)
        
    # Energy: Dynamic range and stability
    p_rms_std = float(np.std(part_feat["rms_db"]))
    b_rms_std = float(np.std(base_feat["rms_db"]))
    if p_rms_std < b_rms_std * 0.75:
        penalties["energy"] += min(28.0, (b_rms_std * 0.75 - p_rms_std) * 4.0)
        
    # Clarity: HNR difference
    p_hnr = float(np.mean(part_feat["hnr"]))
    b_hnr = float(np.mean(base_feat["hnr"]))
    if p_hnr < b_hnr - 1.5:
        penalties["clarity"] += min(30.0, (b_hnr - 1.5 - p_hnr) * 3.5)

    # 4. Apply penalties smoothly across 0-100 without artificial clamping to 5
    final_subscores = {}
    for dim, weight in RUBRIC_WEIGHTS.items():
        pen = penalties[dim]
        # Smooth floor of 0.0 and ceiling of 100.0
        final_score = max(0.0, min(100.0, 100.0 - pen))
        final_subscores[dim] = round(float(final_score), 1)
        
    # 5. Compute weighted overall score
    overall = sum(final_subscores[dim] * RUBRIC_WEIGHTS[dim] for dim in RUBRIC_WEIGHTS)
    overall = round(float(np.clip(overall, 0.0, 100.0)), 1)
    
    return {
        "overall": overall,
        "pacing": final_subscores["pacing"],
        "pauses": final_subscores["pauses"],
        "pitch_variation": final_subscores["pitch_variation"],
        "energy": final_subscores["energy"],
        "clarity": final_subscores["clarity"],
        "weights": RUBRIC_WEIGHTS,
        "penalties": {k: round(v, 2) for k, v in penalties.items()}
    }
