/**
 * Pure quiz helpers — usable in browser and Node tests.
 * Browser: window.BrotherQuiz
 * Node: module.exports
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.BrotherQuiz = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MARKS = [
    { id: "star", label: "Зірка", icon: "★" },
    { id: "flag", label: "Прапор", icon: "⚑" },
    { id: "heart", label: "Серце", icon: "♥" },
    { id: "bang", label: "Оклик", icon: "❗" },
  ];

  const QUOTA = { ekpl: 20, anticor: 20, kku: 30, kpku: 30 };

  function toggleMark(marks, questionId, markId) {
    const next = { ...marks };
    const key = String(questionId);
    if (next[key] === markId) delete next[key];
    else next[key] = markId;
    return next;
  }

  function countMarks(marks, markId) {
    return Object.values(marks).filter((v) => v === markId).length;
  }

  function clearAllMarks() {
    return {};
  }

  function clearMarksOfType(marks, markId) {
    const next = { ...marks };
    for (const key of Object.keys(next)) {
      if (next[key] === markId) delete next[key];
    }
    return next;
  }

  function totalMarks(marks) {
    return Object.keys(marks).length;
  }

  function recordAnswer(answers, questionId, selectedIndex, correctIndex, ts) {
    const graded = gradeAnswer(selectedIndex, correctIndex);
    const next = { ...answers };
    next[String(questionId)] = {
      selected_index: selectedIndex,
      correct_index: correctIndex,
      ok: graded.ok,
      ts: ts || Date.now(),
    };
    return next;
  }

  function clearAllAnswers() {
    return {};
  }

  function countAnswers(answers) {
    return Object.keys(answers || {}).length;
  }

  function countCorrectAnswers(answers) {
    return Object.values(answers || {}).filter((a) => a && a.ok).length;
  }

  function poolAnswerStats(questionIds, answers) {
    let answered = 0;
    let correct = 0;
    for (const id of questionIds) {
      const a = answers[String(id)];
      if (!a) continue;
      answered += 1;
      if (a.ok) correct += 1;
    }
    return { answered, correct, total: questionIds.length };
  }

  /**
   * Clear helpers with injectable confirm (for UI + tests).
   * confirmFn(message) -> boolean | Promise<boolean>
   */
  function requestClearAllMarks(marks, confirmFn) {
    const n = totalMarks(marks);
    if (!n) return { cleared: false, reason: "empty", marks };
    const ok = confirmFn(
      `Скинути ВСІ мітки (${n})?\n\nЦю дію не можна скасувати.`
    );
    return Promise.resolve(ok).then((confirmed) => {
      if (!confirmed) return { cleared: false, reason: "cancelled", marks };
      return { cleared: true, reason: "ok", marks: clearAllMarks() };
    });
  }

  function requestClearMarksOfType(marks, markId, label, confirmFn) {
    const n = countMarks(marks, markId);
    if (!n) return { cleared: false, reason: "empty", marks };
    const ok = confirmFn(
      `Скинути всі мітки «${label}» (${n})?\n\nЦю дію не можна скасувати.`
    );
    return Promise.resolve(ok).then((confirmed) => {
      if (!confirmed) return { cleared: false, reason: "cancelled", marks };
      return {
        cleared: true,
        reason: "ok",
        marks: clearMarksOfType(marks, markId),
      };
    });
  }

  function requestClearAllAnswers(answers, confirmFn) {
    const n = countAnswers(answers);
    if (!n) return { cleared: false, reason: "empty", answers };
    const ok = confirmFn(
      `Скинути всі збережені відповіді (${n})?\n\nПрогрес на пулах обнулиться. Цю дію не можна скасувати.`
    );
    return Promise.resolve(ok).then((confirmed) => {
      if (!confirmed) return { cleared: false, reason: "cancelled", answers };
      return { cleared: true, reason: "ok", answers: clearAllAnswers() };
    });
  }

  function gradeAnswer(selectedIndex, correctIndex) {
    const ok = selectedIndex === correctIndex;
    return {
      ok,
      correctIndex,
      selectedIndex,
      deltaCorrect: ok ? 1 : 0,
      deltaWrong: ok ? 0 : 1,
    };
  }

  function buildMistakesQueue(wrongIds, bank) {
    return wrongIds.map((id) => {
      const q = bank[String(id)];
      if (!q) throw new Error("missing question " + id);
      return q;
    });
  }

  function validatePoolShape(pool, bank) {
    const ids = pool.question_ids;
    if (!Array.isArray(ids) || ids.length !== 100) {
      return { ok: false, error: "size" };
    }
    if (new Set(ids).size !== 100) {
      return { ok: false, error: "duplicates_in_pool" };
    }
    const counts = { ekpl: 0, anticor: 0, kku: 0, kpku: 0 };
    for (const id of ids) {
      const q = bank[String(id)];
      if (!q) return { ok: false, error: "missing_bank:" + id };
      if (typeof q.correct_index !== "number") {
        return { ok: false, error: "no_answer:" + id };
      }
      if (q.correct_index < 0 || q.correct_index >= q.options.length) {
        return { ok: false, error: "bad_index:" + id };
      }
      if (!q.confidence) return { ok: false, error: "no_confidence:" + id };
      counts[q.category] = (counts[q.category] || 0) + 1;
    }
    for (const [cat, n] of Object.entries(QUOTA)) {
      if (counts[cat] !== n) {
        return { ok: false, error: `quota_${cat}_${counts[cat]}` };
      }
    }
    return { ok: true, counts };
  }

  function confidenceLabel(level) {
    const map = {
      high: "висока",
      medium: "середня",
      low: "низька",
    };
    return map[level] || map.medium;
  }

  return {
    MARKS,
    QUOTA,
    toggleMark,
    countMarks,
    clearAllMarks,
    clearMarksOfType,
    totalMarks,
    recordAnswer,
    clearAllAnswers,
    countAnswers,
    countCorrectAnswers,
    poolAnswerStats,
    requestClearAllMarks,
    requestClearMarksOfType,
    requestClearAllAnswers,
    gradeAnswer,
    buildMistakesQueue,
    validatePoolShape,
    confidenceLabel,
  };
});
