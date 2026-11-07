One-time setup, from the `ai_service` folder:

    python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
    pip install -r requirements-eval.txt
    copy .env.example to .env and fill it in (same keys as production)

Every time:

    python -m evaluation.testset_generator --pages 30 --size 20   # makes data/testset.jsonl (rerun only when documents change)
    python -m evaluation.evaluate --limit 5                       # quick smoke test
    python -m evaluation.evaluate                                 # full run -> data/results/scores_*.csv

If the judge hits rate limits, use `--no-score` to save the answers first and score them later with
`--from-answers data/results/answers_XXXX.jsonl`.

The generator only applies Ragas' headline splitter to pages where headline extraction produced
the required `headlines` property. `raise_exceptions=False` skips failures during question generation;
it does not suppress preprocessing/transform errors.
