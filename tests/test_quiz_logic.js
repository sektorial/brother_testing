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

console.log("All quiz-logic tests passed.");
