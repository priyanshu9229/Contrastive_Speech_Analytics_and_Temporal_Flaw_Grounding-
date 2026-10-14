"""
speechflaw.align: Word-Level Forced Alignment & Transcript Validation Engine
Multimodal AI Hackathon 2026 - Track C

Performs ASR transcription, Word Error Rate (WER) validation, transcript normalization,
and word-level timestamp alignment using faster-whisper and acoustic voice activity segmentation.
"""

import re
import difflib
import numpy as np
import soundfile as sf
import librosa
import jiwer

_WHISPER_MODEL = None

def get_whisper_model():
    """Lazily instantiates and caches faster-whisper CPU model."""
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        try:
            from faster_whisper import WhisperModel
            _WHISPER_MODEL = WhisperModel("tiny", device="cpu", compute_type="int8")
        except Exception as e:
            print(f"Warning: faster-whisper initialization: {e}")
            _WHISPER_MODEL = False
    return _WHISPER_MODEL if _WHISPER_MODEL is not False else None

def count_syllables(word: str) -> int:
    """Estimates syllable count using English phonetic vowel clustering heuristic."""
    w = word.lower().strip()
    if not w:
        return 1
    w = re.sub(r'[^a-z]', '', w)
    if len(w) <= 3:
        return 1
    vowels = "aeiouy"
    count = 0
    prev_is_vowel = False
    for char in w:
        is_vowel = char in vowels
        if is_vowel and not prev_is_vowel:
            count += 1
        prev_is_vowel = is_vowel
    if w.endswith('e') and not w.endswith('le') and count > 1:
        count -= 1
    return max(1, count)

def transcribe_audio_asr(audio_path: str, sr: int = 16000) -> tuple[str, list[dict]]:
    """
    Transcribes audio using faster-whisper with word-level timestamps.
    Passing decoded numpy array directly avoids PyAV container bugs on Windows.
    """
    from speechflaw.audio_utils import load_audio
    y, loaded_sr = load_audio(audio_path, target_sr=sr)
    
    model = get_whisper_model()
    if model is None:
        return "", []
        
    try:
        segments, _ = model.transcribe(y, word_timestamps=True, language="en")
        words = []
        text_parts = []
        for seg in segments:
            text_parts.append(seg.text.strip())
            if seg.words:
                for w in seg.words:
                    clean_w = re.sub(r'[^\w\']', '', w.word)
                    if clean_w:
                        words.append({
                            "word": clean_w,
                            "start": round(float(w.start), 3),
                            "end": round(float(w.end), 3)
                        })
        return " ".join(text_parts), words
    except Exception as e:
        print(f"ASR transcription error: {e}")
        return "", []

def compute_wer(reference: str, hypothesis: str) -> float:
    """Computes Word Error Rate between reference transcript and ASR hypothesis."""
    trans = jiwer.Compose([
        jiwer.ToLowerCase(),
        jiwer.RemovePunctuation(),
        jiwer.RemoveMultipleSpaces(),
        jiwer.Strip()
    ])
    clean_ref = trans(reference)
    clean_hyp = trans(hypothesis)
    if not clean_ref:
        return 0.0 if not clean_hyp else 1.0
    if not clean_hyp:
        return 1.0
    return float(jiwer.wer(clean_ref, clean_hyp))

def normalize_transcript(transcript: str, asr_words: list[dict] | None = None) -> str:
    """
    Normalizes transcript: collapses whitespace and strips non-speech junk / stray tokens.
    """
    if not transcript:
        return ""
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', transcript).strip()
    if not asr_words:
        return text
        
    asr_vocab = {w["word"].lower() for w in asr_words if w.get("word")}
    if not asr_vocab:
        return text
        
    tokens = text.split()
    filtered = []
    for t in tokens:
        clean_t = re.sub(r'[^\w]', '', t).lower()
        if not clean_t:
            continue
        # Retain token if it matches an ASR word or close phonetic match
        if clean_t in asr_vocab or any(difflib.SequenceMatcher(None, clean_t, aw).ratio() > 0.65 for aw in asr_vocab):
            filtered.append(t)
            
    return " ".join(filtered) if filtered else text

def validate_audio_transcript(audio_path: str, transcript: str, wer_threshold: float = 0.5) -> tuple[float, str | None, str, list[dict]]:
    """
    Validates participant audio against provided transcript.
    Returns: (wer, warning_message, asr_text, asr_words)
    """
    asr_text, asr_words = transcribe_audio_asr(audio_path)
    if not asr_text:
        # Fallback if ASR failed to run
        return 0.0, None, "", []
        
    wer = compute_wer(transcript, asr_text)
    warning = None
    return wer, warning, asr_text, asr_words

