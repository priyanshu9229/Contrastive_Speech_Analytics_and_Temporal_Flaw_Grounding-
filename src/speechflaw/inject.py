"""
speechflaw.inject: Programmatic Flaw Injection Engine
Multimodal AI Hackathon 2026 - Track C

Injects acoustic delivery flaws at known temporal regions with millisecond precision,
tracking time dilations and compressions to yield ground-truth manifests in the
flawed audio timeline.
"""

import argparse
import csv
import os
import random
import warnings
import numpy as np
import soundfile as sf
import librosa
from scipy import signal

warnings.filterwarnings("ignore")

# Seed for absolute reproducibility
SEED = 42
random.seed(SEED)
np.random.seed(SEED)

FLAW_TYPES = [
    "too_fast",
    "too_slow",
    "missing_pauses",
    "long_pauses",
    "monotone",
    "volume_drop",
    "pitch_spike",
    "stumble_filler",
]

def make_crossfade(n_samples: int):
    """Generates cosine crossfade curves."""
    if n_samples <= 0:
        return np.array([]), np.array([])
    t = np.linspace(0, np.pi / 2, n_samples)
    fade_in = np.sin(t) ** 2
    fade_out = np.cos(t) ** 2
    return fade_in, fade_out

def apply_crossfade(seg1: np.ndarray, seg2: np.ndarray, n_fade: int = 320) -> np.ndarray:
    """Seamlessly joins two audio segments using equal-power crossfade."""
    if len(seg1) < n_fade or len(seg2) < n_fade:
        return np.concatenate([seg1, seg2])
    fade_in, fade_out = make_crossfade(n_fade)
    overlap = seg1[-n_fade:] * fade_out + seg2[:n_fade] * fade_in
    return np.concatenate([seg1[:-n_fade], overlap, seg2[n_fade:]])

