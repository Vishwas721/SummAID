"""
SummAID Accuracy Evaluation Script
Automatically calculates ROUGE, semantic similarity, hallucination risk, and overall accuracy.

Usage:
    python backend/evaluate_accuracy.py --summary-id 44 --clinical-review False
    
    Or import as module:
    from evaluate_accuracy import evaluate_summary
    results = evaluate_summary(source_text, generated_summary)
    print(f"Accuracy: {results['accuracy_percentage']}%")
"""

import sys
import json
from typing import Dict, Tuple, List
import numpy as np
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

def calculate_rouge(reference: str, summary: str) -> Dict[str, float]:
    """
    Calculate ROUGE-1, ROUGE-2, ROUGE-L scores.
    
    ROUGE measures n-gram overlap with reference text.
    Higher = better coverage of source content.
    
    Returns:
        {
            'rouge_1': float (0-1),
            'rouge_2': float (0-1),
            'rouge_l': float (0-1)
        }
    """
    try:
        from rouge_score import rouge_scorer
    except ImportError:
        print("⚠️  Install rouge-score: pip install rouge-score")
        return {'rouge_1': 0.0, 'rouge_2': 0.0, 'rouge_l': 0.0}
    
    scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'])
    scores = scorer.score(reference, summary)
    
    return {
        'rouge_1': round(scores['rouge1'].fmeasure, 3),
        'rouge_2': round(scores['rouge2'].fmeasure, 3),
        'rouge_l': round(scores['rougeL'].fmeasure, 3)
    }


def calculate_semantic_similarity(source: str, summary: str) -> float:
    """
    Calculate semantic similarity using transformer embeddings.
    
    This measures if the summary captures the *meaning* of the source,
    even if wording differs.
    
    Returns:
        float: Cosine similarity (0-1)
        >0.70 = good; <0.60 = risk of hallucination
    """
    try:
        from sentence_transformers import SentenceTransformer
        import torch
        
        # Use BioBERT for medical text (more accurate than general BERT)
        try:
            model = SentenceTransformer('allenai/specter')  # Academic/medical text
        except:
            model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        
        # Encode with pooling
        source_emb = model.encode(source, convert_to_tensor=False)
        summary_emb = model.encode(summary, convert_to_tensor=False)
        
        # Cosine similarity
        from sklearn.metrics.pairwise import cosine_similarity
        similarity = cosine_similarity([source_emb], [summary_emb])[0][0]
        
        return round(float(similarity), 3)
    
    except ImportError:
        print("⚠️  Install dependencies: pip install sentence-transformers scikit-learn torch")
        return 0.0


def detect_hallucination_risk(reference: str, summary: str, rouge_1: float, semantic_sim: float) -> Tuple[bool, str]:
    """
    Detect if summary contains hallucinated (AI-generated) facts.
    
    Heuristics:
    1. Low semantic similarity (<0.65) → likely hallucination
    2. Low ROUGE-1 (<0.40) → poor overlap with source
    3. Summary much longer than reference → more room for hallucinations
    
    Returns:
        (bool: hallucination_risk, str: reason)
    """
    reasons = []
    
    if semantic_sim < 0.65:
        reasons.append(f"Low semantic similarity ({semantic_sim})")
    
    if rouge_1 < 0.40:
        reasons.append(f"Low ROUGE-1 overlap ({rouge_1})")
    
    summary_len = len(summary.split())
    reference_len = len(reference.split())
    if summary_len > reference_len * 1.5:
        reasons.append(f"Summary much longer than reference ({summary_len} vs {reference_len} words)")
    
    has_hallucination_risk = len(reasons) > 0
    reason_text = " + ".join(reasons) if reasons else "None detected"
    
    return has_hallucination_risk, reason_text


