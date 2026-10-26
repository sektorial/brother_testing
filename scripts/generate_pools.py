"""Generate 40 fixed pools (strategy B): 20/20/30/30 per pool, cross-pool repeats OK."""
from __future__ import annotations

import json
import random
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
N_POOLS = 40
QUOTA = {"ekpl": 20, "anticor": 20, "kku": 30, "kpku": 30}
SEED = 20261027


def slim(q: dict) -> dict:
    conf = q.get("confidence")
    if conf is None and q.get("answer_source") == "testderz":
        conf = "high"
    if conf is None:
        conf = "medium"
    return {
        "id": q["id"],
        "category": q["category"],
        "question": q["question"],
        "options": q["options"],
        "correct_index": q["correct_index"],
        "confidence": conf,
        "answer_source": q.get("answer_source"),
    }


def assign_category(items: list[dict], n_pools: int, per_pool: int, rng: random.Random) -> list[list[dict]]:
    """Balance usage; no duplicates inside a pool; repeats across pools as needed."""
    use = Counter()
    pools: list[list[dict]] = [[] for _ in range(n_pools)]
    by_id = {q["id"]: q for q in items}

    for p in range(n_pools):
        # Prefer least-used; break ties randomly
        ranked = sorted(items, key=lambda q: (use[q["id"]], rng.random()))
        chosen_ids: list[int] = []
        for q in ranked:
            if len(chosen_ids) >= per_pool:
                break
            chosen_ids.append(q["id"])
            use[q["id"]] += 1
        if len(chosen_ids) < per_pool:
            raise RuntimeError(f"not enough questions for pool {p}")
        rng.shuffle(chosen_ids)
        pools[p] = [by_id[i] for i in chosen_ids]
    return pools


def main() -> None:
    questions = json.loads((DATA / "questions.json").read_text(encoding="utf-8"))
    by_cat: dict[str, list[dict]] = defaultdict(list)
    for q in questions:
        if q.get("correct_index") is None:
            raise SystemExit(f"missing answer for id {q['id']}")
        by_cat[q["category"]].append(slim(q))

    rng = random.Random(SEED)
    cat_pools = {
        cat: assign_category(by_cat[cat], N_POOLS, quota, rng) for cat, quota in QUOTA.items()
    }

    pools_out = []
    for i in range(N_POOLS):
        combined = []
        for cat in ("ekpl", "anticor", "kku", "kpku"):
            combined.extend(cat_pools[cat][i])
        rng.shuffle(combined)
        ids = [q["id"] for q in combined]
        if len(ids) != 100 or len(set(ids)) != 100:
            raise SystemExit(f"pool {i} invalid size/unique")
        pools_out.append(
            {
                "id": i + 1,
                "size": 100,
                "counts": {cat: QUOTA[cat] for cat in QUOTA},
                "question_ids": ids,
            }
        )

    # Compact bank: only questions used in any pool (all should be)
    used_ids = {qid for p in pools_out for qid in p["question_ids"]}
    bank = {str(q["id"]): slim(q) for q in questions if q["id"] in used_ids}

    usage = Counter(qid for p in pools_out for qid in p["question_ids"])
    by_cat_usage = Counter()
    id_to_cat = {q["id"]: q["category"] for q in questions}
    repeats = sum(1 for qid, c in usage.items() if c > 1)
    for qid, c in usage.items():
        if c > 1:
            by_cat_usage[id_to_cat[qid]] += c - 1

    out = {
        "meta": {
            "strategy": "B",
            "seed": SEED,
            "n_pools": N_POOLS,
            "quota": QUOTA,
            "unique_questions_in_bank": len(bank),
            "total_slots": N_POOLS * 100,
            "questions_used_more_than_once": repeats,
            "extra_assignments_by_category": dict(by_cat_usage),
            "max_uses": max(usage.values()),
            "min_uses": min(usage.values()),
        },
        "pools": pools_out,
        "bank": bank,
    }
    path = DATA / "pools.json"
    path.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(
        f"wrote {path} pools={N_POOLS} bank={len(bank)} "
        f"repeats={repeats} extra_by_cat={dict(by_cat_usage)} "
        f"uses=[{min(usage.values())}..{max(usage.values())}]"
    )


if __name__ == "__main__":
    main()
