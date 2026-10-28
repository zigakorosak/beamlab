import { test } from "node:test";
import assert from "node:assert/strict";
import { answerOk, closeEnough, isExact } from "../src/core/grading.js";

test("approximate answers count: within 5 % of the value", () => {
  assert.ok(closeEnough(15.6, 15.625, 20));
  assert.ok(closeEnough(16, 15.625, 15.625));
  assert.ok(closeEnough(-14.9, -15.625, 15.625));
  assert.ok(!closeEnough(17, 15.625, 15.625));
  assert.ok(!closeEnough(15.6, -15.625, 15.625), "the sign must be right");
});

test("small values are judged against the problem's scale", () => {
  assert.ok(closeEnough(0, 1, 40)); // 3 % of 40 = 1.2
  assert.ok(!closeEnough(0, 2, 40));
  assert.ok(closeEnough(0.04, 0, 0)); // absolute floor
});

test("a minimum tolerance (one snap step) is honoured", () => {
  assert.ok(closeEnough(10, 12, 12, 2.5));
});

test("exact means right to the printed two decimals", () => {
  assert.ok(isExact(15.63, 15.625));
  assert.ok(!isExact(15.6, 15.625));
});

test("a tiny floor makes small answers count to 5 % too", () => {
  assert.ok(closeEnough(0.06, 0.0588, 0.1607, 0, 1e-6));
  assert.ok(!closeEnough(0.1, 0.0588, 0.0588, 0, 1e-6));
  assert.ok(!closeEnough(0.3, 0.25, 0.25, 0, 1e-6)); // f = 0.25: 0.3 is 20 % off
});

test("exam answers: angles to ±1°, 360° apart is the same angle", () => {
  const phi = { value: 359.6, unit: "°", tol: 1 };
  assert.ok(answerOk(0, phi));
  assert.ok(answerOk(-0.2, phi));
  assert.ok(answerOk(359, phi));
  assert.ok(!answerOk(357, phi));
  assert.ok(!answerOk(179.6, phi));
  // A line's direction: α and α ± 180° are the same answer.
  const alpha = { value: 89.7, unit: "°", tol: 1, period: 180 };
  assert.ok(answerOk(-90, alpha));
  assert.ok(!answerOk(0, alpha));
});

test("exam answers: 5 % of the own value, unless the module gives a scale", () => {
  assert.ok(answerOk(0.0588, { value: 0.0588, unit: "kN/cm²" }));
  assert.ok(!answerOk(0.07, { value: 0.0588, unit: "kN/cm²" }));
  // A_x = 0,1·B: 15 % off no longer passes on the strength of B.
  assert.ok(!answerOk(11.5, { value: 10, unit: "N" }));
  assert.ok(answerOk(10.4, { value: 10, unit: "N" }));
  // Exactly 0 without a scale: 0 is right.
  assert.ok(answerOk(0, { value: 1e-12, unit: "kN" }));
  // With a scale (nearZero): 3 % of it.
  assert.ok(answerOk(0.5, { value: 0, unit: "kN", scale: 20 }));
  assert.ok(!answerOk(0.7, { value: 0, unit: "kN", scale: 20 }));
});

test("parseNumber: decimal comma, real minus, spaces as a thousands separator", async () => {
  const { parseNumber } = await import("../src/core/format.js");
  assert.equal(parseNumber("12 500"), 12500);
  assert.equal(parseNumber("1 234,5"), 1234.5);
  assert.equal(parseNumber("−3,25"), -3.25);
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("12 kN"), null);
});

test("Practice reactions: a small force is judged against the largest force, not a fixed end's moment", async () => {
  const { reactionsOk } = await import("../src/core/grading.js");
  // Gerber beam: Ax = 0, Ay = 98 kN, MA = 388,5 kNm, By = 6 kN.
  const r = [{ answer: 0, unit: "kN" }, { answer: 98, unit: "kN" }, { answer: 388.5, unit: "kNm" }, { answer: 6, unit: "kN" }];
  assert.deepEqual(reactionsOk([0, 98, 388.5, 6], r), [true, true, true, true]);
  assert.deepEqual(reactionsOk([0.9, 96, 380, -5], r), [true, true, true, false]); // −5 for 6 kN: wrong (it passed 3 % of 388,5)
  assert.deepEqual(reactionsOk([1.1, 98, 388.5, 0], r), [false, true, true, false]); // 1 % of 98 for Ax = 0
  assert.deepEqual(reactionsOk([0, 98, 400, 6], r), [true, true, true, true]); // 5 % of 388,5 kNm
  // A small force of the same unit: the wrong sign never passes.
  const s = [{ answer: 98, unit: "kN" }, { answer: 2, unit: "kN" }];
  assert.deepEqual(reactionsOk([98, -0.9], s), [true, false]);
  assert.deepEqual(reactionsOk([98, 1.5], s), [true, true]);
});
