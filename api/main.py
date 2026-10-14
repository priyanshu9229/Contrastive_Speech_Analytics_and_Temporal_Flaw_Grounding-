"""
api.main: SpeechFlaw FastAPI Analytics Service
Multimodal AI Hackathon 2026 - Track C

Provides RESTful endpoints for contrastive speech analysis, temporal flaw grounding,
downsampled time-series visualization, and baseline catalog retrieval.
"""

import os
import shutil
import tempfile
import numpy as np
import soundfile as sf
import librosa
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from speechflaw.features import extract_speech_features
from speechflaw.detect import detect_flaws
from speechflaw.explain import explain_all_flaws
from speechflaw.score import compute_rubric_scores

app = FastAPI(
    title="SpeechFlaw API",
    description="Contrastive Speech Analytics & Temporal Flaw Grounding Backend",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for audio playback
if os.path.exists("data/raw"):
    app.mount("/static/raw", StaticFiles(directory="data/raw"), name="static_raw")
if os.path.exists("data/dataset"):
    app.mount("/static/dataset", StaticFiles(directory="data/dataset"), name="static_dataset")

BASELINES_CATALOG = [
    {
        "id": "stay_hungry",
        "title": "Stanford Commencement Address (2005)",
        "speaker": "Steve Jobs",
        "category": "Inspirational Keynote",
        "duration": 26.16,
        "transcript_path": "data/raw/stay_hungry.txt",
        "audio_url": "/static/raw/stay_hungry.wav"
    },
    {
        "id": "dream",
        "title": "I Have a Dream (1963)",
        "speaker": "Martin Luther King Jr.",
        "category": "Civil Rights Oratory",
        "duration": 21.12,
        "transcript_path": "data/raw/dream.txt",
        "audio_url": "/static/raw/dream.wav"
    },
    {
        "id": "moon",
        "title": "We Choose to go to the Moon (1962)",
        "speaker": "John F. Kennedy",
        "category": "Presidential Visionary",
        "duration": 16.22,
        "transcript_path": "data/raw/moon.txt",
        "audio_url": "/static/raw/moon.wav"
    },
    {
        "id": "beaches",
        "title": "We Shall Fight on the Beaches (1940)",
        "speaker": "Winston Churchill",
        "category": "Wartime Address",
        "duration": 21.70,
        "transcript_path": "data/raw/beaches.txt",
        "audio_url": "/static/raw/beaches.wav"
    }
]

def downsample_series(times: np.ndarray, values: np.ndarray, target_fps: int = 20, is_pitch: bool = False) -> tuple[list, list]:
    """Downsamples high-resolution 100Hz time series to 20Hz for fast web rendering."""
    if len(times) == 0:
        return [], []
    total_duration = times[-1]
    step = 1.0 / target_fps
    sample_times = np.arange(0, total_duration, step)
    
    # Linear interpolation
    if is_pitch:
        # Interpolate only voiced frames, leaving unvoiced as None/null
        out_vals = []
        for t in sample_times:
            idx = int(round(t * 100))
            if idx < len(values):
                val = values[idx]
                if np.isnan(val) or val == -999.0:
                    out_vals.append(None)
                else:
                    out_vals.append(round(float(val), 2))
            else:
                out_vals.append(None)
    else:
        out_vals = []
        for t in sample_times:
            idx = int(round(t * 100))
            if idx < len(values):
                val = values[idx]
                out_vals.append(round(float(val), 2) if not np.isnan(val) else 0.0)
            else:
                out_vals.append(0.0)
                
    return [round(float(t), 2) for t in sample_times], out_vals

def run_pipeline(part_audio_path: str, transcript: str, base_audio_path: str):
    """Core analytics execution pipeline."""
    from speechflaw.audio_utils import probe_audio_duration
    from speechflaw.align import validate_audio_transcript, normalize_transcript
    dur = probe_audio_duration(part_audio_path)
    if dur > 300.0:
        raise HTTPException(status_code=400, detail="Audio duration exceeds 5-minute limit (maximum 300 seconds).")
        
    # 1. Input validation & transcript normalization
    wer, warning, asr_text, asr_words = validate_audio_transcript(part_audio_path, transcript)
    clean_transcript = normalize_transcript(transcript, asr_words) if transcript else asr_text
        
    part_feat = extract_speech_features(part_audio_path, transcript=clean_transcript, use_cache=True)
    base_feat = extract_speech_features(base_audio_path, use_cache=True)
    
    # Detect and explain flaws
    flaws = detect_flaws(part_feat, base_feat)
    explained_flaws = explain_all_flaws(flaws)
    scores = compute_rubric_scores(part_feat, base_feat, flaws)
    
    # Downsample time series for both participant and baseline at 20 fps
    p_times, p_pitch = downsample_series(part_feat["times"], part_feat["f0_semitones"], target_fps=20, is_pitch=True)
    _, p_energy = downsample_series(part_feat["times"], part_feat["rms_z"], target_fps=20)
    _, p_rate = downsample_series(part_feat["times"], part_feat["speech_rate"], target_fps=20)
    
    b_times, b_pitch = downsample_series(base_feat["times"], base_feat["f0_semitones"], target_fps=20, is_pitch=True)
    _, b_energy = downsample_series(base_feat["times"], base_feat["rms_z"], target_fps=20)
    _, b_rate = downsample_series(base_feat["times"], base_feat["speech_rate"], target_fps=20)
    
    return {
        "scores": scores,
        "flaw_regions": explained_flaws,
        "warning": warning,
        "wer": round(float(wer), 4),
        "asr_transcript": asr_text,
        "summary": {
            "duration": round(float(dur), 2),
            "sample_rate": 16000,
            "flaw_count": len(explained_flaws),
            "overall_score": scores["overall"]
        },
        "time_series": {
            "participant": {
                "times": p_times,
                "pitch": p_pitch,
                "energy": p_energy,
                "rate": p_rate
            },
            "baseline": {
                "times": b_times,
                "pitch": b_pitch,
                "energy": b_energy,
                "rate": b_rate
            }
        },
        "words": part_feat.get("words", [])
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "SpeechFlaw Analytics",
        "version": "1.0.0",
        "features": ["dtw_alignment", "temporal_grounding", "causal_explainability", "rubric_scoring"]
    }

@app.get("/baselines")
def list_baselines():
    res = []
    for b in BASELINES_CATALOG:
        t_text = ""
        if os.path.exists(b["transcript_path"]):
            with open(b["transcript_path"], "r", encoding="utf-8") as f:
                t_text = f.read().strip()
        item = b.copy()
        item["transcript"] = t_text
        res.append(item)
    return res

@app.get("/demo")
def get_demo_analysis():
    """Zero-setup demo analyzing bundled stay_hungry_L1 against pristine baseline."""
    part_wav = "data/dataset/stay_hungry_L1.wav"
    base_wav = "data/raw/stay_hungry.wav"
    txt_path = "data/raw/stay_hungry.txt"
    with open(txt_path, "r", encoding="utf-8") as f:
        transcript = f.read().strip()
        
    res = run_pipeline(part_wav, transcript, base_wav)
    res["audio_url"] = "/static/dataset/stay_hungry_L1.wav"
    res["baseline_audio_url"] = "/static/raw/stay_hungry.wav"
    res["baseline_title"] = "Steve Jobs - Stanford Commencement Address"
    return res

@app.post("/analyze")
async def analyze_speech(
    participant_audio: UploadFile = File(...),
    transcript: Optional[str] = Form(None),
    baseline_id: Optional[str] = Form("stay_hungry"),
    baseline_audio: Optional[UploadFile] = File(None)
):
    ext = os.path.splitext(participant_audio.filename)[1].lower()
    if ext not in [".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac"]:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format '{ext}'. Please upload WAV, MP3, M4A, AAC, or OGG.")
        
    temp_dir = tempfile.mkdtemp(prefix="speechflaw_")
    raw_part_path = os.path.join(temp_dir, f"participant_raw{ext}")
    
    try:
        with open(raw_part_path, "wb") as f:
            shutil.copyfileobj(participant_audio.file, f)
            
        # Transcode non-WAV formats (such as M4A, AAC) to clean 16kHz mono WAV
        from speechflaw.audio_utils import convert_to_wav
        if ext != ".wav":
            part_path = os.path.join(temp_dir, "participant.wav")
            convert_to_wav(raw_part_path, part_path, target_sr=16000)
        else:
            part_path = raw_part_path
            
        # Determine baseline audio
        if baseline_audio is not None and baseline_audio.filename:
            b_ext = os.path.splitext(baseline_audio.filename)[1].lower()
            raw_base_path = os.path.join(temp_dir, f"custom_baseline_raw{b_ext}")
            with open(raw_base_path, "wb") as f:
                shutil.copyfileobj(baseline_audio.file, f)
            if b_ext != ".wav":
                base_path = os.path.join(temp_dir, "custom_baseline.wav")
                convert_to_wav(raw_base_path, base_path, target_sr=16000)
            else:
                base_path = raw_base_path
        else:
            base_path = f"data/raw/{baseline_id}.wav"
            if not os.path.exists(base_path):
                raise HTTPException(status_code=404, detail=f"Baseline speech ID '{baseline_id}' not found.")
                
        # Resolve transcript if omitted
        if not transcript or not transcript.strip():
            txt_candidate = f"data/raw/{baseline_id}.txt"
            if os.path.exists(txt_candidate):
                with open(txt_candidate, "r", encoding="utf-8") as f:
                    transcript = f.read().strip()
            else:
                transcript = ""
                
        # Expose transcoded participant audio for guaranteed universal web playback
        os.makedirs("data/dataset", exist_ok=True)
        static_wav = "data/dataset/current_participant.wav"
        shutil.copyfile(part_path, static_wav)
        
        result = run_pipeline(part_path, transcript, base_path)
        result["audio_url"] = "/static/dataset/current_participant.wav"
        return result
        
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