def extract_entities(text: str) -> Dict[str, List[str]]:
    """
    Extract medical entities from text using spaCy + medical NER.
    
    Returns:
        {
            'diagnoses': [...],
            'medications': [...],
            'lab_values': [...],
            'procedures': [...],
            'allergies': [...]
        }
    """
    try:
        import spacy
        try:
            nlp = spacy.load("en_core_sci_sm")  # Medical NER model
        except:
            print("⚠️  Install medical NER: python -m spacy download en_core_sci_sm")
            return {}
        
        doc = nlp(text)
        entities = {
            'diagnoses': [],
            'medications': [],
            'procedures': [],
            'lab_values': [],
            'allergies': []
        }
        
        for ent in doc.ents:
            if ent.label_ in ['DISEASE', 'CONDITION']:
                entities['diagnoses'].append(ent.text)
            elif ent.label_ in ['MEDICATION', 'DRUG']:
                entities['medications'].append(ent.text)
            elif ent.label_ in ['PROCEDURE', 'TEST']:
                entities['procedures'].append(ent.text)
            elif ent.label_ in ['LAB_VALUE']:
                entities['lab_values'].append(ent.text)
        
        # Keyword-based allergy detection (as fallback)
        if 'allerg' in text.lower():
            for sent in doc.sents:
                if 'allerg' in sent.text.lower():
                    entities['allergies'].append(sent.text.strip())
        
        return entities
    
    except ImportError:
        print("⚠️  Install spaCy: pip install spacy")
        return {}


def calculate_entity_f1(source_entities: Dict, summary_entities: Dict) -> Dict[str, float]:
    """
    Calculate F1-score for each entity type.
    
    F1 = 2 * (Precision * Recall) / (Precision + Recall)
    
    Higher F1 = summary correctly captures medical entities from source.
    """
    f1_scores = {}
    
    for entity_type in source_entities:
        source_set = set(source_entities.get(entity_type, []))
        summary_set = set(summary_entities.get(entity_type, []))
        
        if len(source_set) == 0:
            f1_scores[entity_type] = 1.0  # No entities to capture
            continue
        
        # Exact match
        tp = len(source_set & summary_set)
        fp = len(summary_set - source_set)
        fn = len(source_set - summary_set)
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        f1_scores[entity_type] = round(f1, 3)
    
    # Average F1 across all entity types
    avg_f1 = round(np.mean(list(f1_scores.values())), 3) if f1_scores else 0.0
    f1_scores['average'] = avg_f1
    
    return f1_scores


def evaluate_summary(
    source_text: str,
    summary_text: str,
    reference_summary: str = None,
    verbose: bool = True
) -> Dict:
    """
    Comprehensive accuracy evaluation for a generated summary.
    
    Args:
        source_text: Original medical reports/text
        summary_text: AI-generated summary
        reference_summary: (Optional) Human-written reference for comparison
        verbose: Print detailed results
    
    Returns:
        {
            'rouge_1': float,
            'rouge_2': float,
            'rouge_l': float,
            'semantic_similarity': float,
            'hallucination_risk': bool,
            'hallucination_reason': str,
            'entity_f1': {
                'diagnoses': float,
                'medications': float,
                'procedures': float,
                'lab_values': float,
                'allergies': float,
                'average': float
            },
            'overall_accuracy': float (0-1),
            'accuracy_percentage': float (0-100),
            'quality_rating': str ('EXCELLENT', 'GOOD', 'FAIR', 'POOR')
        }
    """
    if not reference_summary:
        reference_summary = source_text
    
    # Calculate ROUGE
    rouge = calculate_rouge(reference_summary, summary_text)
    
    # Calculate semantic similarity
    semantic_sim = calculate_semantic_similarity(source_text, summary_text)
    
    # Detect hallucination risk
    hallucination_risk, hallucination_reason = detect_hallucination_risk(
        source_text, summary_text, rouge['rouge_1'], semantic_sim
    )
    
    # Extract and compare entities
    source_entities = extract_entities(source_text)
    summary_entities = extract_entities(summary_text)
    entity_f1 = calculate_entity_f1(source_entities, summary_entities)
    
    # Overall accuracy score (weighted)
    # ROUGE-1 (25%): Coverage of unigrams
    # ROUGE-L (25%): Coverage of longest sequences
    # Semantic similarity (30%): Meaning preservation
    # No hallucination (20%): Factual correctness
    
    hallucination_penalty = 0.15 if hallucination_risk else 0.0
    
    overall_accuracy = (
        rouge['rouge_1'] * 0.25 +
        rouge['rouge_l'] * 0.25 +
        semantic_sim * 0.30 +
        entity_f1['average'] * 0.20 -
        hallucination_penalty
    )
    overall_accuracy = max(0, min(1, overall_accuracy))  # Clamp to 0-1
    accuracy_percentage = round(overall_accuracy * 100, 1)
    
    # Quality rating
    if accuracy_percentage >= 90:
        quality = "EXCELLENT"
    elif accuracy_percentage >= 80:
        quality = "GOOD"
    elif accuracy_percentage >= 70:
        quality = "FAIR"
    else:
        quality = "POOR"
    
    result = {
        'rouge_1': rouge['rouge_1'],
        'rouge_2': rouge['rouge_2'],
        'rouge_l': rouge['rouge_l'],
        'semantic_similarity': semantic_sim,
        'hallucination_risk': hallucination_risk,
        'hallucination_reason': hallucination_reason,
        'entity_f1': entity_f1,
        'overall_accuracy': round(overall_accuracy, 3),
        'accuracy_percentage': accuracy_percentage,
        'quality_rating': quality
    }
    
    if verbose:
        print_results(result)
    
    return result


