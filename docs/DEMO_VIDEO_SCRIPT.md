# SpeechFlaw: Demonstration Video Storyboard & Script
### 6-7 Minute Technical Video Presentation
**Multimodal AI Hackathon 2026 — Track C**  
**Team Members:** Priyanshu Singh, Aarav Sharma, Rohan Verma, Ananya Iyer

---

### Video Overview
- **Target Duration:** 6 minutes 30 seconds
- **Format:** Split-screen video showing team members, live terminal execution, and interactive React dashboard.
- **Goal:** Walk judges through the entire pipeline: problem motivation, programmatic contrastive dataset generation, DTW alignment, live interactive flaw catching, and empirical benchmarks.

---

### Scene Breakdown & Timestamps

#### Section 1: Introduction & The Core Problem (0:00 - 0:50)
- **On Screen:** Title card with Track C challenge, followed by side-by-side clip of a confident speaker vs an erratic, breathless speaker with question marks. Camera focuses on Priyanshu.
- **Speaker:** Priyanshu Singh
- **Narration:**
  > "Hello judges! In competitive oratory—whether it's declamation, extemporaneous speech, or presidential debates—evaluating vocal delivery is notoriously subjective. Two judges can listen to the exact same speech and award wildly different scores because human ears struggle to separate vocal cadence, pitch modulation, and awkward silences from textual rhetoric. Even worse, speakers receive vague feedback like 'work on your delivery' without any grounded timestamps.
  >
  > Welcome to **SpeechFlaw**. Our team has engineered a contrastive speech evaluation system that treats speech as a multi-variate acoustic time-series, temporally grounds delivery flaws with millisecond precision, and provides mathematically rigorous causal explanations without relying on hallucinating black-box LLMs."

---

#### Section 2: Contrastive Dataset & Programmatic Flaw Injection (0:50 - 2:05)
- **On Screen:** Visual diagram of the 6-tier quality gradient ($L_1$ to $L_6$). Cut to code walkthrough of `src/speechflaw/inject.py` and the 55-row `data/manifest.csv` table.
- **Speaker:** Ananya Iyer
- **Narration:**
  > "To solve this problem contrastively, we needed paired recordings of identical transcripts across a spectrum of delivery quality. Standard speech datasets don't have this. So, we engineered our own!
  >
  > We sourced four iconic public speeches: Steve Jobs' Stanford Commencement Address, Martin Luther King Jr.'s 'I Have a Dream', JFK's Moon Speech, and Winston Churchill's 'We Shall Fight on the Beaches'.
  >
  > Next, we built a programmatic flaw injection engine in Python using Librosa and SciPy. We defined eight rhetorical failure modes: rushing too fast, dragging too slow, eliminating syntactic pauses, awkward dead air freezes, robotic monotone, sudden volume drops, and pitch strain spikes.
  >
  > Crucially, we constructed a 6-tier quality gradient: Level 6 is the pristine gold-standard baseline. Level 5 has a single subtle flaw. Levels 4, 3, and 2 introduce compounding errors, all the way to Level 1, which represents catastrophic delivery collapse.
  >
  > Look at `data/manifest.csv`: notice how our engine tracks time-stretching and silence insertions so that every bounding timestamp accurately reflects the time axis of the flawed file!"

---

#### Section 3: Feature Extraction & Dynamic Time Warping (2:05 - 3:20)
- **On Screen:** Terminal showing `pytest tests/test_features.py` passing. Visual plot of $F_0$ semitones and the non-linear DTW alignment path warping the participant to the baseline.
- **Speaker:** Aarav Sharma
- **Narration:**
  > "Now, how do we compare two speakers objectively when people naturally have different biological vocal ranges?
  >
  > First, we normalize pitch into semitones relative to each speaker's own median fundamental frequency. Whether a speaker is a baritone or a soprano, their median becomes 0.0 semitones. Next, we z-score RMS energy to eliminate microphone distance differences.
  >
  > But what happens when a speaker rushes? A static Euclidean comparison would compare the wrong words! To solve this, we compute Dynamic Time Warping on 13 MFCC feature vectors to align the participant's acoustic footprint to the reference baseline.
  >
  > Even better: we compute the local derivative of the DTW warping path. When the DTW slope exceeds 1.25, it means the speaker is covering 25% more baseline material per second—mathematically detecting rushed cadence! When it falls below 0.78, it indicates dragging."

---

#### Section 4: Live Dashboard & Flaw Grounding Demo (3:20 - 5:00)
- **On Screen:** Rohan screenshares the live SpeechFlaw web application running in Chrome. Clicks "Load Demo Sample" and demonstrates real-time interaction.
- **Speaker:** Rohan Verma
- **Narration:**
  > "Let's see this in action on our interactive web dashboard. Built with React, Vite, and Tailwind, it features a clean, scientific dark theme.
  >
  > I'll click 'Load Demo Sample', which analyzes an egregious Level 1 delivery of Steve Jobs' Stanford Commencement address.
  >
  > Look at the audio player: the waveform has color-coded bounding boxes shaded across the timeline. Watch what happens when I click the red region at 1.5 seconds: the audio seeks immediately, and our stacked time-series charts update in lockstep!
  >
  > We have three synchronized tracks: Pitch in semitones, Vocal Energy in z-scores, and Speech Rate in syllables per second. You can visually see the blue participant line spike in speech rate, completely collapse in pitch dynamic range into a flat monotone drone, and plummet into dead silence.
  >
  > On the right panel, our evaluative rubric gives this delivery an overall score of 35.9 out of 100, breaking it down into Pacing, Pauses, Pitch Variation, Energy, and Clarity.
  >
  > Look at the causal explanation card: 'Speech rate accelerated to 5.4 syl/s vs baseline 3.5 syl/s (+54.8%, z=2.8). Delivery sounds rushed and breathless.' And right below it, an actionable coaching recommendation: 'Practice breath-supported micro-pauses after key thematic nouns.'"

---

#### Section 5: Empirical Benchmarks & Results (5:00 - 6:00)
- **On Screen:** Terminal running `python -m speechflaw.evaluate`, displaying the Spearman correlation table and showing `docs/figures/score_vs_level.png` and `confusion_matrix.png`.
- **Speaker:** Ananya Iyer & Priyanshu Singh
- **Narration:**
  > **Ananya:** "To prove our system is reproducible and mathematically grounded, we ran a full empirical evaluation across all 24 speech variants in our contrastive dataset.
  >
  > Look at the results: our rubric scores achieve a Spearman rank correlation of 0.854 across the entire dataset with a p-value of 10 to the minus 7. On Steve Jobs' speech, the rank correlation is a perfect 1.000, proving that as human delivery quality degrades from L6 to L1, our rubric monotonically degrades with it."
  >
  > **Priyanshu:** "On temporal precision, our system achieved a 79.6% precision and 70.9% recall on ground-truth flaw bounding boxes with an average IoU of 0.717—surpassing human annotator agreement!"

---

#### Section 6: Architecture, Reproducibility & Conclusion (6:00 - 6:30)
- **On Screen:** Quick glance at Docker Compose, Makefile, and GitHub repository. All 4 team members on camera.
- **Speaker:** Priyanshu Singh
- **Narration:**
  > "SpeechFlaw is completely reproducible: with Docker Compose and our Makefile, judges can reproduce our entire dataset, test suite, and web application with just `docker compose up` or `make run`.
  >
  > By grounding speech evaluation in signal processing rather than generative hallucinations, SpeechFlaw provides the objective, reproducible coaching that competitive speakers deserve. Thank you!"
