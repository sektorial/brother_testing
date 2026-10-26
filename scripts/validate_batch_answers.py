"""Validate batch_*_answers.json against batch_*.json; report missing/mismatches."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BATCH = Path(__file__).resolve().parents[1] / "data" / "answer_batches"


def main() -> int:
    needed = [f"{i:03d}" for i in range(20)]
    # last batch has 98 questions
    ok_all = True
    ready = []
    missing = []
    for n in needed:
        qpath = BATCH / f"batch_{n}.json"
        apath = BATCH / f"batch_{n}_answers.json"
        if not qpath.exists():
            print(f"batch_{n}: INPUT MISSING")
            ok_all = False
            continue
        qs = json.loads(qpath.read_text(encoding="utf-8"))
        if not apath.exists():
            print(f"batch_{n}: ANSWERS MISSING (need {len(qs)})")
            missing.append(n)
            ok_all = False
            continue
        ans = json.loads(apath.read_text(encoding="utf-8"))
        errors = []
        low = 0
        for q in qs:
            kid = str(q["id"])
            if kid not in ans:
                errors.append(f"missing id {kid}")
                continue
            a = ans[kid]
            idx = a.get("correct_index")
            text = a.get("correct_text")
            conf = a.get("confidence")
            if conf == "low":
                low += 1
            if not isinstance(idx, int) or idx < 0 or idx >= len(q["options"]):
                errors.append(f"id {kid}: bad index {idx}")
                continue
            if text != q["options"][idx]:
                errors.append(f"id {kid}: text mismatch")
        extra = set(ans) - {str(q["id"]) for q in qs}
        if extra:
            errors.append(f"extra ids: {sorted(extra)[:5]}...")
        status = "OK" if not errors else "FAIL"
        print(
            f"batch_{n}: {status} answered={len(ans)}/{len(qs)} low={low} "
            f"errors={len(errors)}"
        )
        for e in errors[:5]:
            print(f"  - {e}")
        if errors:
            ok_all = False
        else:
            ready.append(n)
    print(f"ready={len(ready)} missing_files={missing} ok_all={ok_all}")
    return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main())
