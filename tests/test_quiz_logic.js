"use strict";

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const Q = require("../assets/quiz-logic.js");

function test(name, fn) {
  try {
    fn();
    console.log("ok -", name);
  } catch (err) {
    console.error("FAIL -", name);
    throw err;
  }
}

test("toggleMark add/remove/replace", () => {
  let m = {};
  m = Q.toggleMark(m, 1, "star");
  assert.strictEqual(m["1"], "star");
  m = Q.toggleMark(m, 1, "flag");
  assert.strictEqual(m["1"], "flag");
  m = Q.toggleMark(m, 1, "flag");
  assert.strictEqual(m["1"], undefined);
});

test("gradeAnswer", () => {
  assert.deepStrictEqual(Q.gradeAnswer(2, 2), {
    ok: true,
    correctIndex: 2,
    selectedIndex: 2,
    deltaCorrect: 1,
    deltaWrong: 0,
  });
  assert.deepStrictEqual(Q.gradeAnswer(0, 2), {
    ok: false,
    correctIndex: 2,
    selectedIndex: 0,
    deltaCorrect: 0,
    deltaWrong: 1,
  });
});

test("buildMistakesQueue fixed ids", () => {
  const bank = {
    "10": { id: 10, question: "a" },
    "20": { id: 20, question: "b" },
  };
  const q = Q.buildMistakesQueue([20, 10], bank);
  assert.strictEqual(q.length, 2);
  assert.strictEqual(q[0].id, 20);
  assert.strictEqual(q[1].id, 10);
});

test("validatePoolShape against pools.json", () => {
  const pools = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "pools.json"), "utf8")
  );
  assert.strictEqual(pools.pools.length, 40);
  for (const pool of pools.pools) {
    const r = Q.validatePoolShape(pool, pools.bank);
    assert.ok(r.ok, `pool ${pool.id}: ${r.error}`);
  }
});

test("confidenceLabel", () => {
  assert.strictEqual(Q.confidenceLabel("high"), "висока");
  assert.strictEqual(Q.confidenceLabel("low"), "низька");
});

test("clearAllMarks and clearMarksOfType", () => {
  let m = { "1": "star", "2": "flag", "3": "star" };
  assert.strictEqual(Q.totalMarks(m), 3);
  m = Q.clearMarksOfType(m, "star");
  assert.deepStrictEqual(m, { "2": "flag" });
  m = Q.clearAllMarks();
  assert.deepStrictEqual(m, {});
  assert.strictEqual(Q.totalMarks(m), 0);
});

test("reviewStateFromSaved and sessionStatsFromSaved", () => {
  let answers = {};
  answers = Q.recordAnswer(answers, 10, 1, 1, 1);
  answers = Q.recordAnswer(answers, 11, 0, 2, 2);
  const review = Q.reviewStateFromSaved(Q.getSavedAnswer(answers, 10));
  assert.strictEqual(review.locked, true);
  assert.strictEqual(review.ok, true);
  assert.strictEqual(review.selectedIndex, 1);
  const queue = [{ id: 10 }, { id: 11 }, { id: 12 }];
  const stats = Q.sessionStatsFromSaved(queue, answers);
  assert.strictEqual(stats.correctCount, 1);
  assert.strictEqual(stats.wrongCount, 1);
  assert.deepStrictEqual(stats.wrongIds, [11]);
  assert.strictEqual(Q.reviewStateFromSaved(null), null);
});

test("recordAnswer and clearAllAnswers", () => {
  let a = {};
  a = Q.recordAnswer(a, 10, 1, 1, 1000);
  a = Q.recordAnswer(a, 11, 0, 2, 1001);
  assert.strictEqual(Q.countAnswers(a), 2);
  assert.strictEqual(Q.countCorrectAnswers(a), 1);
  assert.strictEqual(a["10"].ok, true);
  assert.strictEqual(a["11"].ok, false);
  const stats = Q.poolAnswerStats([10, 11, 12], a);
  assert.deepStrictEqual(stats, { answered: 2, correct: 1, total: 3 });
  a = Q.clearAllAnswers();
  assert.strictEqual(Q.countAnswers(a), 0);
});

