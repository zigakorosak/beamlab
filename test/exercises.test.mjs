// Exam exercises: each build() checked against a worked exam solution
// (numbers from the photographed exams), and every generator run many
// times for finite, sensible answers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EXERCISES } from "../src/exercises/registry.js";
import { rng, num } from "../src/exercises/kit.js";
import { sileF4, sileVozlisce } from "../src/exercises/statika/concurrent.js";

const near = (a, b, tol = 0.002) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const answer = (ex, key) => ex.answers.find((a) => a.key === key).value;

test("num(): decimal comma, four significant digits", () => {
  assert.equal(num(6.97412), "6,974");
  assert.equal(num(43393.2), "43393");
  assert.equal(num(0.058812), "0,05881");
  assert.equal(num(-2.5), "−2,5");
  assert.equal(num(1e-12), "0");
});

test("F4 for equilibrium (24.8.2016): 11.206 kN", () => {
  // Axes along F1 and F2 as in the solution; F3 at 30° from F2 → 120°.
  const ex = sileF4.build({ forces: [{ F: 8, a: 0 }, { F: 6, a: 90 }, { F: 4, a: 120 }] });
  near(answer(ex, "F4"), 11.206);
  near(answer(ex, "phi"), 180 + 57.626); // F4 points down-left
});

test("knot on two ropes: symmetric 45° gives G/√2 each", () => {
  const ex = sileVozlisce.build({ a1: 135, a2: 45, G: 10 });
  near(answer(ex, "S1"), 10 / Math.SQRT2);
  near(answer(ex, "S2"), 10 / Math.SQRT2);
});

test("every generator: 300 random tasks with finite answers and text", () => {
  for (const ex of EXERCISES) {
    const r = rng(12345);
    for (let i = 0; i < 300; i++) {
      const task = ex.build(ex.generate(r));
      assert.ok(task.text.length > 0 && task.solution.length > 0, ex.id);
      for (const a of task.answers) assert.ok(Number.isFinite(a.value), `${ex.id}: ${a.key} = ${a.value}`);
    }
  }
});
