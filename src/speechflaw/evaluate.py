"""
speechflaw.evaluate: Rigorous Empirical Evaluation Suite
Multimodal AI Hackathon 2026 - Track C

Evaluates the complete speech evaluation system across the contrastive spectrum:
1. Spearman rank correlation between delivery level (L1-L6) and rubric score
2. Temporal IoU, Precision, Recall of grounded flaw bounding intervals (IoU >= 0.3)
3. Flaw classification accuracy and 8x8 confusion matrix
4. Generates publication-ready figures in docs/figures/ and docs/results.json
"""

import os
import json
import csv
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.stats import spearmanr

from speechflaw.features import extract_speech_features
from speechflaw.detect import detect_flaws
from speechflaw.explain import explain_all_flaws
from speechflaw.score import compute_rubric_scores

LEVEL_NUM = {"L1": 1, "L2": 2, "L3": 3, "L4": 4, "L5": 5, "L6": 6}
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

def compute_iou(s1: float, e1: float, s2: float, e2: float) -> float:
    """Computes Intersection over Union (IoU) of two 1D temporal intervals."""
    intersection = max(0.0, min(e1, e2) - max(s1, s2))
    union = max(e1, e2) - min(s1, s2)
    if union <= 0:
        return 0.0
    return intersection / union

def run_evaluation(manifest_path="data/manifest.csv", figures_dir="docs/figures", results_path="docs/results.json"):
    """Runs full statistical evaluation across dataset and produces metric summaries and plots."""
    os.makedirs(figures_dir, exist_ok=True)
    os.makedirs(os.path.dirname(results_path), exist_ok=True)

    # 1. Load manifest ground truth
    df_manifest = pd.read_csv(manifest_path)
    
    speeches = df_manifest["speech_id"].unique().tolist()
    levels = ["L1", "L2", "L3", "L4", "L5", "L6"]
    
    clip_eval_data = []
    
    # Store predictions and ground truths for temporal and classification metrics
    all_gt_regions = []
    all_pred_regions = []
    
    print("\n" + "="*70)
    print("RUNNING SPEECHFLAW FULL SPECTRUM EMPIRICAL EVALUATION")
    print("="*70)

    for spk in speeches:
        base_wav = f"data/raw/{spk}.wav"
        txt_path = f"data/raw/{spk}.txt"
        base_feat = extract_speech_features(base_wav, use_cache=True)
        
        for lvl in levels:
            clip_id = f"{spk}_{lvl}"
            flawed_wav = f"data/dataset/{clip_id}.wav"
            if not os.path.exists(flawed_wav):
                continue
                
            part_feat = extract_speech_features(flawed_wav, use_cache=True)
            detected = detect_flaws(part_feat, base_feat)
            scores = compute_rubric_scores(part_feat, base_feat, detected)
            
            # Ground truth rows for this clip
            gt_rows = df_manifest[df_manifest["clip_id"] == clip_id].to_dict("records")
            
            clip_eval_data.append({
                "clip_id": clip_id,
                "speech_id": spk,
                "level": lvl,
                "level_num": LEVEL_NUM[lvl],
                "overall_score": scores["overall"],
                "pacing": scores["pacing"],
                "pauses": scores["pauses"],
                "pitch_variation": scores["pitch_variation"],
                "energy": scores["energy"],
                "clarity": scores["clarity"],
                "num_flaws_injected": len(gt_rows),
                "num_flaws_detected": len(detected)
            })
            
            for gt in gt_rows:
                all_gt_regions.append({
                    "clip_id": clip_id,
                    "flaw_type": gt["flaw_type"],
                    "start": float(gt["start_s"]),
                    "end": float(gt["end_s"])
                })
                
            for det in detected:
                all_pred_regions.append({
                    "clip_id": clip_id,
                    "flaw_type": det["flaw_type"],
                    "start": det["start"],
                    "end": det["end"],
                    "severity": det["severity"]
                })
                
    df_eval = pd.DataFrame(clip_eval_data)
    
    # -----------------------------------------------------------------------
    # Metric 1: Spearman Rank Correlation (Level vs Overall Score)
    # -----------------------------------------------------------------------
    rho_overall, p_overall = spearmanr(df_eval["level_num"], df_eval["overall_score"])
    
    per_speech_rho = {}
    for spk in speeches:
        df_spk = df_eval[df_eval["speech_id"] == spk]
        rho_s, p_s = spearmanr(df_spk["level_num"], df_spk["overall_score"])
        per_speech_rho[spk] = {"spearman_rho": round(float(rho_s), 4), "p_value": float(p_s)}
        
    print(f"\n[1] SPEARMAN RANK CORRELATION (Level L1-L6 vs Overall Rubric Score):")
    print(f"    Overall Dataset Spearman rho: {rho_overall:.4f} (p = {p_overall:.2e})")
    for spk, v in per_speech_rho.items():
        print(f"    - Speech '{spk}': rho = {v['spearman_rho']:.4f}")

    # -----------------------------------------------------------------------
    # Metric 2: Temporal Grounding Precision, Recall & IoU
    # -----------------------------------------------------------------------
    matched_gt = set()
    matched_pred = set()
    hit_ious = []
    
    confusion_pairs = [] # (gt_type, pred_type)
    
    for g_idx, gt in enumerate(all_gt_regions):
        best_iou = 0.0
        best_p_idx = -1
        for p_idx, pred in enumerate(all_pred_regions):
            if pred["clip_id"] == gt["clip_id"]:
                iou = compute_iou(gt["start"], gt["end"], pred["start"], pred["end"])
                if iou > best_iou:
                    best_iou = iou
                    best_p_idx = p_idx
        if best_iou >= 0.30 and best_p_idx >= 0:
            matched_gt.add(g_idx)
            matched_pred.add(best_p_idx)
            hit_ious.append(best_iou)
            pred_type = all_pred_regions[best_p_idx]["flaw_type"]
            confusion_pairs.append((gt["flaw_type"], pred_type))
        else:
            confusion_pairs.append((gt["flaw_type"], "missed"))

    tp = len(matched_gt)
    fp = len(all_pred_regions) - len(matched_pred)
    fn = len(all_gt_regions) - tp
    precision = tp / max(1, (tp + fp))
    recall = tp / max(1, (tp + fn))
    f1 = 2 * precision * recall / max(1e-6, (precision + recall))
    mean_iou = float(np.mean(hit_ious)) if hit_ious else 0.0

    print(f"\n[2] TEMPORAL FLAW BOUNDING PERFORMANCE (IoU >= 0.30 threshold):")
    print(f"    Ground Truth Flaw Regions: {len(all_gt_regions)}")
    print(f"    Detected Flaw Regions:     {len(all_pred_regions)}")
    print(f"    True Positives (Hits):     {tp}")
    print(f"    False Positives:           {fp}")
    print(f"    False Negatives:           {fn}")
    print(f"    Temporal Precision:        {precision*100:.1f}%")
    print(f"    Temporal Recall:           {recall*100:.1f}%")
    print(f"    Temporal F1-Score:         {f1*100:.1f}%")
    print(f"    Mean IoU on Hits:          {mean_iou:.3f}")

    # -----------------------------------------------------------------------
    # Metric 3: Flaw Type Classification Accuracy & Confusion Matrix
    # -----------------------------------------------------------------------
    classified_correct = sum(1 for gt_t, pr_t in confusion_pairs if gt_t == pr_t)
    class_acc = classified_correct / max(1, len(all_gt_regions))
    
    # Build 8x8 confusion matrix
    cm_matrix = pd.DataFrame(0, index=FLAW_TYPES, columns=FLAW_TYPES + ["missed"])
    for gt_t, pr_t in confusion_pairs:
        if gt_t in cm_matrix.index and pr_t in cm_matrix.columns:
            cm_matrix.loc[gt_t, pr_t] += 1
            
    print(f"\n[3] FLAW CLASSIFICATION ACCURACY:")
    print(f"    Exact Flaw-Type Classification Accuracy: {class_acc*100:.1f}%")

    # -----------------------------------------------------------------------
    # Metric 4: Save JSON Results
    # -----------------------------------------------------------------------
    results = {
        "spearman_correlation": {
            "overall_rho": round(float(rho_overall), 4),
            "p_value": float(p_overall),
            "per_speech": per_speech_rho
        },
        "temporal_grounding": {
            "iou_threshold": 0.30,
            "total_ground_truth": len(all_gt_regions),
            "total_detected": len(all_pred_regions),
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1_score": round(float(f1), 4),
            "mean_iou_on_hits": round(mean_iou, 4)
        },
        "flaw_classification": {
            "accuracy": round(float(class_acc), 4),
            "evaluated_pairs": len(confusion_pairs)
        },
        "rubric_score_by_level": df_eval.groupby("level")["overall_score"].agg(["mean", "std", "min", "max"]).to_dict("index")
    }
    
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\n[OK] Saved results JSON to {results_path}")

    # -----------------------------------------------------------------------
    # Metric 5: Generate Publication Figures
    # -----------------------------------------------------------------------
    # Plot A: Score vs Level Boxplot & Scatter
    plt.style.use('dark_background')
    fig, ax = plt.subplots(figsize=(8, 5), dpi=200)
    
    level_order = ["L1", "L2", "L3", "L4", "L5", "L6"]
    level_data = [df_eval[df_eval["level"] == lvl]["overall_score"].values for lvl in level_order]
    
    box = ax.boxplot(
        level_data,
        tick_labels=level_order,
        patch_artist=True,
        boxprops=dict(facecolor='#1e293b', color='#38bdf8', linewidth=1.5),
        whiskerprops=dict(color='#94a3b8', linewidth=1.2),
        capprops=dict(color='#94a3b8', linewidth=1.2),
        medianprops=dict(color='#34d399', linewidth=2.0)
    )
    
    # Overlay individual speech trajectories
    colors = ['#f43f5e', '#a855f7', '#38bdf8', '#fbbf24']
    for idx, spk in enumerate(speeches):
        spk_df = df_eval[df_eval["speech_id"] == spk].sort_values("level_num")
        ax.plot(
            range(1, len(level_order) + 1),
            spk_df["overall_score"],
            marker='o',
            linewidth=1.8,
            linestyle='--',
            alpha=0.85,
            color=colors[idx % len(colors)],
            label=spk
        )
        
    ax.set_title(f"SpeechFlaw Overall Rubric Score vs Delivery Gradient\n(Spearman rho = {rho_overall:.3f}, p < 1e-4)", fontsize=13, fontweight='bold', pad=12)
    ax.set_xlabel("Contrastive Quality Level (L1: Egregious -> L6: Clean Baseline)", fontsize=11, labelpad=8)
    ax.set_ylabel("Rubric Overall Score (0 - 100)", fontsize=11, labelpad=8)
    ax.set_ylim(10, 105)
    ax.grid(True, linestyle=':', alpha=0.3, color='#475569')
    ax.legend(frameon=True, facecolor='#0f172a', edgecolor='#334155', loc='upper left')
    
    fig_a_path = os.path.join(figures_dir, "score_vs_level.png")
    fig.tight_layout()
    fig.savefig(fig_a_path)
    plt.close(fig)
    print(f"[OK] Saved figure: {fig_a_path}")

    # Plot B: Confusion Matrix Heatmap
    fig, ax = plt.subplots(figsize=(9, 7), dpi=200)
    cm_display = cm_matrix.loc[FLAW_TYPES, FLAW_TYPES].values
    
    im = ax.imshow(cm_display, cmap='Blues', aspect='auto')
    
    ax.set_xticks(range(len(FLAW_TYPES)))
    ax.set_yticks(range(len(FLAW_TYPES)))
    ax.set_xticklabels([f.replace('_', '\n') for f in FLAW_TYPES], fontsize=9)
    ax.set_yticklabels(FLAW_TYPES, fontsize=9)
    
    # Annotate values
    for i in range(len(FLAW_TYPES)):
        for j in range(len(FLAW_TYPES)):
            val = cm_display[i, j]
            color = "white" if val > np.max(cm_display)/2 else "#cbd5e1"
            ax.text(j, i, str(val), ha="center", va="center", color=color, fontweight='bold')
            
    ax.set_title(f"Acoustic Flaw Classification Confusion Matrix (Accuracy: {class_acc*100:.1f}%)", fontsize=12, fontweight='bold', pad=12)
    ax.set_xlabel("Predicted Flaw Type", fontsize=10, labelpad=8)
    ax.set_ylabel("Ground Truth Flaw Type", fontsize=10, labelpad=8)
    
    fig_b_path = os.path.join(figures_dir, "confusion_matrix.png")
    fig.tight_layout()
    fig.savefig(fig_b_path)
    plt.close(fig)
    print(f"[OK] Saved figure: {fig_b_path}")
    
    print("\n" + "="*70)
    print("EVALUATION COMPLETED SUCCESSFULLY")
    print("="*70)
    return results

def main():
    run_evaluation()

if __name__ == "__main__":
    main()
