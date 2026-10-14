"""
speechflaw.explain: Causal Evidence & Actionable Coaching Engine
Multimodal AI Hackathon 2026 - Track C

Formats exact numerical acoustic evidence:
"{title}, {time_span}, '{words}': {part_val} vs {base_val} {unit} ({pct_change}%, z={z_score}); {detail}."
Generates diverse, contextual oratorical tips without repetition across regions.
"""

import re

def format_timestamp_short(seconds: float) -> str:
    """Formats seconds into M:SS timestamp string."""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins}:{secs:02d}"

# Dynamic non-repeating tips per flaw type
FLAW_TIPS_ROTATION = {
    "too_fast": [
        "Pacing surge detected. Insert a deliberate breath-supported pause before starting the next clause.",
        "Practice elongating stressed vowels on thematic nouns to allow your core premise to settle.",
        "Use micro-pauses at natural syntactic boundaries to prevent running through critical ideas.",
        "Ground your tempo with steady diaphragmatic control to maintain rhetorical poise."
    ],
    "too_slow": [
        "Cadence drag detected. Increase forward velocity into rhetorical pivots to sustain dramatic tension.",
        "Keep transition syllables light and snappy rather than protracting unstressed words.",
        "Accelerate through explanatory connective phrases to keep listener attention sharp.",
        "Pick up your tempo heading into key points to convey decisive conviction."
    ],
    "missing_pauses": [
        "Run-on delivery detected. Insert a crisp 300ms pause after major punctuation marks.",
        "Allow sentences to land with full silence before launching into subsequent supporting points.",
        "Segment structural thoughts by taking a silent breath at clause boundaries.",
        "Avoid vocalizing connective words across sentences; let silence signal transition."
    ],
    "long_pauses": [
        "Prolonged hesitation detected. Maintain diaphragm engagement across phrase transitions.",
        "Keep conversational pauses between 0.5s and 1.0s to avoid losing audience momentum.",
        "If framing a pause for emphasis, ensure your facial posture remains active and poised.",
        "Eliminate dead air gaps by mentally cueing the opening word of the upcoming phrase."
    ],
    "monotone": [
        "Prosodic flattening detected. Modulate pitch by +3 to +6 semitones on primary emotive verbs.",
        "Vary intonation between narrative setup (neutral pitch) and climax (elevated pitch).",
        "Avoid hypnotic pitch droning by inflecting downward at full stops and upward on questions.",
        "Consciously broaden pitch contours to mirror the emotional gravity of the text."
    ],
    "volume_drop": [
        "Projection decay detected. Support your breath steadily through the final syllable of the phrase.",
        "Do not allow chest energy to fade at sentence boundaries; project through terminal words.",
        "Anchor vocal resonance in your lower mask so volume remains stable across the entire clause.",
        "Ensure critical concluding nouns receive equal dynamic intensity as the opening words."
    ],
    "pitch_spike": [
        "Vocal strain excursion detected. Anchor emotional emphasis in lower chest resonance.",
        "Prevent abrupt pitch cracking by relaxing the throat and engaging core diaphragm support.",
        "Express oratorical intensity through vocal presence and deliberate articulation, not throat tension.",
        "Smooth out pitch excursions by ascending gradually into stressed syllables."
    ],
    "stumble_filler": [
        "Articulation turbulence detected. Decelerate slightly through complex consonant clusters.",
        "Replace filler vocalizations with clean, deliberate silence while gathering your next thought.",
        "Maintain clean jaw articulation to prevent syllable clipping on unfamiliar words.",
        "Enunciate multi-syllable transition words clearly before picking up forward tempo."
    ]
}

