# SpeechFlaw 🎙️⚡
### Contrastive Speech Analytics & Temporal Flaw Grounding
**Multimodal AI Hackathon 2026 — Track C Challenge**

[![Python 3.10+](https://img.shields.io/badge/python-3.10%20%7C%203.11%20%7C%203.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.3-646cff.svg)](https://vitejs.dev)
[![Tests Passing](https://img.shields.io/badge/pytest-passing-success.svg)](https://docs.pytest.org)
[![Spearman Correlation](https://img.shields.io/badge/Spearman%20%CF%81-0.8542-brightgreen.svg)]()
[![Temporal IoU](https://img.shields.io/badge/Mean%20IoU-0.7169-brightgreen.svg)]()

> **SpeechFlaw** is an automated, mathematically rigorous speech evaluation system designed to bridge the gap between subjective oratorical assessment and objective acoustic signal processing. By pairing gold-standard baseline public speeches ($L_6$) against a systematically degraded spectrum of flawed deliveries ($L_1$ to $L_5$), the system temporally isolates delivery flaws with millisecond precision, computes non-hallucinated causal explanations, and delivers reproducible $0-100$ rubric scores.

---

## 👥 Engineering Team
- **Priyanshu Singh** — *System Architecture, DTW Alignment & Core Speech Pipeline*
- **Aarav Sharma** — *Acoustic Modeling, Feature Extraction & Signal Normalization*
- **Rohan Verma** — *Frontend Architecture, Interactive Multi-Track Dashboard & Visualization*
- **Ananya Iyer** — *Dataset Engineering, Flaw Injection Taxonomy & Benchmark Evaluation*

---

## ⚡ Quickstart (3 Commands)

### Option 1: Native Local Run
```bash
# 1. Install dependencies and local package
pip install -r requirements.txt && pip install -e . --no-deps && cd web && npm install && cd ..

# 2. Run test suite and verify dataset
pytest tests/ -v

# 3. Start API backend and frontend
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
# In another terminal:
cd web && npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser!

### Option 2: 1-Command Docker Deployment
```bash
docker compose up --build
```
- Interactive Web App: `http://localhost:5173`
- FastAPI REST Docs: `http://localhost:8000/docs`

---

## 📊 Benchmark Results

Evaluated across the 24-clip contrastive corpus ($4\text{ speeches} \times 6\text{ delivery quality tiers}$):

| Evaluation Metric | Benchmark Result | Target Requirement | Status |
| :--- | :---: | :---: | :---: |
| **Spearman Rank Correlation ($\rho$)** | **`0.8542`** ($p = 1.10 \times 10^{-7}$) | Monotonic with gradient | **Exceeded** |
| - *Steve Jobs Keynote (`stay_hungry`)* | **`1.0000`** ($p = 0.000$) | Monotonic | **Perfect** |
| - *Martin Luther King Jr. (`dream`)* | **`0.9429`** ($p = 0.005$) | Monotonic | **Exceeded** |
| - *John F. Kennedy (`moon`)* | **`0.8804`** ($p = 0.021$) | Monotonic | **Exceeded** |
| - *Winston Churchill (`beaches`)* | **`0.8286`** ($p = 0.042$) | Monotonic | **Exceeded** |
| **Temporal Bounding Precision** | **`79.6%`** | Sufficient temporal precision | **High Precision** |
| **Temporal Bounding Recall** | **`70.9%`** | Sufficient temporal precision | **Robust Coverage** |
| **Temporal Bounding F1-Score** | **`75.0%`** | Reproducible bounding | **Strong** |
| **Mean IoU on Detected Hits** | **`0.717`** (71.7% overlap) | $\text{IoU} \ge 0.30$ | **2.39x Above Threshold** |

### Evaluation Figures
Generated automatically into `docs/figures/`:
1. `docs/figures/score_vs_level.png`: Boxplot and scatter of overall rubric scores across tiers $L_1$ to $L_6$.
2. `docs/figures/confusion_matrix.png`: Heatmap of flaw classification performance across the 8 failure modes.

To re-run the benchmark and update figures:
```bash
python -m speechflaw.evaluate
# or: make eval
```

---

## 📁 Repository Structure

```
.
├── SPEC.md                    # Core algorithmic and architectural specification
├── Makefile                   # make data, make eval, make test, make run
├── Dockerfile                 # Production Dockerfile for Python FastAPI backend
├── docker-compose.yml         # Containerized stack (API + Web)
├── pyproject.toml             # Python build definition
├── requirements.txt           # Pinned Python dependencies
├── data/
│   ├── raw/                   # Baseline audio (16kHz mono) & text transcripts
│   │   ├── stay_hungry.wav & .txt (Steve Jobs Stanford 2005)
│   │   ├── dream.wav & .txt       (MLK I Have a Dream 1963)
│   │   ├── moon.wav & .txt        (JFK Moon Speech 1962)
│   │   └── beaches.wav & .txt     (Winston Churchill 1940)
│   ├── dataset/               # 24 generated mirrored recordings (L1-L6)
│   └── manifest.csv           # Ground-truth temporal flaw bounding intervals
├── src/
│   └── speechflaw/
│       ├── __init__.py        # Package metadata and team authorship
│       ├── inject.py          # Programmatic flaw injection engine
│       ├── align.py           # Word-level forced alignment & VAD segmentation
│       ├── features.py        # 10ms hop acoustic feature extraction & caching
│       ├── detect.py          # DTW alignment & windowed z-score anomaly detection
│       ├── explain.py         # Deterministic causal explainability & coaching tips
│       ├── score.py           # Evaluative rubric scoring (0-100)
│       └── evaluate.py        # Empirical evaluation suite & figure generation
├── api/
│   └── main.py                # FastAPI REST service (/analyze, /baselines, /demo)
├── web/                       # React 18 + Vite + Tailwind CSS dashboard
│   ├── src/
│   │   ├── App.jsx            # Interactive dashboard with synchronized multi-track
│   │   ├── main.jsx           # React DOM mounting
│   │   └── index.css          # Dark theme styles
│   └── package.json           # Frontend dependencies
├── tests/
│   ├── test_inject.py         # Pytest for injection bounds and file durations
│   ├── test_features.py       # Pytest for synthetic signals and semitone F0
│   ├── test_detect_score.py   # Pytest for DTW detection, explainability, monotonicity
│   └── test_api.py            # Pytest for FastAPI endpoints with TestClient
└── docs/
    ├── TECHNICAL.md           # 6-page technical report with math & metrics
    ├── DEMO_VIDEO_SCRIPT.md   # 6-7 minute video demo script with storyboard
    ├── results.json           # Serialized empirical evaluation metrics
    └── figures/
        ├── score_vs_level.png
        └── confusion_matrix.png
```

---

## 🎯 Delivery Flaw Taxonomy

The system explicitly models eight rhetorical delivery failure modes:

| Flaw Code | Flaw Label | Primary Acoustic Signature | Perceptual Impact |
| :--- | :--- | :--- | :--- |
| `too_fast` | Pushed Cadence | DTW slope $\frac{db}{dp} \ge 1.25$, syllable rate $z > 1.85$ | Breathless rushing, listener comprehension loss. |
| `too_slow` | Dragged Cadence | DTW slope $\frac{db}{dp} \le 0.78$, syllable rate $z < -1.85$ | Loss of rhetorical momentum and energy. |
| `missing_pauses`| Missing Pauses | Inter-word pauses stripped, pause ratio $< 8\%$ | Syntax severing, unpunctuated run-on delivery. |
| `long_pauses` | Dead Air Freeze | Silence interval $\ge 0.8\text{ s} - 2.4\text{ s}$ ($\text{RMS} < -38\text{ dB}$) | Unnatural hesitation, disrupted train of thought. |
| `monotone` | Prosodic Collapse| Semitone pitch std $< 1.35\text{ st}$, variance ratio $< 0.38$ | Robotic drone, lack of emotional resonance. |
| `volume_drop` | Decrescendo Drop | Local acoustic energy drop $> 8.5\text{ dB}$ (RMS $z < -1.95$) | Trailing off, unconfident vocal projection. |
| `pitch_spike` | Vocal Pitch Spike| Local $F_0$ excursion $> +3.2\text{ semitones}$ | Vocal strain, cracking, perceived anxiety. |
| `stumble_filler`| Articulation Disruption | Micro-syllable repetition and spectral flux spike | Loss of polish, momentary verbal stumble. |

---

## 🖥️ Interactive Dashboard Highlights

1. **One-Click Demo**: Judges can click **"Load Demo Sample"** to instantly test the pipeline without uploading external files.
2. **Synchronized Multi-Track Time-Series**: Three stacked interactive curves on a unified time axis:
   - *Track 1*: $F_0$ Semitones relative to speaker median (Participant vs. Reference)
   - *Track 2*: Vocal Energy Projection (Z-Scored RMS dB)
   - *Track 3*: Cadence Velocity (Syllables / Sec)
3. **Interactive Flaw Bounding**: Every flaw region is shaded on the waveform and time-series tracks. Clicking a flaw card seeks the audio player to that exact millisecond.
4. **Causal Coaching Cards**: Translates raw mathematical deltas into plain-language diagnostics with actionable delivery tips.

---

## 🔬 Scientific Reproducibility Guarantees

- **Fixed Seed**: All pseudo-random acoustic operations are pinned to `seed = 42`.
- **Speaker-Agnostic Pitch**: Log-$F_0$ converted to semitones centered on speaker's median: $12 \log_2(F_0 / F_{0,\text{med}})$.
- **Zero Generative Stochasticity**: No black-box LLMs in the scoring path. The exact same audio input will yield bit-identical scores, bounding coordinates, and explanations across repeated runs.

---

## 📝 Running Tests

Execute the full automated test suite:
```bash
pytest tests/ -v
```
All unit tests validate:
- Temporal bounding intervals inside file durations.
- Monotonicity of scores across quality levels ($L_6 > L_5 > L_1$).
- Synthetic sine/noise signal feature extraction and semitone normalization.
- FastAPI endpoints, file size guards, and unsupported format handling.

---

## 📜 Technical Documentation & Video Storyboard
- **[docs/TECHNICAL.md](docs/TECHNICAL.md)**: 6-page comprehensive technical report covering mathematical formulations, DTW derivatives, acoustic normalization, and empirical evaluation.
- **[docs/DEMO_VIDEO_SCRIPT.md](docs/DEMO_VIDEO_SCRIPT.md)**: Complete 6-7 minute video demo script with timestamps, visual cues, and narration.

---

## ⚖️ License
Released under the MIT License. Developed for the **Multimodal AI Hackathon 2026**.
