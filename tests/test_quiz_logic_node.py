"""Run Node unit tests for assets/quiz-logic.js."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_quiz_logic_js():
    proc = subprocess.run(
        ["node", str(ROOT / "tests" / "test_quiz_logic.js")],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + "\n" + proc.stderr
    assert "All quiz-logic tests passed" in proc.stdout


def test_app_js_uses_confirm_not_double_tap():
    app = (ROOT / "assets" / "app.js").read_text(encoding="utf-8")
    assert "confirmAnswer" in app
    assert "btn-confirm" in app or "el.confirm" in app
    # double-tap path removed
    assert "if (session.selected === idx)" not in app
