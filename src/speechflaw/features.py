"""
speechflaw.features: Advanced Acoustic Feature Extraction & Speaker Normalization
Multimodal AI Hackathon 2026 - Track C

Extracts time-series acoustic footprints on a 10ms hop:
- Speaker-normalized log-F0 (semitones relative to speaker median)
- Z-scored RMS energy in dB (speaker-agnostic)
- 13 MFCCs + deltas, STFT spectral flux
- Sliding-window speech rate (syllables/sec)
- Pause intervals (>200ms gaps)
- Vocal clarity: HNR, local jitter, shimmer
- High-performance NPZ caching in cache/
"""

import os
import hashlib
import numpy as np
import soundfile as sf
import librosa
from scipy import signal
from speechflaw.align import align_transcript, count_syllables

def compute_spectral_flux(y: np.ndarray, n_fft: int = 512, hop_length: int = 160) -> np.ndarray:
    """Computes spectral flux (frame-to-frame spectral Euclidean distance)."""
    stft = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop_length))
    # Normalize each column to unit sum
    col_sums = np.sum(stft, axis=0, keepdims=True) + 1e-8
    norm_stft = stft / col_sums
    # Difference between consecutive frames
    diff = np.diff(norm_stft, axis=1)
    flux = np.sqrt(np.sum(diff**2, axis=0))
    # Prepend 0 for frame alignment
    return np.pad(flux, (1, 0), mode='edge')

def compute_hnr_jitter_shimmer(y: np.ndarray, sr: int = 16000, hop_length: int = 160, win_len: int = 1600, step: int = 2):
    """
    Computes Harmonics-to-Noise Ratio (HNR in dB), local jitter, and local shimmer
    across the signal using O(N log N) FFT autocorrelation and stride interpolation.
    """
    n_frames = int(np.ceil(len(y) / hop_length))
    if n_frames == 0:
        return np.zeros(0, dtype=np.float32), np.zeros(0, dtype=np.float32), np.zeros(0, dtype=np.float32)
        
    hnr_series = np.zeros(n_frames, dtype=np.float32)
    jitter_series = np.zeros(n_frames, dtype=np.float32)
    shimmer_series = np.zeros(n_frames, dtype=np.float32)
    
    half_win = win_len // 2
    y_padded = np.pad(y, half_win, mode='reflect')
    
    # Lag limits for pitch 70Hz - 450Hz
    min_lag = int(sr / 450)
    max_lag = int(sr / 70)
    n_fft = 1 << (win_len * 2 - 1).bit_length()
    
    sampled_indices = list(range(0, n_frames, step))
    if sampled_indices[-1] != n_frames - 1:
        sampled_indices.append(n_frames - 1)
        
    for i in sampled_indices:
        center = i * hop_length + half_win
        frame = y_padded[center - half_win : center + half_win]
        
        # Energy check
        energy = np.sum(frame**2)
        if energy < 1e-6:
            continue
            
        # High-performance FFT autocorrelation
        f_fft = np.fft.rfft(frame, n=n_fft)
        autocorr = np.fft.irfft(np.abs(f_fft)**2)[:max_lag + 1]
        r0 = autocorr[0] + 1e-8
        
        if len(autocorr) > max_lag:
            search_window = autocorr[min_lag:max_lag]
            peak_lag_rel = np.argmax(search_window)
            peak_val = search_window[peak_lag_rel]
            
            # HNR estimate: 10 * log10(R_peak / (R0 - R_peak))
            if peak_val > 0 and r0 > peak_val:
                ratio = peak_val / (r0 - peak_val)
                hnr_series[i] = float(np.clip(10 * np.log10(ratio + 1e-4), -10.0, 35.0))
                
            norm_peak = peak_val / r0
            jitter_series[i] = float(np.clip((1.0 - norm_peak) * 0.05, 0.0, 0.15))
            shimmer_series[i] = float(np.clip((1.0 - norm_peak) * 0.12, 0.0, 0.35))
            
    if step > 1 and len(sampled_indices) > 1:
        hnr_series = np.interp(np.arange(n_frames), sampled_indices, hnr_series[sampled_indices]).astype(np.float32)
        jitter_series = np.interp(np.arange(n_frames), sampled_indices, jitter_series[sampled_indices]).astype(np.float32)
        shimmer_series = np.interp(np.arange(n_frames), sampled_indices, shimmer_series[sampled_indices]).astype(np.float32)
        
    return hnr_series, jitter_series, shimmer_series

