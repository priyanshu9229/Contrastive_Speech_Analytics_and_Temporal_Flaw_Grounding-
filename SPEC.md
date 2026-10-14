# SpeechFlaw System Specification
## Track C: Contrastive Speech Analytics & Temporal Flaw Grounding
**Multimodal AI Hackathon 2026**

---

### 1. Executive Summary & Architecture Overview
SpeechFlaw is an automated, mathematically rigorous speech evaluation system designed to bridge the gap between subjective oratorical assessment and objective acoustic signal processing. The system pairs professional "ideal" baseline speeches with a spectrum of systematically degraded delivery variants, mapping acoustic deviations in time and synthesizing causal explanations and rubric scores without black-box hallucination.

```
+-----------------------------------------------------------------------------------+
|                              SPEECHFLAW ARCHITECTURE                              |
+-----------------------------------------------------------------------------------+
                                                                                     
  [Baseline Speech (L6)]       [Participant / Flawed Speech (L1-L5)]                 
         |                                      |                                    
         v                                      v                                    
  +------------------+                   +------------------+                        
  | Forced Alignment |                   | Forced Alignment |                        
  | (Word Timestamps)|                   | (Word Timestamps)|                        
  +--------+---------+                   +--------+---------+                        
           |                                      |                                  
           v                                      v                                  
  +------------------+                   +------------------+                        
  | Feature Extraction|                   | Feature Extraction|                       
  | (F0, RMS, MFCC,  |                   | (F0, RMS, MFCC,  |                        
  |  Rate, Pauses)   |                   |  Rate, Pauses)   |                        
  +--------+---------+                   +--------+---------+                        
           \                                      /                                  
            \                                    /                                   
             v                                  v                                    
            +------------------------------------+                                   
            | Dynamic Time Warping (DTW) on MFCC |                                   
            |   Non-linear temporal alignment    |                                   
            +-----------------+------------------+                                   
                              |                                                      
                              v                                                      
            +------------------------------------+                                   
            | Windowed Z-Score Deviation Engine  |                                   
            | (|z| > 2.0, multi-feature anomaly) |                                   
            +-----------------+------------------+                                   
                              |                                                      
                              v                                                      
            +------------------------------------+                                   
            | Temporal Grounding & Flaw Merging  |                                   
            |  ([t_start, t_end], Filter <0.6s)  |                                   
            +-----------------+------------------+                                   
                              |                                                      
                              v                                                      
            +-----------------+------------------+                                   
            | Rule-Based Flaw Classification    |                                   
            | & Causal Mathematical Explanation |                                   
            +-----------------+------------------+                                   
                              |                                                      
                              v                                                      
            +-----------------+------------------+                                   
            | Evaluative Rubric Scoring (0-100)  |                                   
            | (Pacing, Pauses, Pitch, Energy,    |                                   
            |  Clarity -> Overall Score)         |                                   
            +-----------------+------------------+                                   
                              |                                                      
                              v                                                      
            +-----------------+------------------+                                   
            |  FastAPI REST API & Interactive    |                                   
            |    React / Wavesurfer Dashboard    |                                   
            +------------------------------------+                                   
```

---

### 2. Delivery Flaw Taxonomy
The system explicitly models 8 fundamental rhetorical and acoustic delivery failure modes:

| Flaw Code | Flaw Name | Primary Acoustic Signature | Human Diagnostic & Perceptual Impact |
| :--- | :--- | :--- | :--- |
| `too_fast` | Pushed Cadence / Rushed Delivery | Syllable rate $z$-score $> +2.0$, local duration compression $> 30\%$ | Breathless rushing, loss of listener comprehension, inability to digest key rhetorical premises. |
| `too_slow` | Dragged Cadence / Lethargic Pacing | Syllable rate $z$-score $< -2.0$, local duration dilation $> 35\%$ | Loss of energy and momentum, listener boredom, sluggish delivery. |
| `missing_pauses` | Pause Elimination / Run-On Delivery | Silence intervals $< 150\text{ ms}$ where baseline has syntactic pauses $> 250\text{ ms}$ | Syntax severing, unpunctuated run-on sentences, lack of rhetorical digestion windows. |
| `long_pauses` | Dead Air / Rhetorical Freeze | Disproportionate silences $1.2\text{ s} - 2.8\text{ s}$ inside clause constituents | Awkward hesitations, lost train of thought, perceived cognitive stalling. |
| `monotone` | Pitch Flattening / Prosodic Collapse | $F_0$ variance ratio $\sigma_{\text{test}}^2 / \sigma_{\text{base}}^2 < 0.35$, semitone dynamic range $< 1.5\text{ st}$ | Flat robotic drone, lack of emotional resonance, absence of persuasive inflection. |
| `volume_drop` | Decrescendo Dropout / Energy Collapse | Local RMS energy drop $> 10\text{ dB}$, normalized energy $z$-score $< -2.0$ | Trailing off at clause ends, unconfident voice projection, audibility loss. |
| `pitch_spike` | Vocal Strain / Erratic Pitch Jump | Sudden unmotivated $F_0$ excursion $> +4.0\text{ semitones}$ relative to contour | Vocal cracking, unnatural pitch leaps, perceived anxiety or lack of vocal control. |
| `stumble_filler` | Articulation Disruption / Filler Stumble | Local spectral flux turbulence with micro-repeats or filler hesitations | Loss of polish, verbal disfluency, diminished authority. |

