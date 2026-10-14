import os
import numpy as np
from speechflaw.features import extract_speech_features
from speechflaw.detect import detect_flaws
from speechflaw.score import compute_rubric_scores

speeches = ['stay_hungry', 'dream', 'moon', 'beaches']

print(f"{'Speech':<14} | {'Level':<6} | {'Flaws':<6} | {'Score':<6} | Subscores (Pacing, Pause, Pitch, Energy, Clarity)")
print("-" * 80)

for sp in speeches:
    base_wav = f"data/raw/{sp}.wav"
    base_feat = extract_speech_features(base_wav, use_cache=True)
    
    self_flaws = detect_flaws(base_feat, base_feat)
    self_sc = compute_rubric_scores(base_feat, base_feat, self_flaws)
    subs = f"{self_sc['pacing']:.1f}, {self_sc['pauses']:.1f}, {self_sc['pitch_variation']:.1f}, {self_sc['energy']:.1f}, {self_sc['clarity']:.1f}"
    print(f"{sp:<14} | {'SELF':<6} | {len(self_flaws):<6} | {self_sc['overall']:<6.1f} | {subs}")
    
    for lvl in ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']:
        wav = f"data/dataset/{sp}_{lvl}.wav"
        if os.path.exists(wav):
            feat = extract_speech_features(wav, use_cache=True)
            flaws = detect_flaws(feat, base_feat)
            sc = compute_rubric_scores(feat, base_feat, flaws)
            subs = f"{sc['pacing']:.1f}, {sc['pauses']:.1f}, {sc['pitch_variation']:.1f}, {sc['energy']:.1f}, {sc['clarity']:.1f}"
            print(f"{sp:<14} | {lvl:<6} | {len(flaws):<6} | {sc['overall']:<6.1f} | {subs}")
    print("-" * 80)