async function runClearTests() {
  await testAsync("requestClearAllMarks confirms and clears", async () => {
    const marks = { "1": "star", "2": "flag" };
    let asked = "";
    const result = await Q.requestClearAllMarks(marks, (msg) => {
      asked = msg;
      return true;
    });
    assert.ok(asked.includes("ВСІ мітки"));
    assert.strictEqual(result.cleared, true);
    assert.deepStrictEqual(result.marks, {});
  });

  await testAsync("requestClearAllMarks cancel keeps data", async () => {
    const marks = { "1": "star" };
    const result = await Q.requestClearAllMarks(marks, () => false);
    assert.strictEqual(result.cleared, false);
    assert.strictEqual(result.reason, "cancelled");
    assert.deepStrictEqual(result.marks, marks);
  });

  await testAsync("requestClearAllMarks empty skips confirm", async () => {
    let called = false;
    const result = await Q.requestClearAllMarks({}, () => {
      called = true;
      return true;
    });
    assert.strictEqual(called, false);
    assert.strictEqual(result.reason, "empty");
    assert.strictEqual(result.cleared, false);
  });

  await testAsync("requestClearMarksOfType only clears one kind", async () => {
    const marks = { "1": "star", "2": "flag", "3": "star" };
    const result = await Q.requestClearMarksOfType(
      marks,
      "star",
      "Зірка",
      () => true
    );
    assert.strictEqual(result.cleared, true);
    assert.deepStrictEqual(result.marks, { "2": "flag" });
  });

  await testAsync("requestClearAllAnswers confirms and clears", async () => {
    let answers = Q.recordAnswer({}, 5, 0, 0, 1);
    answers = Q.recordAnswer(answers, 6, 1, 0, 2);
    const result = await Q.requestClearAllAnswers(answers, () => true);
    assert.strictEqual(result.cleared, true);
    assert.deepStrictEqual(result.answers, {});
  });

  await testAsync("requestClearAllAnswers cancel keeps data", async () => {
    const answers = Q.recordAnswer({}, 5, 0, 0, 1);
    const result = await Q.requestClearAllAnswers(answers, () => false);
    assert.strictEqual(result.cleared, false);
    assert.strictEqual(Q.countAnswers(result.answers), 1);
  });

  await testAsync("requestClearPoolAnswers only clears pool ids", async () => {
    let answers = Q.recordAnswer({}, 1, 0, 0, 1);
    answers = Q.recordAnswer(answers, 2, 0, 0, 2);
    answers = Q.recordAnswer(answers, 99, 1, 1, 3);
    const result = await Q.requestClearPoolAnswers(
      answers,
      [1, 2],
      "9",
      () => true
    );
    assert.strictEqual(result.cleared, true);
    assert.strictEqual(result.answers["99"].ok, true);
    assert.strictEqual(result.answers["1"], undefined);
    assert.strictEqual(result.answers["2"], undefined);
  });

  await testAsync("requestClearPoolMarks only clears pool ids", async () => {
    const marks = { "1": "star", "2": "flag", "99": "heart" };
    const result = await Q.requestClearPoolMarks(marks, [1, 2], "9", () => true);
    assert.strictEqual(result.cleared, true);
    assert.deepStrictEqual(result.marks, { "99": "heart" });
  });

  await testAsync("requestClearPoolAnswers empty skips confirm", async () => {
    let called = false;
    const result = await Q.requestClearPoolAnswers({}, [1, 2], "1", () => {
      called = true;
      return true;
    });
    assert.strictEqual(called, false);
    assert.strictEqual(result.reason, "empty");
  });
}

function testAsync(name, fn) {
  return fn()
    .then(() => console.log("ok -", name))
    .catch((err) => {
      console.error("FAIL -", name);
      throw err;
    });
}

runClearTests()
  .then(() => {
    console.log("All quiz-logic tests passed.");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
