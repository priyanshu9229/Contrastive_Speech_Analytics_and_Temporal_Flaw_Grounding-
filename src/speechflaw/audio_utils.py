"""
speechflaw.audio_utils: Universal Audio Ingestion & Transcoding Engine
Multimodal AI Hackathon 2026 - Track C

Provides robust loading and decoding for all audio formats (WAV, MP3, M4A, AAC, OGG, FLAC)
with automatic fallback to bundled FFmpeg transcoding when libsndfile lacks codec support.
"""

import os
import shutil
import subprocess
import numpy as np
import soundfile as sf
import librosa

def get_ffmpeg_binary() -> str | None:
    """Finds available FFmpeg executable from imageio-ffmpeg or system PATH."""
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and os.path.exists(exe):
            return exe
    except Exception:
        pass
    return shutil.which("ffmpeg")

def convert_to_wav(input_path: str, output_path: str = None, target_sr: int = 16000) -> str:
    """
    Transcodes any audio file (e.g., .m4a, .aac, .wma) into a 16kHz mono 16-bit PCM WAV.
    """
    if output_path is None:
        base, _ = os.path.splitext(input_path)
        output_path = f"{base}_transcoded.wav"

    ffmpeg_exe = get_ffmpeg_binary()
    if ffmpeg_exe:
        cmd = [
            ffmpeg_exe,
            "-y",
            "-i", input_path,
            "-ar", str(target_sr),
            "-ac", "1",
            "-c:a", "pcm_s16le",
            output_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res.returncode == 0 and os.path.exists(output_path):
            return output_path

    # Fallback via librosa / audioread
    try:
        y, sr = librosa.load(input_path, sr=target_sr, mono=True)
        sf.write(output_path, y, target_sr, subtype='PCM_16')
        return output_path
    except Exception as e:
        raise RuntimeError(f"Failed to transcode audio '{input_path}' to WAV: {e}")

def probe_audio_duration(audio_path: str) -> float:
    """Safely determines audio duration in seconds across all formats including M4A."""
    try:
        info = sf.info(audio_path)
        return float(info.duration)
    except Exception:
        # Fallback using ffmpeg or transcoding
        ffmpeg_exe = get_ffmpeg_binary()
        if ffmpeg_exe:
            # Transcode to temp wav to check
            temp_wav = f"{audio_path}_probe.wav"
            try:
                convert_to_wav(audio_path, temp_wav)
                dur = float(sf.info(temp_wav).duration)
                if os.path.exists(temp_wav):
                    os.remove(temp_wav)
                return dur
            except Exception:
                pass
        y, sr = librosa.load(audio_path, sr=16000, mono=True)
        return float(len(y) / sr)

def load_audio(audio_path: str, target_sr: int = 16000) -> tuple[np.ndarray, int]:
    """
    Loads audio signal as 16kHz mono float32 array, seamlessly handling M4A, AAC,
    MP3, and standard WAV.
    """
    try:
        y, sr = sf.read(audio_path)
        if y.ndim > 1:
            y = np.mean(y, axis=1)
        if sr != target_sr:
            y = librosa.resample(y, orig_sr=sr, target_sr=target_sr)
        return y.astype(np.float32), target_sr
    except Exception:
        # Codec not supported by libsndfile (e.g. M4A/AAC) -> transcode via FFmpeg
        temp_wav = f"{audio_path}_tmp_conv.wav"
        try:
            convert_to_wav(audio_path, temp_wav, target_sr=target_sr)
            y, sr = sf.read(temp_wav)
            if y.ndim > 1:
                y = np.mean(y, axis=1)
            return y.astype(np.float32), target_sr
        finally:
            if os.path.exists(temp_wav):
                try:
                    os.remove(temp_wav)
                except Exception:
                    pass
