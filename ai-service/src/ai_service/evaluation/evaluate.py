"""evaluation/evaluate.py: runs every test question through the real RAG chain and scores it with Ragas.

Run from the ai_service folder:
    python -m evaluation.evaluate                 # all questions
    python -m evaluation.evaluate --limit 5       # quick smoke test
    python -m evaluation.evaluate --no-score      # only collect answers (no judge calls); score later:
    python -m evaluation.evaluate --from-answers evaluation/data/results/answers_XXXX.jsonl

It calls studyhub_rag.chain.answer(), the same retrieve -> rerank -> generate code the website uses.

Metrics (0 to 1, higher is better):
    faithfulness                          is the answer supported by the retrieved context?
    answer_relevancy                      does the answer address the question?
    llm_context_precision_with_reference  are the useful chunks ranked near the top?
    context_recall                        did retrieval find what the reference answer needs?
"""
import argparse
import json
import time
from datetime import datetime
from pathlib import Path

from evaluation.common import DEFAULT_TESTSET, RESULTS_DIR, ragas_models, run_config
from studyhub_rag import chain

KEEP = ("user_input", "retrieved_contexts", "response", "reference", "reference_contexts")


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def collect_answers(rows: list[dict], pause: float) -> list[dict]:
    """Ask the real chain every question. A failed question is recorded and skipped, not fatal."""
    out = []
    for i, row in enumerate(rows, 1):
        question = row["user_input"]
        try:
            result = chain.answer(question)
            out.append({
                "user_input": question,
                "retrieved_contexts": [d.page_content for d in result["docs"]],
                "response": result["answer"],
                "reference": row.get("reference") or "",
                "reference_contexts": row.get("reference_contexts") or [],
            })
            print(f"[{i}/{len(rows)}] ok   {question[:70]}")
        except Exception as exc:
            print(f"[{i}/{len(rows)}] FAIL {question[:70]}  ({exc})")
        time.sleep(pause)  # free-tier rate limits
    return out


def score(records: list[dict]):
    from ragas import EvaluationDataset, evaluate
    from ragas.metrics import (
        Faithfulness,
        LLMContextPrecisionWithReference,
        LLMContextRecall,
        ResponseRelevancy,
    )

    llm, embeddings = ragas_models()
    dataset = EvaluationDataset.from_list([{k: r[k] for k in KEEP if k in r} for r in records])
    return evaluate(
        dataset,
        metrics=[Faithfulness(), ResponseRelevancy(), LLMContextPrecisionWithReference(), LLMContextRecall()],
        llm=llm,
        embeddings=embeddings,
        run_config=run_config(),
        raise_exceptions=False,
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--testset", type=Path, default=DEFAULT_TESTSET)
    ap.add_argument("--limit", type=int, help="only the first N questions")
    ap.add_argument("--pause", type=float, default=2.0, help="seconds between questions")
    ap.add_argument("--no-score", action="store_true", help="collect answers only")
    ap.add_argument("--from-answers", type=Path, help="skip answering; score a saved answers file")
    args = ap.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if args.from_answers:
        records = read_jsonl(args.from_answers)
    else:
        rows = read_jsonl(args.testset)[: args.limit]
        records = collect_answers(rows, args.pause)
        answers_path = RESULTS_DIR / f"answers_{stamp}.jsonl"
        with answers_path.open("w", encoding="utf-8") as f:
            for r in records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"saved {len(records)} answers to {answers_path}")

    if args.no_score or not records:
        return

    print("scoring with Ragas (the judge model makes many calls; this is slow on free tiers)...")
    result = score(records)
    df = result.to_pandas()
    scores_path = RESULTS_DIR / f"scores_{stamp}.csv"
    df.to_csv(scores_path, index=False)

    print("\nAVERAGES (goal: 0.95+ on each)")
    for name, value in df.select_dtypes("number").mean().items():
        print(f"  {name:40s} {value:.3f}")
    print(f"\nper-question scores: {scores_path}")
    print("Sort that CSV by the lowest score first: those rows show exactly what to fix.")


if __name__ == "__main__":
    main()