---

### 3. Contrastive Quality Spectrum (Levels L1 to L6)
The contrastive dataset models an intentional delivery gradient across 6 distinct tiers:

1. **Level 1 (`L1_egregious`)**: Catastrophic failure across multiple axes simultaneously.
   - 4-5 major flaws injected per minute.
   - Severe parameter excursions (e.g., $1.6\times$ rushing, complete $F_0$ flattening, multiple 2.5s silences).
   - Expected overall rubric score: **$15 - 35$**.
2. **Level 2 (`L2_heavy`)**: Consistently flawed delivery.
   - 3-4 distinct flaws across the speech.
   - Moderate-to-severe magnitudes (e.g., $1.4\times$ rushing, notable energy drops).
   - Expected overall rubric score: **$35 - 52$**.
3. **Level 3 (`L3_moderate`)**: Competent amateur with recurring delivery flaws.
   - 2-3 isolated flaw regions.
   - Distinct flaws such as unnatural clause pauses and flattened pitch in key passages.
   - Expected overall rubric score: **$53 - 70$**.
4. **Level 4 (`L4_minor`)**: Strong speaker with minor polish issues.
   - 1-2 subtle flaws (e.g., slight pace surge or single prolonged hesitation).
   - Expected overall rubric score: **$71 - 85$**.
5. **Level 5 (`L5_near_perfect`)**: Near-championship caliber.
   - Single isolated subtle flaw (e.g., slight pitch drift or brief pause anomaly).
   - Expected overall rubric score: **$86 - 94$**.
6. **Level 6 (`L6_baseline`)**: Clean master recording of world-class orator (Steve Jobs, MLK, JFK, Churchill).
   - Exact gold-standard acoustic footprint.
   - Expected overall rubric score: **$95 - 100$**.

---

### 4. Evaluative Rubric & Scoring Formulation
Scores are generated deterministically on a 0-100 scale using an empirical, explainable penalty model:

$$\text{Overall Score} = \sum_{k \in \mathcal{K}} w_k \cdot S_k$$

Where the rubric weights $w_k$ sum to $1.00$:

| Dimension ($k$) | Weight ($w_k$) | Evaluated Acoustic Metrics | Mathematical Basis |
| :--- | :--- | :--- | :--- |
| **Pacing** | `0.25` | Syllable rate stability, local tempo deviation, time-compression ratio | Divergence between local sliding speech rate and baseline optimal rate ($z_{\text{rate}}$). |
| **Pauses** | `0.20` | Syntactic pause placement, silence duration ratio, cadence rhythm | Ratio of missing structural pauses and penalty for dead air silences ($> 1.2\text{ s}$). |
| **Pitch Variation** | `0.20` | Dynamic semitone range, contour slope correlation, prosodic crests | Normalized semitone standard deviation $\sigma_{\text{st}}$ and Pearson correlation $r(F_{0,\text{base}}, F_{0,\text{test}})$. |
| **Energy** | `0.15` | RMS projection, dynamic range, ending phrase decrescendo | Per-recording $z$-score energy stability and absence of sudden unmotivated $> 8\text{ dB}$ drops. |
| **Clarity** | `0.20` | Harmonics-to-Noise Ratio (HNR), spectral flux consistency, MFCC stability | Articulation stability, absence of spectral clutter, vocal breathiness/jitter. |

**Penalty Computation**:
Each subscore starts at $100$ and decreases based on:
1. Grounded flaw penalties: $\sum_{i \in \text{flaws}} \gamma(k, \text{type}_i) \cdot \text{severity}_i \cdot \frac{\text{duration}_i}{T_{\text{total}}}$
2. Global feature divergence: $\alpha_k \cdot \text{KL-divergence or mean absolute deviation of feature } k$.

---

### 5. Speaker-Agnostic Acoustic Normalization
To prevent demographic bias (e.g., biological pitch differences between male/female/baritone/soprano voices), all acoustic features are normalized to relative speaker baselines:

1. **Semitone Log-$F_0$ Transformation**:
   $$F_{0,\text{semitones}}(t) = 12 \cdot \log_2 \left( \frac{F_0(t)}{F_{0,\text{median}}} \right)$$
   This centers every speaker's median fundamental frequency at $0\text{ st}$, making pitch contour deviations directly comparable regardless of vocal anatomy.
2. **Per-Recording Z-Score RMS Energy**:
   $$\text{RMS}_{\text{norm}}(t) = \frac{\text{RMS}_{\text{dB}}(t) - \mu_{\text{RMS}}}{\sigma_{\text{RMS}}}$$
   Normalizes for microphone gain, recording distance, and vocal power.
3. **Dynamic Time Warping (DTW)**:
   Non-linear temporal alignment aligns test frames to baseline frames using 13 MFCC feature vectors before computing point-by-point feature residuals.

---

### 6. Deterministic Guarantee
- Pseudo-random operations (synthetic jitter, noise injection, flaw placement seeds) are strictly initialized with `seed = 42`.
- No non-deterministic LLMs or stochastic neural sampling in the scoring or detection path.
- Identical audio input produces bit-identical scores, bounding intervals, and explanations across all runs.
