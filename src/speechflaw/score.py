"""
speechflaw.score: Evaluative Rubric Scoring Engine
Multimodal AI Hackathon 2026 - Track C

Computes reproducible 0-100 rubric subscores and a weighted aggregate score:
- Pacing (weight 0.25)
- Pauses (weight 0.20)
- Pitch Variation (weight 0.20)
- Energy (weight 0.15)
- Clarity (weight 0.20)
Deterministic, mathematical, explainable - zero LLM hallucination.
"""

import numpy as np

RUBRIC_WEIGHTS = {
    "pacing": 0.25,
    "pauses": 0.20,
    "pitch_variation": 0.20,
    "energy": 0.15,
    "clarity": 0.20,
}

# Penalty allocation mapping flaw types to affected rubric dimensions
FLAW_IMPACT_MATRIX = {
    "too_fast": {"pacing": 1.0, "pauses": 0.4, "clarity": 0.3},
    "too_slow": {"pacing": 1.0, "energy": 0.3},
    "missing_pauses": {"pauses": 1.0, "pacing": 0.5, "clarity": 0.3},
    "long_pauses": {"pauses": 1.0, "pacing": 0.4, "energy": 0.2},
    "monotone": {"pitch_variation": 1.0, "energy": 0.3},
    "volume_drop": {"energy": 1.0, "clarity": 0.4},
    "pitch_spike": {"pitch_variation": 0.8, "clarity": 0.4},
    "stumble_filler": {"clarity": 1.0, "pacing": 0.3},
}

def compute_rubric_scores(
    part_feat: dict,
    base_feat: dict,
    flaw_regions: list[dict]
) -> dict:
    """
    Computes rubric subscores and overall score based on acoustic feature deltas
    and grounded flaw penalties.
    
    Returns:
        dict containing:
        - overall: float (0-100)
        - pacing: float (0-100)
        - pauses: float (0-100)
        - pitch_variation: float (0-100)
        - energy: float (0-100)
        - clarity: float (0-100)
        - breakdown: dict of penalties
    """
    total_duration = float(part_feat["times"][-1]) if len(part_feat["times"]) > 0 else 1.0
    
    # Initialize base subscores at 100
    subscores = {
        "pacing": 100.0,
        "pauses": 100.0,
        "pitch_variation": 100.0,
        "energy": 100.0,
        "clarity": 100.0,
    }
    penalties = {k: 0.0 for k in subscores}

    # 1. Deduct for temporally grounded flaw regions
    for flaw in flaw_regions:
        f_type = flaw["flaw_type"]
        sev = flaw.get("severity", 0.5)
        dur = flaw.get("duration", 1.0)
        dur_ratio = min(1.0, dur / max(1.0, total_duration))
        
        # Base penalty scaled by severity and relative duration
        region_penalty = 18.0 + 26.0 * sev * (0.4 + 0.6 * np.sqrt(dur_ratio))
        
        impacts = FLAW_IMPACT_MATRIX.get(f_type, {"clarity": 0.5})
        for dim, weight in impacts.items():
            penalties[dim] += region_penalty * weight

    # 2. Global acoustic divergence adjustments
    
    # Pacing: Mean speech rate divergence
    p_mean_rate = float(np.mean(part_feat["speech_rate"]))
    b_mean_rate = float(np.mean(base_feat["speech_rate"]))
    rate_diff = abs(p_mean_rate - b_mean_rate)
    if rate_diff > 0.4:
        penalties["pacing"] += min(28.0, (rate_diff - 0.4) * 16.0)
        
    # Pauses: Global silence ratio divergence
    p_pause_ratio = float(np.mean(part_feat["pause_mask"]))
    b_pause_ratio = float(np.mean(base_feat["pause_mask"]))
    pause_diff = abs(p_pause_ratio - b_pause_ratio)
    if pause_diff > 0.08:
        penalties["pauses"] += min(28.0, (pause_diff - 0.08) * 60.0)
        
    # Pitch Variation: Dynamic semitone spread
    p_semi = part_feat["f0_semitones"]
    p_voiced = p_semi[~np.isnan(p_semi)]
    p_std = float(np.std(p_voiced)) if len(p_voiced) > 10 else 0.5
    
    b_semi = base_feat["f0_semitones"]
    b_voiced = b_semi[~np.isnan(b_semi)]
    b_std = float(np.std(b_voiced)) if len(b_voiced) > 10 else 2.5
    
    if p_std < b_std * 0.80:
        penalties["pitch_variation"] += min(30.0, (b_std * 0.80 - p_std) * 16.0)
        
    # Energy: Dynamic range and stability
    p_rms_std = float(np.std(part_feat["rms_db"]))
    b_rms_std = float(np.std(base_feat["rms_db"]))
    if p_rms_std < b_rms_std * 0.70:
        penalties["energy"] += min(24.0, (b_rms_std * 0.70 - p_rms_std) * 3.5)
        
    # Clarity: HNR difference
    p_hnr = float(np.mean(part_feat["hnr"]))
    b_hnr = float(np.mean(base_feat["hnr"]))
    if p_hnr < b_hnr - 2.0:
        penalties["clarity"] += min(25.0, (b_hnr - 2.0 - p_hnr) * 4.0)

    # Multi-flaw compounding penalty
    if len(flaw_regions) >= 4:
        compound = (len(flaw_regions) - 3) * 6.0
        for dim in penalties:
            penalties[dim] += compound

    # 3. Apply penalties and clamp to [5.0, 100.0]
    final_subscores = {}
    for dim, score in subscores.items():
        pen = penalties[dim]
        final_score = max(5.0, 100.0 - pen)
        final_subscores[dim] = round(float(final_score), 1)
        
    # 4. Compute weighted overall score
    overall = sum(final_subscores[dim] * RUBRIC_WEIGHTS[dim] for dim in RUBRIC_WEIGHTS)
    overall = round(float(np.clip(overall, 5.0, 100.0)), 1)
    
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
