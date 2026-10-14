Prompt 1: Scaffold and spec

Create a Python 3.11 + React project called "speechflaw" for Track C of a hackathon: contrastive speech analytics and temporal flaw grounding.

Structure:
- data/raw (baseline audio + transcripts), data/dataset (generated), data/manifest.csv
- src/speechflaw/{inject.py, align.py, features.py, detect.py, explain.py, score.py, evaluate.py}
- api/main.py (FastAPI)
- web/ (Vite + React)
- tests/, docs/, README.md, requirements.txt, Dockerfile, docker-compose.yml

Write SPEC.md covering:
1. Flaw taxonomy: too_fast, too_slow, missing_pauses, long_pauses, monotone, volume_drop, pitch_spike, stumble_filler
2. Quality levels L1 (egregious) to L5 (almost perfect), L6 = original baseline
3. Rubric subscores (0-100): pacing, pauses, pitch_variation, energy, clarity, with weights 0.25/0.2/0.2/0.15/0.2
4. All randomness uses seed 42; everything must be deterministic.
Do not write feature code yet. Show me the plan first.


Prompt 2: Dataset with programmatic flaw injection
Implement src/speechflaw/inject.py. Input: a clean baseline wav (16 kHz mono) and its transcript.
Generate mirrored "flawed" versions at levels L1-L5 by injecting flaws at KNOWN time regions using librosa/numpy/scipy:
- too_fast / too_slow: time-stretch a segment (rate 1.4x / 0.7x)
- missing_pauses: remove silences > 250 ms in a segment
- long_pauses: insert 1.0-2.5 s of low-level room noise
- monotone: flatten F0 of a segment (pyin + resynthesis, or pitch-shift toward median)
- volume_drop: gain -12 dB with a smooth fade
- pitch_spike: shift +4 semitones on a short segment
Severity gradient: L1 = 4-5 flaws, strong magnitude, long regions; L5 = one subtle flaw, small magnitude.
For each output write a row in data/manifest.csv: clip_id, speech_id, level, flaw_type, start_s, end_s, magnitude, baseline_path, flawed_path, transcript_path.
Output regions must be in the TIME AXIS OF THE FLAWED FILE (account for stretching/insertions).
Add a CLI: python -m speechflaw.inject --speech-id X. Add pytest tests that check manifest timestamps are within file duration.


Prompt 3: Alignment and features

Implement src/speechflaw/align.py and features.py.
align.py: word-level timestamps using faster-whisper (word_timestamps=True), matched to the provided transcript with difflib. Fallback: if it fails, distribute words proportionally over speech-active regions. Return a list of {word, start, end}.
features.py: compute on a 10 ms hop and return a dict of aligned time series:
- log-F0 in semitones relative to the speaker's own median (pyin or parselmouth), NaN for unvoiced
- RMS energy in dB, z-scored per recording (speaker-agnostic)
- 13 MFCCs plus delta, spectral flux from an STFT (FFT)
- speech rate (syllables/sec in a 1 s sliding window from word timestamps)
- pause intervals (gaps between words > 200 ms)
- HNR, jitter, shimmer via parselmouth per 1 s window
Cache results as .npz in a cache/ folder. Add tests on a synthetic sine/noise signal.


Prompt 4: Detection and explanation

Implement detect.py, explain.py and score.py.
detect.py:
1. DTW-align the participant to the baseline on MFCCs (librosa.sequence.dtw) so time warps are handled.
2. Over 1.5 s windows (0.5 s hop) compute the deviation of each feature from baseline: z-score using the baseline's own windowed statistics.
3. Mark windows with |z| > 2.0 on any feature, merge adjacent ones, drop regions < 0.6 s.
4. Classify the flaw type with explicit rules on which features deviate (e.g. rate z>2 and positive -> too_fast; F0 variance ratio < 0.4 -> monotone).
Return: [{start, end, flaw_type, severity 0-1, evidence: {feature, participant_value, baseline_value, z, pct_change}}]
explain.py: template-based, deterministic text, e.g. "0:42-0:47 ('we shall fight on'): speech rate 5.8 vs 3.4 syl/s (+71%, z=3.2); 3 expected pauses -> 0. Delivery sounds rushed." Include the words spoken in that region from the alignment, and a short actionable tip per flaw type.
score.py: the five subscores plus a weighted overall, from the penalties of the regions and global deviations.
No LLM in the scoring path.


