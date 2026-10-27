"""Tests for pool generation and answer-key coverage."""
from __future__ import annotations

import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SCRIPTS = ROOT / "scripts"
PY = sys.executable
QUOTA = {"ekpl": 20, "anticor": 20, "kku": 30, "kpku": 30}


@pytest.fixture(scope="module")
def pools():
    path = DATA / "pools.json"
    assert path.exists(), "pools.json missing — run scripts/generate_pools.py"
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def questions():
    return json.loads((DATA / "questions.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def answer_key():
    return json.loads((DATA / "answer_key.json").read_text(encoding="utf-8"))


def test_full_answer_coverage(questions, answer_key):
    assert len(questions) == 3972
    assert len(answer_key) == 3972
    missing = [q["id"] for q in questions if q.get("correct_index") is None]
    assert missing == []
    for q in questions:
        idx = q["correct_index"]
        assert 0 <= idx < len(q["options"])
        entry = answer_key[str(q["id"])]
        assert entry["correct_index"] == idx
        if "correct_text" in entry:
            assert entry["correct_text"] == q["options"][idx]


def test_pools_meta_strategy_b(pools):
    meta = pools["meta"]
    assert meta["strategy"] == "B"
    assert meta["n_pools"] == 40
    assert meta["quota"] == QUOTA
    assert meta["total_slots"] == 4000
    assert set(meta["extra_assignments_by_category"]) <= {"kku"}
    assert meta["extra_assignments_by_category"].get("kku", 0) == 293


def test_forty_pools_quota_and_unique(pools):
    assert len(pools["pools"]) == 40
    bank = pools["bank"]
    for pool in pools["pools"]:
        ids = pool["question_ids"]
        assert len(ids) == 100
        assert len(set(ids)) == 100
        cats = Counter(bank[str(i)]["category"] for i in ids)
        assert dict(cats) == QUOTA
        for qid in ids:
            q = bank[str(qid)]
            assert q["confidence"] in {"high", "medium", "low"}
            assert 0 <= q["correct_index"] < len(q["options"])


def test_kku_repeats_only_across_pools(pools):
    usage = Counter(qid for p in pools["pools"] for qid in p["question_ids"])
    bank = pools["bank"]
    multi = {qid: n for qid, n in usage.items() if n > 1}
    assert len(multi) == pools["meta"]["questions_used_more_than_once"]
    for qid in multi:
        assert bank[str(qid)]["category"] == "kku"
        assert multi[qid] == 2


def test_generate_pools_is_deterministic():
    out = DATA / "pools.json"
    before = out.read_bytes()
    proc = subprocess.run(
        [PY, str(SCRIPTS / "generate_pools.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    after = out.read_bytes()
    assert before == after


def test_ui_has_confirm_button():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert 'id="btn-confirm"' in html
    assert "Підтвердити" in html
    assert "quiz-logic.js" in html
    assert 'id="btn-prev"' in html
    assert 'id="btn-next"' in html
    assert 'id="btn-finish"' in html
    assert 'id="btn-unanswered"' in html
    assert "Назад" in html
    assert "Завершити" in html
    app = (ROOT / "assets" / "app.js").read_text(encoding="utf-8")
    assert "goPrev" in app
    assert "syncNavButtons" in app
    assert "startUnanswered" in app
    assert "finishSession" in app
    assert "applyHubStatsToSession" in app


def test_question_3286_repaired():
    """Source row was split: empty stem + 3 options; should be restored."""
    questions = json.loads((DATA / "questions.json").read_text(encoding="utf-8"))
    q = next(x for x in questions if x["id"] == 3286)
    assert (q["question"] or "").strip()
    assert len(q["options"]) == 4
    pools = json.loads((DATA / "pools.json").read_text(encoding="utf-8"))
    b = pools["bank"]["3286"]
    assert (b["question"] or "").strip()
    assert len(b["options"]) == 4


def test_version_files_aligned():
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    assert version == "1.0.6"
    ver_js = (ROOT / "assets" / "version.js").read_text(encoding="utf-8")
    assert f'APP_VERSION = "{version}"' in ver_js
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert f"assets/app.js?v={version}" in html
    assert 'id="app-version"' in html
    assert 'id="confirm-modal"' in html
    assert (ROOT / "CHANGELOG.md").exists()


def test_ui_uses_in_app_confirm_not_window_confirm():
    app = (ROOT / "assets" / "app.js").read_text(encoding="utf-8")
    assert "function askConfirm" in app
    assert "confirmModal" in app
    assert "requestClearAllMarks" in app
    assert "requestClearAllAnswers" in app
    assert "window.confirm(" not in app


def test_ui_has_clear_marks_controls():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert 'id="btn-clear-marks"' in html
    assert "Скинути всі мітки" in html
    assert 'id="btn-clear-answers"' in html
    assert "Скинути збережені відповіді" in html
    assert 'id="confirm-modal"' in html
    assert 'id="btn-clear-pool-answers"' in html
    assert 'id="btn-clear-pool-marks"' in html
    assert 'id="btn-clear-pool-answers-summary"' in html
    assert "Скинути відповіді пулу" in html
    assert "Скинути мітки пулу" in html
    assert 'id="pool-live-stats"' in html
    assert "<details" in html and "pool-reset" in html
    assert 'id="btn-prev"' in html
    assert 'id="nav-row"' in html
    logic = (ROOT / "assets" / "quiz-logic.js").read_text(encoding="utf-8")
    assert "formatPoolStatsHtml" in logic
    assert "canGoPrev" in logic
    assert "canGoNext" in logic
    logic = (ROOT / "assets" / "quiz-logic.js").read_text(encoding="utf-8")
    assert "clearAllMarks" in logic
    assert "clearMarksOfType" in logic
    assert "recordAnswer" in logic
    assert "clearAllAnswers" in logic
    assert "requestClearAllAnswers" in logic
    assert "requestClearPoolAnswers" in logic
    assert "requestClearPoolMarks" in logic
    app = (ROOT / "assets" / "app.js").read_text(encoding="utf-8")
    assert "brother_testing_answers_v1" in app
    assert "askConfirm" in app
    assert "clearAllSavedAnswers" in app
    assert "clearPoolAnswersById" in app
