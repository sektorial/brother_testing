"""Merge batch_*_answers.json into data/answer_key.json and refresh questions.json."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data"
BATCH = ROOT / "answer_batches"


def main() -> None:
    key = json.loads((ROOT / "answer_key.json").read_text(encoding="utf-8"))
    before = len(key)
    added = 0
    low = 0
    for path in sorted(BATCH.glob("batch_*_answers.json")):
        part = json.loads(path.read_text(encoding="utf-8"))
        for qid, val in part.items():
            if str(qid) in key and key[str(qid)].get("source") != "llm_batch":
                # keep scraped matches unless overwritten intentionally
                continue
            if str(qid) not in key:
                added += 1
            entry = {
                "correct_index": val["correct_index"],
                "correct_text": val["correct_text"],
                "source": "llm_batch",
                "confidence": val.get("confidence", "medium"),
            }
            key[str(qid)] = entry
            if entry["confidence"] == "low":
                low += 1

    (ROOT / "answer_key.json").write_text(
        json.dumps(key, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    questions = json.loads((ROOT / "questions_raw.json").read_text(encoding="utf-8"))
    out = []
    for q in questions:
        kid = str(q["id"])
        item = dict(q)
        if kid in key:
            item["correct_index"] = key[kid]["correct_index"]
            item["answer_status"] = "matched"
            item["answer_source"] = key[kid].get("source", "testderz")
            item["confidence"] = key[kid].get("confidence")
        else:
            item["correct_index"] = None
            item["answer_status"] = "missing"
        out.append(item)
    (ROOT / "questions.json").write_text(
        json.dumps(out, ensure_ascii=False), encoding="utf-8"
    )
    matched = sum(1 for q in out if q["correct_index"] is not None)
    print(
        f"key {before} -> {len(key)} (+{added} new); "
        f"questions matched {matched}/{len(out)}; low_conf tracked {low}"
    )


if __name__ == "__main__":
    main()