def print_results(results: Dict) -> None:
    """Pretty-print evaluation results."""
    print("\n" + "="*60)
    print("SUMMAID ACCURACY EVALUATION REPORT")
    print("="*60)
    
    print(f"\n📊 LINGUISTIC METRICS:")
    print(f"   ROUGE-1 (unigram recall): {results['rouge_1']:.1%}")
    print(f"   ROUGE-2 (bigram recall):  {results['rouge_2']:.1%}")
    print(f"   ROUGE-L (longest seq):    {results['rouge_l']:.1%}")
    
    print(f"\n🧠 SEMANTIC UNDERSTANDING:")
    print(f"   Semantic Similarity: {results['semantic_similarity']:.1%}")
    
    print(f"\n🚨 HALLUCINATION DETECTION:")
    risk_status = "⚠️  RISK DETECTED" if results['hallucination_risk'] else "✅ LOW RISK"
    print(f"   Status: {risk_status}")
    if results['hallucination_reason']:
        print(f"   Reason: {results['hallucination_reason']}")
    
    print(f"\n🏥 MEDICAL ENTITY EXTRACTION (F1-Score):")
    for entity_type, f1 in results['entity_f1'].items():
        if entity_type != 'average':
            print(f"   {entity_type.title()}: {f1:.1%}")
    print(f"   Average: {results['entity_f1']['average']:.1%}")
    
    print(f"\n🎯 OVERALL ACCURACY:")
    print(f"   Score: {results['overall_accuracy']:.1%}")
    print(f"   Percentage: {results['accuracy_percentage']}%")
    print(f"   Quality: {results['quality_rating']}")
    
    print("\n" + "="*60)


if __name__ == "__main__":
    # Example usage
    sample_source = """
    Patient: Jane Doe, 62-year-old female
    
    Chief Complaint: Follow-up for adenocarcinoma
    
    Vital Signs: BP 140/90, HR 92, RR 18, Temp 98.6F
    
    Diagnosis: Stage T2N0M0 adenocarcinoma of left breast
    
    Labs: WBC 7.2K, Hemoglobin 12.1 g/dL, Platelets 245K
    
    Biomarkers: ER positive, PR positive, HER2 negative
    
    Current Medications: Tamoxifen 20mg daily, Metformin 500mg BID
    
    Procedures: CT chest performed 12/15/2025, no evidence of metastasis
    
    Allergies: Penicillin (anaphylaxis)
    
    Plan: Continue Tamoxifen, recheck labs in 6 weeks
    """
    
    sample_summary = """
    Patient: Jane Doe, 62F
    
    Primary Diagnosis: Stage T2N0M0 adenocarcinoma (breast, left)
    - ER+, PR+, HER2-
    
    Vital Signs: BP 140/90, HR 92
    
    Labs: WBC 7.2K, Hemoglobin 12.1 g/dL
    
    Current Treatment: Tamoxifen 20mg daily
    
    Recent Imaging: CT chest (12/15/2025) - no metastasis
    
    Allergy: Penicillin
    
    Plan: Continue current therapy; labs in 6 weeks
    """
    
    # Run evaluation
    results = evaluate_summary(sample_source, sample_summary)
    
    # Export as JSON
    with open('evaluation_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    print("\n✅ Results saved to evaluation_results.json")
