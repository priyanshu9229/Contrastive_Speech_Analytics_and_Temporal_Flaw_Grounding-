"""
speechflaw.explain: Deterministic Causal Explainability Engine
Multimodal AI Hackathon 2026 - Track C

Translates raw acoustic deltas and DTW residuals into structured, human-readable
causal explanations linking mathematical deviation to oratorical performance,
complete with aligned words and actionable delivery coaching recommendations.
"""

def format_timestamp(seconds: float) -> str:
    """Formats seconds into MM:SS.ss timestamp string."""
    mins = int(seconds // 60)
    secs = seconds % 60
    return f"{mins:02d}:{secs:04.1f}"

TIPS_CATALOG = {
    "too_fast": "Pacing surge detected. Practice breath-supported micro-pauses after key thematic nouns to allow your audience time to absorb critical premises.",
    "too_slow": "Cadence drag detected. Increase forward velocity leading into rhetorical pivots to preserve dramatic tension and audience engagement.",
    "missing_pauses": "Syntactic run-on detected. Insert deliberate 250-400ms pauses at punctuation marks and clause boundaries to cleanly segment structural thoughts.",
    "long_pauses": "Dead air hesitation detected. Maintain diaphragm engagement during transitions to eliminate dead gaps and project commanding poise.",
    "monotone": "Prosodic flattening detected. Modulate your pitch dynamic range (+3 to +6 semitones) on emotive verbs to avoid a hypnotic monotone drone.",
    "volume_drop": "Projection decay detected. Support your breath through sentence conclusions rather than allowing vocal energy to trail off at phrase boundaries.",
    "pitch_spike": "Vocal strain excursion detected. Anchor pitch modulation in your lower chest resonance to prevent pitch cracking under emotional emphasis.",
    "stumble_filler": "Articulation turbulence detected. Slow down transition phonemes slightly to avoid consonant clashing and retain polished authority."
}

def generate_causal_explanation(flaw: dict) -> dict:
    """
    Generates a structured causal explanation for a single detected flaw region.
    Returns:
        dict containing:
        - title: human-readable flaw summary
        - time_span: formatted timestamp range
        - words: aligned transcript excerpt
        - mathematical_rationale: explicit mathematical delta and z-score
        - perceptual_impact: subjective listening experience
        - actionable_tip: precise oratorical advice
    """
    f_type = flaw["flaw_type"]
    t_start = flaw["start"]
    t_end = flaw["end"]
    time_span = f"{format_timestamp(t_start)} - {format_timestamp(t_end)}"
    words = flaw.get("words", "").strip()
    words_quoted = f"'{words}'" if words else "phrase segment"
    ev = flaw.get("evidence", {})
    
    feature = ev.get("feature", "Acoustic Metric")
    p_val = ev.get("participant_val", 0.0)
    b_val = ev.get("baseline_val", 0.0)
    z_score = ev.get("z_score", 0.0)
    pct_change = ev.get("pct_change", 0.0)
    
    sign = "+" if pct_change > 0 else ""
    
    if f_type == "too_fast":
        title = "Pushed Cadence (Rushed Delivery)"
        rationale = f"Speech rate accelerated to {p_val} syl/s vs baseline {b_val} syl/s ({sign}{pct_change}%, z={z_score})."
        impact = "Delivery sounds rushed and breathless, risking listener comprehension loss."
        
    elif f_type == "too_slow":
        title = "Dragged Cadence (Lethargic Pacing)"
        rationale = f"Speech rate slowed to {p_val} syl/s vs baseline {b_val} syl/s ({sign}{pct_change}%, z={z_score})."
        impact = "Tempo lags behind rhetorical expectations, causing vocal energy to drain."
        
    elif f_type == "missing_pauses":
        title = "Missing Structural Pauses (Run-On Delivery)"
        rationale = f"Syntactic pause ratio collapsed to {p_val}% vs baseline {b_val}% (z={z_score})."
        impact = "Sentences bleed together without rhetorical breathing space, severing phrase syntax."
        
    elif f_type == "long_pauses":
        title = "Unnatural Pause (Dead Air Freeze)"
        rationale = f"Disproportionate silence interval of {p_val}s observed (baseline expected {b_val}s, z={z_score})."
        impact = "Extended conversational freeze creates awkward hesitation and disrupts train of thought."
        
    elif f_type == "monotone":
        title = "Prosodic Flattening (Monotone Drone)"
        rationale = f"Semitone pitch variance compressed by {abs(pct_change):.1f}% (std {p_val}st vs baseline {b_val}st, z={z_score})."
        impact = "Vocal delivery becomes robotic and devoid of emotive crests, dulling rhetorical persuasion."
        
    elif f_type == "volume_drop":
        title = "Projection Drop (Volume Decay)"
        rationale = f"Local acoustic energy dropped by {abs(pct_change):.1f} dB (RMS z={z_score})."
        impact = "Voice trails off below clarity threshold, projecting diffidence or physical fatigue."
        
    elif f_type == "pitch_spike":
        title = "Vocal Pitch Spike (Acoustic Strain)"
        rationale = f"Unmotivated pitch excursion of {sign}{pct_change:.1f} semitones above local contour (z={z_score})."
        impact = "Abrupt pitch crack creates perceived anxiety or uncontrolled vocal tension."
        
    elif f_type == "stumble_filler":
        title = "Articulation Turbulence (Disfluency)"
        rationale = f"Spectral flux anomaly of {p_val} vs baseline {b_val} indicates disfluent repetition."
        impact = "Momentary stumble degrades oratorical polish and professional composure."
        
    else:
        title = f"Delivery Anomaly ({f_type})"
        rationale = f"Significant acoustic divergence observed ({feature}: {p_val} vs {b_val}, z={z_score})."
        impact = "Delivery strays notably from the canonical oratorical template."
        
    tip = TIPS_CATALOG.get(f_type, "Maintain consistent breath support and deliberate rhetorical pacing.")
    
    full_text = f"{time_span} ({words_quoted}): {rationale} {impact}"
    
    return {
        "title": title,
        "time_span": time_span,
        "words": words,
        "mathematical_rationale": rationale,
        "perceptual_impact": impact,
        "actionable_tip": tip,
        "full_explanation": full_text
    }

def explain_all_flaws(flaws: list[dict]) -> list[dict]:
    """Generates enriched explanations for all detected flaw regions."""
    explained = []
    for flaw in flaws:
        exp = generate_causal_explanation(flaw)
        item = flaw.copy()
        item.update(exp)
        explained.append(item)
    return explained