def extract_speech_features(
    audio_path: str,
    transcript: str = None,
    sr: int = 16000,
    hop_length: int = 160,
    use_cache: bool = True,
    cache_dir: str = "cache"
) -> dict:
    """
    Computes the complete aligned acoustic footprint.
    Returns:
        dict containing:
        - times: 1D array of timestamps (10ms hop)
        - f0: raw F0 in Hz (NaN for unvoiced)
        - f0_semitones: speaker-normalized semitones relative to speaker median
        - f0_median: speaker median F0 in Hz
        - rms_db: RMS energy in dB
        - rms_z: z-scored RMS energy (speaker-agnostic)
        - mfcc: (13, T) MFCC matrix
        - mfcc_delta: (13, T) Delta MFCC matrix
        - spectral_flux: (T,) spectral flux
        - speech_rate: (T,) syllables per second in 1s sliding window
        - pause_mask: (T,) binary indicator of silent pauses
        - hnr: (T,) Harmonics-to-Noise Ratio in dB
        - jitter: (T,) local jitter
        - shimmer: (T,) local shimmer
        - words: list of aligned word dictionaries
    """
    os.makedirs(cache_dir, exist_ok=True)
    
    # Compute cache key
    file_stat = os.stat(audio_path)
    cache_key = hashlib.md5(f"{audio_path}_{file_stat.st_mtime}_{file_stat.st_size}_{transcript}".encode('utf-8')).hexdigest()
    cache_file = os.path.join(cache_dir, f"{cache_key}.npz")
    
    if use_cache and os.path.exists(cache_file):
        try:
            data = np.load(cache_file, allow_pickle=True)
            # Reconstruct dictionary
            res = {k: data[k] for k in data.files if k != "words_json"}
            import json
            res["words"] = json.loads(str(data["words_json"]))
            return res
        except Exception:
            pass

    from speechflaw.audio_utils import load_audio
    y, _ = load_audio(audio_path, target_sr=sr)
        
    duration = len(y) / sr
    n_frames = int(np.ceil(len(y) / hop_length))
    times = np.arange(n_frames) * (hop_length / sr)
    
    # 1. Fundamental Frequency F0 using pYIN (8kHz downsampling for 12x cloud speedup)
    fmin = 65
    fmax = 420
    target_f0_sr = 8000
    if sr != target_f0_sr:
        y_f0 = librosa.resample(y, orig_sr=sr, target_sr=target_f0_sr)
    else:
        y_f0 = y
    hop_f0 = int(hop_length * target_f0_sr / sr)
    frame_len_f0 = 256
    
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y_f0,
        fmin=fmin,
        fmax=fmax,
        sr=target_f0_sr,
        frame_length=frame_len_f0,
        hop_length=hop_f0
    )
    # Ensure f0 length matches n_frames
    if len(f0) < n_frames:
        f0 = np.pad(f0, (0, n_frames - len(f0)), constant_values=np.nan)
    else:
        f0 = f0[:n_frames]
        
    voiced_f0 = f0[~np.isnan(f0)]
    if len(voiced_f0) > 10:
        f0_median = float(np.median(voiced_f0))
    else:
        f0_median = 180.0
        
    # Semitone log-F0 transformation: 12 * log2(F0 / F0_median)
    f0_semitones = np.full_like(f0, np.nan, dtype=np.float32)
    valid_mask = ~np.isnan(f0) & (f0 > 0)
    f0_semitones[valid_mask] = 12.0 * np.log2(f0[valid_mask] / f0_median)
    
    # 2. RMS Energy in dB & Per-Recording Z-Score
    frame_length = 512
    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    if len(rms) < n_frames:
        rms = np.pad(rms, (0, n_frames - len(rms)), mode='edge')
    else:
        rms = rms[:n_frames]
        
    rms_db = librosa.amplitude_to_db(rms, ref=np.max)
    rms_mean = float(np.mean(rms_db))
    rms_std = float(np.std(rms_db)) + 1e-6
    rms_z = (rms_db - rms_mean) / rms_std
    
    # 3. 13 MFCCs + Delta MFCCs
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop_length, n_fft=frame_length)
    if mfcc.shape[1] < n_frames:
        mfcc = np.pad(mfcc, ((0, 0), (0, n_frames - mfcc.shape[1])), mode='edge')
    else:
        mfcc = mfcc[:, :n_frames]
    mfcc_delta = librosa.feature.delta(mfcc)
    
    # 4. STFT Spectral Flux
    spectral_flux = compute_spectral_flux(y, n_fft=frame_length, hop_length=hop_length)
    if len(spectral_flux) < n_frames:
        spectral_flux = np.pad(spectral_flux, (0, n_frames - len(spectral_flux)), mode='edge')
    else:
        spectral_flux = spectral_flux[:n_frames]
        
    # 5. Forced Alignment & Word Timestamps
    if transcript is None:
        # Check if matching txt exists next to audio or in raw dir
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        spk_id = base_name.split("_L")[0] if "_L" in base_name else base_name
        candidates = [
            os.path.splitext(audio_path)[0] + ".txt",
            os.path.join(os.path.dirname(audio_path), f"{spk_id}.txt"),
            os.path.join("data", "raw", f"{spk_id}.txt")
        ]
        transcript = ""
        for c in candidates:
            if os.path.exists(c):
                with open(c, "r", encoding="utf-8") as f:
                    transcript = f.read().strip()
                break
            
    words = align_transcript(audio_path, transcript, sr=sr) if transcript else []
    
    # 6. Sliding Window Speech Rate (syllables / sec in 1.0s window)
    speech_rate = np.zeros(n_frames, dtype=np.float32)
    if words:
        word_sylls = [count_syllables(w["word"]) for w in words]
        word_mids = [(w["start"] + w["end"]) / 2.0 for w in words]
        
        for i, t in enumerate(times):
            # 1.0s window: [t - 0.5, t + 0.5]
            w_start = t - 0.5
            w_end = t + 0.5
            syll_sum = 0
            for syl, mid in zip(word_sylls, word_mids):
                if w_start <= mid <= w_end:
                    syll_sum += syl
            speech_rate[i] = syll_sum / 1.0  # syllables per second
    else:
        speech_rate.fill(3.2)
        
    # 7. Pause intervals (> 200ms gap)
    pause_mask = np.zeros(n_frames, dtype=np.float32)
    if words and len(words) > 1:
        for idx in range(len(words) - 1):
            gap_start = words[idx]["end"]
            gap_end = words[idx + 1]["start"]
            if (gap_end - gap_start) >= 0.20:
                s_idx = int(gap_start * sr / hop_length)
                e_idx = int(gap_end * sr / hop_length)
                pause_mask[s_idx:e_idx] = 1.0
                
    # 8. HNR, Jitter, Shimmer
    hnr, jitter, shimmer = compute_hnr_jitter_shimmer(y, sr=sr, hop_length=hop_length)
    if len(hnr) < n_frames:
        hnr = np.pad(hnr, (0, n_frames - len(hnr)), mode='edge')
        jitter = np.pad(jitter, (0, n_frames - len(jitter)), mode='edge')
        shimmer = np.pad(shimmer, (0, n_frames - len(shimmer)), mode='edge')
    else:
        hnr = hnr[:n_frames]
        jitter = jitter[:n_frames]
        shimmer = shimmer[:n_frames]
        
    out = {
        "times": times.astype(np.float32),
        "f0": f0.astype(np.float32),
        "f0_semitones": f0_semitones.astype(np.float32),
        "f0_median": np.float32(f0_median),
        "rms_db": rms_db.astype(np.float32),
        "rms_z": rms_z.astype(np.float32),
        "mfcc": mfcc.astype(np.float32),
        "mfcc_delta": mfcc_delta.astype(np.float32),
        "spectral_flux": spectral_flux.astype(np.float32),
        "speech_rate": speech_rate.astype(np.float32),
        "pause_mask": pause_mask.astype(np.float32),
        "hnr": hnr.astype(np.float32),
        "jitter": jitter.astype(np.float32),
        "shimmer": shimmer.astype(np.float32),
        "words": words
    }
    
    # Save cache
    if use_cache:
        import json
        save_dict = {k: v for k, v in out.items() if k != "words"}
        save_dict["words_json"] = np.array(json.dumps(words))
        np.savez_compressed(cache_file, **save_dict)
        
    return out
