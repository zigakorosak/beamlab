import test from "node:test";
import assert from "node:assert/strict";
import { ladderStep, answerLadder, reactionLadder } from "../src/core/ladder.js";
import { answerOk, closeEnough, reactionScale } from "../src/core/grading.js";
import { generateProblem, BEAM_TYPES, LEVELS } from "../src/core/generator.js";
import { solve } from "../src/core/solver.js";
import { EXERCISES } from "../src/exercises/registry.js";
import { rng } from "../src/exercises/kit.js";

// Scroll from 0 towards `answer` (or the other way for angles, modulo
// 360°): the notches until a value passes, or −1.
function notchesTo(answer, ok, ladder, dir = answer >= 0 ? 1 : -1) {
  let v = 0;
  for (let n = 0; n < 1000; n++) {
    if (ok(v)) return n;
    v = ladderStep(v, dir, ladder);
  }
  return -1;
}

test("ladder: up then down comes back, and a typed value steps to its neighbours", () => {
  const o = { min: 0.1 };
  for (const start of [0, 0.3, 1.9, 2, 4.8, 9.5, 65, -17, 240]) {
    assert.equal(ladderStep(ladderStep(start, 1, o), -1, o), start, `from ${start}`);
    assert.equal(ladderStep(ladderStep(start, -1, o), 1, o), start, `from ${start}`);
  }
  assert.equal(ladderStep(63, 1, o), 65);
  assert.equal(ladderStep(63, -1, o), 60);
  assert.equal(ladderStep(3.33, 1, o), 3.4);
  assert.equal(ladderStep(3.33, -1, o), 3.2);
  assert.equal(ladderStep(0.1, -1, o), 0);
  assert.equal(ladderStep(0, -1, o), -0.1);
  assert.equal(ladderStep(10, 1, o), 11);
  assert.equal(ladderStep(10, -1, o), 9.5);
});

test("ladder: every Practice reaction can be scrolled to, no typing", () => {
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let worst = 0;
  for (const t of BEAM_TYPES)
    for (const lv of LEVELS)
      for (let i = 0; i < 40; i++) {
        const sol = solve(generateProblem(t.id, lv.id, rnd));
        const rs = sol.reactions.flatMap((q) =>
          [{ answer: q.Rx, unit: "kN" }, { answer: q.Ry, unit: "kN" }, ...(q.type === "fixed" ? [{ answer: q.M, unit: "kNm" }] : [])],
        );
        for (const r of rs) {
          const scale = reactionScale(rs, r.unit);
          const n = notchesTo(r.answer, (v) => closeEnough(v, r.answer, scale), reactionLadder(scale));
          assert.ok(n >= 0, JSON.stringify({ r, scale }));
          worst = Math.max(worst, n);
        }
      }
  assert.ok(worst <= 60, `${worst} notches`);
});

test("ladder: every exam answer can be scrolled to, no typing", () => {
  for (const e of EXERCISES)
    for (let i = 0; i < 25; i++) {
      const ex = e.build(e.generate(rng(500 + i)));
      for (const a of ex.answers) {
        const ok = (v) => answerOk(v, a);
        const ladder = answerLadder(a);
        const up = notchesTo(a.value, ok, ladder);
        // Angles are graded modulo the period: scrolling the other way counts.
        const n = a.unit === "°" ? Math.max(up, notchesTo(a.value, ok, ladder, -Math.sign(a.value || 1))) : up;
        assert.ok(n >= 0, `${e.id} ${a.key} = ${a.value} ${a.unit}`);
      }
    }
});