def generate_causal_explanation(flaw: dict, index: int = 0) -> dict:
    """
    Generates a structured causal explanation embedding real numbers from evidence.
    Template:
    "{title}, {time_span}, '{words}': {part_val} vs {base_val} {unit} ({pct_change}%, z={z_score}); {detail}."
    """
    f_type = flaw["flaw_type"]
    t_start = flaw["start"]
    t_end = flaw["end"]
    time_span = f"{format_timestamp_short(t_start)}-{format_timestamp_short(t_end)}"
    
    words_raw = flaw.get("words", "").strip()
    words_tokens = words_raw.split()
    if len(words_tokens) > 5:
        words_snippet = " ".join(words_tokens[:4]) + "..."
    else:
        words_snippet = words_raw if words_raw else "spoken segment"
        
    ev = flaw.get("evidence", {})
    feature = ev.get("feature", "Acoustic Metric")
    p_val = ev.get("participant_val", 0.0)
    b_val = ev.get("baseline_val", 0.0)
    unit = ev.get("unit", "")
    pct = ev.get("pct_change", 0.0)
    z_score = ev.get("z_score", 0.0)
    detail = ev.get("detail", "deviation from baseline expectation")
    
    pct_sign = "+" if pct > 0 else ""
    pct_str = f"{pct_sign}{pct:.0f}%" if abs(pct) >= 1.0 else f"{pct_sign}{pct:.1f}%"
    
    # Title mapping
    title_map = {
        "too_fast": "Pacing (fast)",
        "too_slow": "Pacing (slow)",
        "missing_pauses": "Pauses (missing)",
        "long_pauses": "Pauses (unnatural long)",
        "monotone": "Pitch (monotone)",
        "volume_drop": "Energy (volume drop)",
        "pitch_spike": "Pitch (spike)",
        "stumble_filler": "Clarity (stumble/filler)"
    }
    title = title_map.get(f_type, f"Delivery ({f_type})")
    
    # Format exact mathematical rationale following user template
    math_rationale = (
        f"{title}, {time_span}, '{words_snippet}': "
        f"{p_val:.1f} vs {b_val:.1f} {unit} ({pct_str}, z={z_score:.1f}); {detail}."
    )
    
    # Perceptual impact description
    impact_map = {
        "too_fast": "Delivery sounds rushed and breathless, risking listener comprehension loss.",
        "too_slow": "Tempo lags behind rhetorical expectations, causing dramatic tension to drain.",
        "missing_pauses": "Thoughts bleed together without rhetorical breathing space, severing phrase syntax.",
        "long_pauses": "Extended conversational freeze creates awkward hesitation and disrupts train of thought.",
        "monotone": "Vocal delivery becomes robotic and devoid of emotive crests, dulling persuasion.",
        "volume_drop": "Voice trails off below clarity threshold, projecting diffidence or physical fatigue.",
        "pitch_spike": "Abrupt pitch crack creates perceived anxiety or uncontrolled vocal tension.",
        "stumble_filler": "Momentary articulation stumble degrades oratorical polish and professional composure."
    }
    impact = impact_map.get(f_type, "Acoustic delivery deviates notably from canonical oratorical standard.")
    
    # Diverse non-repeating tip selection
    tips_pool = FLAW_TIPS_ROTATION.get(f_type, ["Maintain consistent breath support and deliberate rhetorical pacing."])
    tip = tips_pool[index % len(tips_pool)]
    
    # Secondary tag mention if overlap was resolved
    secondary_tag = flaw.get("secondary_tag")
    if secondary_tag and secondary_tag != f_type:
        secondary_name = title_map.get(secondary_tag, secondary_tag)
        impact += f" (accompanied by {secondary_name})"
        
    full_text = f"{math_rationale} {impact}"
    
    return {
        "title": title,
        "time_span": time_span,
        "words": words_raw,
        "mathematical_rationale": math_rationale,
        "perceptual_impact": impact,
        "actionable_tip": tip,
        "full_explanation": full_text
    }

def explain_all_flaws(flaws: list[dict]) -> list[dict]:
    """Generates enriched explanations for all detected flaw regions."""
    explained = []
    for idx, flaw in enumerate(flaws):
        exp = generate_causal_explanation(flaw, index=idx)
        item = flaw.copy()
        item.update(exp)
        explained.append(item)
    return explained