def generate_room_noise(duration_s: float, sr: int = 16000, level_db: float = -58.0) -> np.ndarray:
    """Generates gentle ambient room tone / filtered noise."""
    n_samples = int(duration_s * sr)
    noise = np.random.normal(0, 1.0, n_samples)
    # Low pass filter at 1200 Hz to simulate room acoustics
    sos = signal.butter(4, 1200, btype='low', fs=sr, output='sos')
    filtered = signal.sosfilt(sos, noise)
    rms = np.sqrt(np.mean(filtered**2)) + 1e-8
    target_rms = 10 ** (level_db / 20.0)
    scaled = filtered * (target_rms / rms)
    # 30ms fade in/out
    n_fade = min(int(0.03 * sr), n_samples // 2)
    fade_in, fade_out = make_crossfade(n_fade)
    scaled[:n_fade] *= fade_in
    scaled[-n_fade:] *= fade_out
    return scaled

def inject_too_fast(y: np.ndarray, sr: int, rate: float = 1.45) -> np.ndarray:
    """Compresses time by stretching speech rate (too fast)."""
    stretched = librosa.effects.time_stretch(y, rate=rate)
    return stretched

def inject_too_slow(y: np.ndarray, sr: int, rate: float = 0.70) -> np.ndarray:
    """Dilates time by slowing down delivery rate."""
    stretched = librosa.effects.time_stretch(y, rate=rate)
    return stretched

def inject_volume_drop(y: np.ndarray, sr: int, db_drop: float = 12.0) -> np.ndarray:
    """Applies a smooth volume drop across the segment with subtle fades."""
    gain = 10 ** (-db_drop / 20.0)
    n_fade = min(int(0.06 * sr), len(y) // 4)
    envelope = np.ones(len(y)) * gain
    if n_fade > 0:
        envelope[:n_fade] = np.linspace(1.0, gain, n_fade)
        envelope[-n_fade:] = np.linspace(gain, 1.0, n_fade)
    return y * envelope

def inject_pitch_spike(y: np.ndarray, sr: int, semitones: float = 4.5) -> np.ndarray:
    """Shifts pitch abruptly upwards (cracking/strain)."""
    shifted = librosa.effects.pitch_shift(y, sr=sr, n_steps=semitones)
    return shifted

def inject_monotone(y: np.ndarray, sr: int) -> np.ndarray:
    """Flattens pitch contour and compresses dynamic range to simulate robotic drone."""
    # Compress dynamic range via gentle soft-clipping / saturation
    compressed = np.tanh(y * 1.6) * 0.75
    # Blend with shifted copy to create pitch-flattening harmonic interference
    shifted = librosa.effects.pitch_shift(compressed, sr=sr, n_steps=-1.5)
    flattened = 0.65 * compressed + 0.35 * shifted
    # Normalize peak to match original
    peak_orig = np.max(np.abs(y)) + 1e-6
    peak_new = np.max(np.abs(flattened)) + 1e-6
    return flattened * (peak_orig / peak_new)

def inject_long_pauses(y: np.ndarray, sr: int, pause_duration_s: float = 1.8) -> np.ndarray:
    """Splits segment in the middle and inserts dead air silence / room tone."""
    mid = len(y) // 2
    part1 = y[:mid]
    part2 = y[mid:]
    noise = generate_room_noise(pause_duration_s, sr=sr, level_db=-58.0)
    joined = apply_crossfade(part1, noise)
    return apply_crossfade(joined, part2)

def inject_missing_pauses(y: np.ndarray, sr: int) -> np.ndarray:
    """Detects silences/pauses > 200ms and strips them down to create rushed run-on speech."""
    frame_len = int(0.02 * sr)
    hop_len = int(0.01 * sr)
    rms = librosa.feature.rms(y=y, frame_length=frame_len, hop_length=hop_len)[0]
    db = librosa.amplitude_to_db(rms, ref=np.max)
    # Threshold for silence: -32 dB
    silence_frames = np.where(db < -32)[0]
    
    # Identify contiguous silence regions > 200 ms
    min_silence_frames = int(0.20 * sr / hop_len)
    regions = []
    if len(silence_frames) > 0:
        start_f = silence_frames[0]
        cur_f = start_f
        for f in silence_frames[1:]:
            if f == cur_f + 1:
                cur_f = f
            else:
                if (cur_f - start_f + 1) >= min_silence_frames:
                    regions.append((start_f * hop_len, cur_f * hop_len))
                start_f = f
                cur_f = f
        if (cur_f - start_f + 1) >= min_silence_frames:
            regions.append((start_f * hop_len, cur_f * hop_len))
    
    if not regions:
        # If no silence detected, time-stretch slightly to simulate run-on
        return librosa.effects.time_stretch(y, rate=1.35)
    
    # Strip silences to 30ms
    out_parts = []
    last_idx = 0
    keep_samples = int(0.03 * sr)
    for s_start, s_end in regions:
        out_parts.append(y[last_idx:s_start + keep_samples])
        last_idx = s_end
    out_parts.append(y[last_idx:])
    return np.concatenate(out_parts)

def inject_stumble_filler(y: np.ndarray, sr: int) -> np.ndarray:
    """Inserts a hesitation stutter / syllable repetition."""
    mid = len(y) // 2
    frag_len = int(0.14 * sr)
    if mid + frag_len < len(y):
        syllable = y[mid:mid + frag_len]
        pause = generate_room_noise(0.18, sr=sr, level_db=-45.0)
        stutter = np.concatenate([syllable, pause, syllable])
        return np.concatenate([y[:mid], stutter, y[mid + frag_len:]])
    return y

# ---------------------------------------------------------------------------
# Speech-Specific Canonical Injection Plans (L1 to L5)
# ---------------------------------------------------------------------------

SPEECH_PLANS = {
    "stay_hungry": {
        "L1": [
            {"flaw": "too_fast", "start_base": 1.5, "end_base": 5.8, "rate": 1.55, "mag": "1.55x"},
            {"flaw": "long_pauses", "start_base": 7.0, "end_base": 8.0, "pause_s": 2.4, "mag": "2.4s silence"},
            {"flaw": "monotone", "start_base": 10.5, "end_base": 15.0, "mag": "pitch flattened"},
            {"flaw": "volume_drop", "start_base": 17.5, "end_base": 21.0, "db_drop": 14.0, "mag": "-14dB"},
            {"flaw": "pitch_spike", "start_base": 22.5, "end_base": 24.2, "semitones": 5.0, "mag": "+5.0st"},
        ],
        "L2": [
            {"flaw": "too_slow", "start_base": 2.0, "end_base": 6.5, "rate": 0.68, "mag": "0.68x"},
            {"flaw": "volume_drop", "start_base": 9.0, "end_base": 13.0, "db_drop": 12.0, "mag": "-12dB"},
            {"flaw": "long_pauses", "start_base": 15.0, "end_base": 16.0, "pause_s": 1.8, "mag": "1.8s silence"},
            {"flaw": "monotone", "start_base": 18.5, "end_base": 23.5, "mag": "pitch flattened"},
        ],
        "L3": [
            {"flaw": "too_fast", "start_base": 3.0, "end_base": 7.5, "rate": 1.40, "mag": "1.40x"},
            {"flaw": "missing_pauses", "start_base": 10.0, "end_base": 15.5, "mag": "stripped pauses"},
            {"flaw": "pitch_spike", "start_base": 19.0, "end_base": 20.8, "semitones": 4.0, "mag": "+4.0st"},
        ],
        "L4": [
            {"flaw": "volume_drop", "start_base": 6.5, "end_base": 10.5, "db_drop": 10.0, "mag": "-10dB"},
            {"flaw": "too_slow", "start_base": 16.0, "end_base": 20.5, "rate": 0.78, "mag": "0.78x"},
        ],
        "L5": [
            {"flaw": "pitch_spike", "start_base": 14.0, "end_base": 15.6, "semitones": 3.5, "mag": "+3.5st"},
        ],
    },
    "dream": {
        "L1": [
            {"flaw": "monotone", "start_base": 1.0, "end_base": 5.5, "mag": "pitch flattened"},
            {"flaw": "too_fast", "start_base": 6.5, "end_base": 10.0, "rate": 1.50, "mag": "1.50x"},
            {"flaw": "long_pauses", "start_base": 11.0, "end_base": 12.0, "pause_s": 2.2, "mag": "2.2s silence"},
            {"flaw": "volume_drop", "start_base": 13.5, "end_base": 17.0, "db_drop": 13.0, "mag": "-13dB"},
            {"flaw": "pitch_spike", "start_base": 18.0, "end_base": 19.5, "semitones": 4.8, "mag": "+4.8st"},
        ],
        "L2": [
            {"flaw": "too_slow", "start_base": 1.5, "end_base": 5.5, "rate": 0.70, "mag": "0.70x"},
            {"flaw": "missing_pauses", "start_base": 7.0, "end_base": 11.5, "mag": "stripped pauses"},
            {"flaw": "volume_drop", "start_base": 13.0, "end_base": 16.5, "db_drop": 12.0, "mag": "-12dB"},
            {"flaw": "pitch_spike", "start_base": 17.5, "end_base": 19.0, "semitones": 4.2, "mag": "+4.2st"},
        ],
        "L3": [
            {"flaw": "too_fast", "start_base": 2.5, "end_base": 6.8, "rate": 1.38, "mag": "1.38x"},
            {"flaw": "long_pauses", "start_base": 9.0, "end_base": 10.0, "pause_s": 1.6, "mag": "1.6s silence"},
            {"flaw": "monotone", "start_base": 13.0, "end_base": 17.5, "mag": "pitch flattened"},
        ],
        "L4": [
            {"flaw": "volume_drop", "start_base": 5.0, "end_base": 8.8, "db_drop": 9.5, "mag": "-9.5dB"},
            {"flaw": "pitch_spike", "start_base": 15.0, "end_base": 16.5, "semitones": 3.8, "mag": "+3.8st"},
        ],
        "L5": [
            {"flaw": "too_slow", "start_base": 8.0, "end_base": 11.5, "rate": 0.82, "mag": "0.82x"},
        ],
    },
    "moon": {
        "L1": [
            {"flaw": "too_fast", "start_base": 1.0, "end_base": 4.5, "rate": 1.52, "mag": "1.52x"},
            {"flaw": "volume_drop", "start_base": 5.5, "end_base": 8.5, "db_drop": 13.5, "mag": "-13.5dB"},
            {"flaw": "long_pauses", "start_base": 9.0, "end_base": 9.8, "pause_s": 2.0, "mag": "2.0s silence"},
            {"flaw": "monotone", "start_base": 11.0, "end_base": 14.5, "mag": "pitch flattened"},
        ],
        "L2": [
            {"flaw": "too_slow", "start_base": 1.2, "end_base": 4.8, "rate": 0.69, "mag": "0.69x"},
            {"flaw": "pitch_spike", "start_base": 6.0, "end_base": 7.5, "semitones": 4.5, "mag": "+4.5st"},
            {"flaw": "missing_pauses", "start_base": 9.0, "end_base": 13.0, "mag": "stripped pauses"},
        ],
        "L3": [
            {"flaw": "too_fast", "start_base": 2.0, "end_base": 5.5, "rate": 1.38, "mag": "1.38x"},
            {"flaw": "volume_drop", "start_base": 8.0, "end_base": 11.5, "db_drop": 11.0, "mag": "-11dB"},
        ],
        "L4": [
            {"flaw": "monotone", "start_base": 4.0, "end_base": 7.5, "mag": "pitch flattened"},
        ],
        "L5": [
            {"flaw": "pitch_spike", "start_base": 8.5, "end_base": 9.8, "semitones": 3.5, "mag": "+3.5st"},
        ],
    },
    "beaches": {
        "L1": [
            {"flaw": "too_fast", "start_base": 1.0, "end_base": 5.0, "rate": 1.55, "mag": "1.55x"},
            {"flaw": "long_pauses", "start_base": 6.0, "end_base": 7.0, "pause_s": 2.3, "mag": "2.3s silence"},
            {"flaw": "monotone", "start_base": 8.5, "end_base": 13.0, "mag": "pitch flattened"},
            {"flaw": "volume_drop", "start_base": 14.5, "end_base": 18.0, "db_drop": 14.0, "mag": "-14dB"},
            {"flaw": "pitch_spike", "start_base": 19.0, "end_base": 20.5, "semitones": 4.6, "mag": "+4.6st"},
        ],
        "L2": [
            {"flaw": "too_slow", "start_base": 1.5, "end_base": 5.8, "rate": 0.68, "mag": "0.68x"},
            {"flaw": "missing_pauses", "start_base": 7.5, "end_base": 12.0, "mag": "stripped pauses"},
            {"flaw": "volume_drop", "start_base": 13.5, "end_base": 17.0, "db_drop": 12.0, "mag": "-12dB"},
        ],
        "L3": [
            {"flaw": "too_fast", "start_base": 2.0, "end_base": 6.2, "rate": 1.39, "mag": "1.39x"},
            {"flaw": "long_pauses", "start_base": 8.5, "end_base": 9.5, "pause_s": 1.7, "mag": "1.7s silence"},
            {"flaw": "pitch_spike", "start_base": 14.0, "end_base": 15.6, "semitones": 4.0, "mag": "+4.0st"},
        ],
        "L4": [
            {"flaw": "volume_drop", "start_base": 6.0, "end_base": 9.8, "db_drop": 10.0, "mag": "-10dB"},
            {"flaw": "too_slow", "start_base": 13.0, "end_base": 17.0, "rate": 0.79, "mag": "0.79x"},
        ],
        "L5": [
            {"flaw": "pitch_spike", "start_base": 11.0, "end_base": 12.5, "semitones": 3.6, "mag": "+3.6st"},
        ],
    }
}

def process_flaw_spec(flaw_type: str, seg: np.ndarray, sr: int, spec: dict) -> np.ndarray:
    """Applies the specific flaw transformation to an audio chunk."""
    if flaw_type == "too_fast":
        return inject_too_fast(seg, sr, rate=spec.get("rate", 1.45))
    elif flaw_type == "too_slow":
        return inject_too_slow(seg, sr, rate=spec.get("rate", 0.70))
    elif flaw_type == "missing_pauses":
        return inject_missing_pauses(seg, sr)
    elif flaw_type == "long_pauses":
        return inject_long_pauses(seg, sr, pause_duration_s=spec.get("pause_s", 1.8))
    elif flaw_type == "monotone":
        return inject_monotone(seg, sr)
    elif flaw_type == "volume_drop":
        return inject_volume_drop(seg, sr, db_drop=spec.get("db_drop", 12.0))
    elif flaw_type == "pitch_spike":
        return inject_pitch_spike(seg, sr, semitones=spec.get("semitones", 4.5))
    elif flaw_type == "stumble_filler":
        return inject_stumble_filler(seg, sr)
    return seg

def generate_flawed_audio(speech_id: str, level: str, raw_dir: str = "data/raw", out_dir: str = "data/dataset"):
    """
    Generates a flawed audio file for a given speech and quality level.
    Accurately maps temporal boundaries into the timeline of the output file.
    Returns list of manifest entries.
    """
    baseline_wav = os.path.join(raw_dir, f"{speech_id}.wav")
    transcript_path = os.path.join(raw_dir, f"{speech_id}.txt")
    if not os.path.exists(baseline_wav):
        raise FileNotFoundError(f"Baseline WAV missing: {baseline_wav}")

    y_base, sr = sf.read(baseline_wav)
    total_base_duration = len(y_base) / sr

    # Level L6 is the pristine gold-standard baseline
    if level == "L6":
        out_wav = os.path.join(out_dir, f"{speech_id}_L6.wav")
        sf.write(out_wav, y_base, sr, subtype='PCM_16')
        return []

    plans = SPEECH_PLANS.get(speech_id, {}).get(level, [])
    # Sort regions chronologically by baseline start
    sorted_specs = sorted(plans, key=lambda s: s["start_base"])

    out_chunks = []
    manifest_rows = []
    
    current_base_sample = 0
    current_flawed_time = 0.0

    for spec in sorted_specs:
        s_start_base = int(spec["start_base"] * sr)
        s_end_base = int(min(spec["end_base"], total_base_duration) * sr)

        if s_start_base < current_base_sample:
            s_start_base = current_base_sample
        if s_start_base >= s_end_base:
            continue

        # 1. Unchanged audio before the flaw
        if s_start_base > current_base_sample:
            pre_seg = y_base[current_base_sample:s_start_base]
            out_chunks.append(pre_seg)
            current_flawed_time += len(pre_seg) / sr

        # 2. Extract original flaw segment
        orig_flaw_seg = y_base[s_start_base:s_end_base]
        flaw_type = spec["flaw"]

        # 3. Transform segment
        flawed_seg = process_flaw_spec(flaw_type, orig_flaw_seg, sr, spec)

        # 4. Record precise bounding box in the TIME AXIS OF THE FLAWED FILE
        flaw_start_s = round(current_flawed_time, 3)
        flaw_duration = len(flawed_seg) / sr
        flaw_end_s = round(current_flawed_time + flaw_duration, 3)

        out_chunks.append(flawed_seg)
        current_flawed_time += flaw_duration
        current_base_sample = s_end_base

        clip_id = f"{speech_id}_{level}"
        out_wav = os.path.join(out_dir, f"{clip_id}.wav")

        manifest_rows.append({
            "clip_id": clip_id,
            "speech_id": speech_id,
            "level": level,
            "flaw_type": flaw_type,
            "start_s": flaw_start_s,
            "end_s": flaw_end_s,
            "magnitude": spec.get("mag", "1.0"),
            "baseline_path": baseline_wav.replace("\\", "/"),
            "flawed_path": out_wav.replace("\\", "/"),
            "transcript_path": transcript_path.replace("\\", "/"),
        })

    # 5. Append trailing audio after last flaw
    if current_base_sample < len(y_base):
        post_seg = y_base[current_base_sample:]
        out_chunks.append(post_seg)

    full_flawed_audio = np.concatenate(out_chunks)
    # Peak normalization to prevent clipping
    peak = np.max(np.abs(full_flawed_audio))
    if peak > 0.95:
        full_flawed_audio = (full_flawed_audio / peak) * 0.92

    clip_id = f"{speech_id}_{level}"
    out_wav = os.path.join(out_dir, f"{clip_id}.wav")
    sf.write(out_wav, full_flawed_audio, sr, subtype='PCM_16')

    return manifest_rows

def build_full_dataset(speech_ids=None, raw_dir="data/raw", out_dir="data/dataset", manifest_path="data/manifest.csv"):
    """Generates all L1-L6 audio variants across speeches and writes data/manifest.csv."""
    os.makedirs(out_dir, exist_ok=True)
    if speech_ids is None:
        speech_ids = list(SPEECH_PLANS.keys())

    all_manifest_rows = []
    print(f"Generating full contrastive dataset for speeches: {speech_ids}...")

    for spk in speech_ids:
        print(f"\nProcessing Speech: {spk}")
        for lvl in ["L1", "L2", "L3", "L4", "L5", "L6"]:
            rows = generate_flawed_audio(spk, lvl, raw_dir=raw_dir, out_dir=out_dir)
            all_manifest_rows.extend(rows)
            out_file = os.path.join(out_dir, f"{spk}_{lvl}.wav")
            flaw_count = len(rows)
            print(f"  [+] {lvl}: {flaw_count} flaws injected -> {out_file}")

    fieldnames = [
        "clip_id", "speech_id", "level", "flaw_type",
        "start_s", "end_s", "magnitude",
        "baseline_path", "flawed_path", "transcript_path"
    ]
    with open(manifest_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_manifest_rows)

    print(f"\n[OK] Successfully wrote {len(all_manifest_rows)} flaw ground-truth regions to {manifest_path}")

def main():
    parser = argparse.ArgumentParser(description="SpeechFlaw Flaw Injection Engine")
    parser.add_argument("--speech-id", type=str, default="all", help="Target speech ID or 'all'")
    parser.add_argument("--raw-dir", type=str, default="data/raw", help="Path to raw baseline audio")
    parser.add_argument("--out-dir", type=str, default="data/dataset", help="Output directory for generated dataset")
    parser.add_argument("--manifest", type=str, default="data/manifest.csv", help="Path to output manifest CSV")
    args = parser.parse_args()

    if args.speech_id == "all":
        build_full_dataset(raw_dir=args.raw_dir, out_dir=args.out_dir, manifest_path=args.manifest)
    else:
        build_full_dataset(speech_ids=[args.speech_id], raw_dir=args.raw_dir, out_dir=args.out_dir, manifest_path=args.manifest)

if __name__ == "__main__":
    main()