Prompt 5: Evaluation metrics (for your docs and video)

Implement evaluate.py. Over the whole dataset report:
1. Spearman correlation between level (L1-L6) and overall score, per speech and overall
2. Temporal precision: IoU, precision and recall of detected regions vs injected regions in the manifest (IoU>=0.3 counts as a hit), per flaw type
3. Flaw type classification accuracy and a confusion matrix
4. Save results.json plus PNG plots (score vs level box plot, confusion matrix) into docs/figures/.
Add a "make eval" target. Run it and print the table.



Prompt 6: API

Create api/main.py with FastAPI:
- POST /analyze: multipart with participant audio, transcript text, and either a baseline_id (from the dataset) or a baseline audio file
- Returns JSON: scores, flaw_regions with explanations, downsampled time-series (pitch, energy, rate for both baseline and participant at 20 points/sec), word timestamps
- GET /baselines: list available baselines
- GET /health
Enable CORS. Handle errors with clear messages (bad format, too long > 5 min). Add tests with TestClient.


Prompt 7: Dashboard
Build the web/ frontend (React + Vite + Plotly.js + wavesurfer.js). Single page, clean dark theme, NO purple gradients or generic card grids.
1. Upload audio + paste transcript + choose baseline, "Analyze" button with a loading state
2. Waveform (wavesurfer) with flaw regions shaded and color-coded by flaw type; click a region to play that segment
3. Below it, three stacked Plotly time-series charts (pitch, energy, speech rate) overlaying baseline vs participant on the same shared x-axis, with the flaw regions shaded in each chart
4. Right panel: overall score, five subscores as bars, and a list of flaw cards (time range, words, severity, the causal explanation); hovering a card highlights the region
5. Include a "Load demo" button that analyzes a bundled sample so judges can try it in one click
Call the API at VITE_API_URL. Test it with the browser agent: upload a sample, confirm that the regions and explanations render.

Prompt 8: Reproducibility
Add Docker and docs for reproducibility:
- Dockerfile for the API (python:3.11-slim, ffmpeg, libsndfile, pinned requirements) and for the web app; docker-compose.yml so that `docker compose up` serves everything
- Pin versions in requirements.txt, set all seeds, add a Makefile: make data, make eval, make test, make run
- README.md: overview, quickstart (3 commands), dataset description and link, folder structure, how to reproduce the metrics, limitations
- Run the full test suite and fix any failures.


Prompt 9: Technical documentation (max 6 pages)
Write docs/TECHNICAL.md (max ~6 pages) with these sections: 1 Problem and approach, 2 Dataset construction (sources, flaw taxonomy, gradient design, manifest format), 3 Rubric and scoring methodology, 4 Feature extraction and normalisation (speaker-agnostic), 5 Alignment and temporal grounding, 6 Causal explanation method, 7 Results (use docs/figures and results.json, no invented numbers), 8 Limitations and future work. Then give me a command to convert it to PDF.


Prompt 10: Video script
Write a 6-7 minute YouTube demo script for this project: dataset collection and the flaw gradient (show the manifest and an L1 vs L6 clip), stress tests across levels, the dashboard catching a specific injected flaw with its explanation, the evaluation metrics, and a closing summary. Give timestamps, what is on screen, and the narration for each section.


Bug-fix template (use as needed)
Run the tests. For every failure, show me the root cause first, then fix it with the smallest change. Do not rewrite unrelated files.