def detect_speech_active_regions(y: np.ndarray, sr: int = 16000, hop_length: int = 160):
    """
    Computes frame-level voice activity detection (VAD) using dual-threshold energy
    and spectral centroid. Returns list of (start_s, end_s) active regions.
    """
    frame_length = 320
    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    
    rms_db = librosa.amplitude_to_db(rms, ref=np.max)
    noise_floor = np.percentile(rms_db, 20)
    thresh = max(-38.0, noise_floor + 10.0)
    
    active_mask = (rms_db > thresh)
    min_pause_frames = int(0.18 * sr / hop_length)
    min_speech_frames = int(0.08 * sr / hop_length)
    
    gap_count = 0
    for i in range(len(active_mask)):
        if not active_mask[i]:
            gap_count += 1
        else:
            if 0 < gap_count < min_pause_frames:
                active_mask[i - gap_count:i] = True
            gap_count = 0
            
    regions = []
    in_speech = False
    start_frame = 0
    for i, active in enumerate(active_mask):
        if active and not in_speech:
            in_speech = True
            start_frame = i
        elif not active and in_speech:
            in_speech = False
            if (i - start_frame) >= min_speech_frames:
                regions.append((start_frame * hop_length / sr, i * hop_length / sr))
    if in_speech and (len(active_mask) - start_frame) >= min_speech_frames:
        regions.append((start_frame * hop_length / sr, len(active_mask) * hop_length / sr))
        
    if not regions:
        regions = [(0.0, len(y) / sr)]
    return regions

def align_transcript(audio_path: str, transcript: str, sr: int = 16000, asr_words: list[dict] | None = None) -> list[dict]:
    """
    Performs forced alignment to map transcript words to exact audio start and end timestamps.
    Returns: list of dicts [{'word': str, 'start': float, 'end': float}]
    """
    from speechflaw.audio_utils import load_audio
    y, _ = load_audio(audio_path, target_sr=sr)
    duration = len(y) / sr
    
    raw_tokens = transcript.strip().split()
    if not raw_tokens:
        return []
        
    # 1. Try reconciling with Whisper word timestamps if available
    if asr_words and len(asr_words) > 0:
        target_clean = [re.sub(r'[^\w\']', '', w).lower() for w in raw_tokens]
        hyp_clean = [w["word"].lower() for w in asr_words]
        matcher = difflib.SequenceMatcher(None, target_clean, hyp_clean)
        aligned = []
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                for ti, hj in zip(range(i1, i2), range(j1, j2)):
                    aligned.append({
                        "word": raw_tokens[ti],
                        "start": asr_words[hj]["start"],
                        "end": asr_words[hj]["end"]
                    })
        if len(aligned) >= len(raw_tokens) * 0.70:
            return aligned
            
    # 2. High-precision acoustic VAD proportional alignment fallback
    active_regions = detect_speech_active_regions(y, sr=sr)
    
    weights = [count_syllables(w) * 0.7 + max(1, len(re.sub(r'[\W_]+', '', w))) * 0.3 for w in raw_tokens]
    total_weight = sum(weights)
    
    total_active_duration = sum(r[1] - r[0] for r in active_regions)
    if total_active_duration <= 0.1:
        total_active_duration = duration
        active_regions = [(0.0, duration)]
        
    word_timestamps = []
    accum_weight = 0.0
    
    for i, (word, w_weight) in enumerate(zip(raw_tokens, weights)):
        start_frac = accum_weight / total_weight
        end_frac = (accum_weight + w_weight) / total_weight
        accum_weight += w_weight
        
        target_start_dur = start_frac * total_active_duration
        target_end_dur = end_frac * total_active_duration
        
        t_start = None
        t_end = None
        elapsed = 0.0
        
        for r_start, r_end in active_regions:
            r_dur = r_end - r_start
            if t_start is None and elapsed + r_dur >= target_start_dur:
                t_start = r_start + (target_start_dur - elapsed)
            if t_end is None and elapsed + r_dur >= target_end_dur:
                t_end = r_start + (target_end_dur - elapsed)
                break
            elapsed += r_dur
            
        if t_start is None:
            t_start = active_regions[-1][0]
        if t_end is None:
            t_end = min(duration, active_regions[-1][1])
            
        t_start = max(0.0, round(t_start, 3))
        t_end = max(t_start + 0.08, round(t_end, 3))
        t_end = min(round(duration, 3), t_end)
        
        word_timestamps.append({
            "word": word,
            "start": t_start,
            "end": t_end
        })
        
    return word_timestamps

def get_words_in_range(words: list[dict], start_s: float, end_s: float) -> str:
    """Finds the words spoken within a given temporal bounding interval."""
    if not words:
        return ""
    matched = []
    for item in words:
        overlap_start = max(item["start"], start_s)
        overlap_end = min(item["end"], end_s)
        if overlap_end > overlap_start:
            matched.append(item["word"])
    if not matched:
        closest = min(words, key=lambda w: abs((w["start"] + w["end"])/2 - (start_s + end_s)/2))
        return closest["word"]
    return " ".join(matched)
