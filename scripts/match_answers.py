"""Match local questions to testderz answers; prefer option-consistent hits."""
from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data"

STOP = {
    "та",
    "і",
    "й",
    "або",
    "чи",
    "в",
    "у",
    "на",
    "з",
    "зі",
    "до",
    "для",
    "про",
    "при",
    "по",
    "за",
    "від",
    "що",
    "як",
    "який",
    "яка",
    "яке",
    "які",
    "це",
    "не",
    "згідно",
    "відповідно",
}


def norm(s: str) -> str:
    s = s.lower().replace("ё", "е")
    s = unicodedata.normalize("NFKC", s)
    for a, b in (
        ("«", '"'),
        ("»", '"'),
        ("“", '"'),
        ("”", '"'),
        ("’", "'"),
        ("`", "'"),
        ("–", "-"),
        ("—", "-"),
    ):
        s = s.replace(a, b)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[^\w\s\"'%№\-/().,;:?!]", "", s, flags=re.UNICODE)
    return re.sub(r"\s+", " ", s).strip()


def norm_loose(s: str) -> str:
    s = norm(s)
    s = re.sub(r"[\"'.,;:!?()%/\-№]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def tokens(s: str) -> set[str]:
    return {t for t in norm_loose(s).split() if len(t) > 2 and t not in STOP}


def ratio(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def option_score(options: list[str], answer: str) -> tuple[int | None, float]:
    na, nla = norm(answer), norm_loose(answer)
    scored: list[tuple[float, int]] = []
    for i, o in enumerate(options):
        no, nlo = norm(o), norm_loose(o)
        if no == na or nlo == nla:
            return i, 1.0
        r = max(ratio(no, na), ratio(nlo, nla))
        if nla and nlo and (nla in nlo or nlo in nla):
            r = max(r, 0.93)
        ta, to = set(nla.split()), set(nlo.split())
        if ta and to:
            j = len(ta & to) / len(ta | to)
            r = max(r, j)
        scored.append((r, i))
    scored.sort(reverse=True)
    best_r, best_i = scored[0]
    if len(scored) > 1 and scored[1][0] >= best_r - 0.02 and scored[1][0] >= 0.8:
        return None, best_r  # ambiguous
    return best_i, best_r


def q_score(local_nl: str, local_tok: set[str], meta: dict) -> float:
    r = ratio(local_nl, meta["nl"])
    if local_tok and meta["tok"]:
        j = len(local_tok & meta["tok"]) / len(local_tok | meta["tok"])
        r = max(r, j)
    return r


def main() -> None:
    local = json.loads((ROOT / "questions_raw.json").read_text(encoding="utf-8"))
    remote = json.loads((ROOT / "testderz_answers.json").read_text(encoding="utf-8"))

    inv: dict[str, set[int]] = defaultdict(set)
    remote_meta = []
    for i, p in enumerate(remote):
        nl = norm_loose(p["question"])
        tok = tokens(p["question"])
        remote_meta.append({"nl": nl, "tok": tok, "p": p})
        for t in tok:
            inv[t].add(i)

    results = []
    stats: Counter[str] = Counter()

    for q in local:
        qnl = norm_loose(q["question"])
        qtok = tokens(q["question"])
        cand_scores: Counter[int] = Counter()
        for t in qtok:
            for rid in inv.get(t, ()):
                cand_scores[rid] += 1
        candidates = [rid for rid, _ in cand_scores.most_common(50)]
        if len(candidates) < 10:
            for rid, meta in enumerate(remote_meta):
                if meta["p"]["category"] in {q["category"], "ekpl", "ekzpl"} or True:
                    # broaden: keep top by token already; add same rough size cap
                    pass
            # add high token-overlap from same first token if needed
            if qtok:
                extra = []
                for rid, meta in enumerate(remote_meta):
                    if not meta["tok"]:
                        continue
                    ov = len(qtok & meta["tok"])
                    if ov >= max(3, len(qtok) // 4):
                        extra.append((ov, rid))
                extra.sort(reverse=True)
                for _, rid in extra[:30]:
                    candidates.append(rid)
            candidates = list(dict.fromkeys(candidates))

        # rank candidates by question similarity first
        ranked = []
        for rid in candidates:
            qs = q_score(qnl, qtok, remote_meta[rid])
            if qs >= 0.62:
                ranked.append((qs, rid))
        ranked.sort(reverse=True)
        ranked = ranked[:25]

        best = None  # combined, qs, os, idx, rid
        for qs, rid in ranked:
            hit = remote_meta[rid]["p"]
            idx, os_ = option_score(q["options"], hit["answer"])
            if idx is None:
                continue
            if os_ < 0.78:
                continue
            # require reasonably similar question OR near-exact option
            if qs < 0.78 and os_ < 0.92:
                continue
            if qs < 0.70:
                continue
            combined = qs * 0.45 + os_ * 0.55
            if best is None or combined > best[0]:
                best = (combined, qs, os_, idx, rid)

        if best is None:
            stats["unmatched"] += 1
            top_qs = round(ranked[0][0], 3) if ranked else None
            results.append(
                {
                    "id": q["id"],
                    "status": "unmatched",
                    "category": q["category"],
                    "best_q_score": top_qs,
                }
            )
            continue

        combined, qs, os_, idx, rid = best
        hit = remote_meta[rid]["p"]
        stats["matched"] += 1
        results.append(
            {
                "id": q["id"],
                "status": "matched",
                "category": q["category"],
                "correct_index": idx,
                "correct_text": q["options"][idx],
                "answer_source": hit["answer"],
                "q_score": round(qs, 3),
                "opt_score": round(os_, 3),
                "combined": round(combined, 3),
                "remote_cat": hit["category"],
                "remote_q": hit["question"],
            }
        )

    print("STATS", dict(stats))
    for cat in ["ekpl", "anticor", "kku", "kpku"]:
        m = sum(1 for r in results if r["category"] == cat and r["status"] == "matched")
        u = sum(1 for r in results if r["category"] == cat and r["status"] != "matched")
        print(f"  {cat}: matched {m}, other {u}")

    (ROOT / "answer_key_match_report.json").write_text(
        json.dumps({"stats": dict(stats), "results": results}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    key = {
        str(r["id"]): {
            "correct_index": r["correct_index"],
            "correct_text": r["correct_text"],
            "q_score": r["q_score"],
            "opt_score": r["opt_score"],
        }
        for r in results
        if r["status"] == "matched"
    }
    (ROOT / "answer_key.json").write_text(
        json.dumps(key, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("key size", len(key), "/", len(local))
    print("Q1:", next(r for r in results if r["id"] == 1))
    print("Q2:", next(r for r in results if r["id"] == 2))
    # confidence bands
    bands = Counter()
    for r in results:
        if r["status"] != "matched":
            continue
        c = r["combined"]
        if c >= 0.95:
            bands["high>=0.95"] += 1
        elif c >= 0.88:
            bands["mid>=0.88"] += 1
        else:
            bands["low<0.88"] += 1
    print("confidence", dict(bands))


if __name__ == "__main__":
    main()
