import asyncio
import os
import edge_tts
import soundfile as sf
import librosa
import numpy as np

BASELINES = [
    {
        "id": "stay_hungry",
        "voice": "en-US-ChristopherNeural",
        "text_file": "data/raw/stay_hungry.txt",
        "output_wav": "data/raw/stay_hungry.wav"
    },
    {
        "id": "dream",
        "voice": "en-US-EricNeural",
        "text_file": "data/raw/dream.txt",
        "output_wav": "data/raw/dream.wav"
    },
    {
        "id": "moon",
        "voice": "en-US-GuyNeural",
        "text_file": "data/raw/moon.txt",
        "output_wav": "data/raw/moon.wav"
    },
    {
        "id": "beaches",
        "voice": "en-GB-RyanNeural",
        "text_file": "data/raw/beaches.txt",
        "output_wav": "data/raw/beaches.wav"
    }
]

async def generate_baseline(item):
    text_path = item["text_file"]
    with open(text_path, "r", encoding="utf-8") as f:
        text = f.read().strip()
    
    mp3_temp = f"data/raw/{item['id']}_temp.mp3"
    print(f"Generating audio for {item['id']} using {item['voice']}...")
    communicate = edge_tts.Communicate(text, item["voice"])
    await communicate.save(mp3_temp)
    
    # Load and resample to exactly 16000 Hz Mono
    audio, sr = librosa.load(mp3_temp, sr=16000, mono=True)
    # Peak normalize to -1.0 dB
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = (audio / peak) * 0.89
    
    sf.write(item["output_wav"], audio, 16000, subtype='PCM_16')
    if os.path.exists(mp3_temp):
        os.remove(mp3_temp)
    dur = len(audio) / 16000.0
    print(f"-> Saved {item['output_wav']} ({dur:.2f}s, 16kHz mono)")

async def main():
    os.makedirs("data/raw", exist_ok=True)
    for item in BASELINES:
        await generate_baseline(item)
    print("All baseline audios generated successfully!")

if __name__ == "__main__":
    asyncio.run(main())
