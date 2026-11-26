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
  const o = { target: 63.3, fine: 1, coarse: 20 };
  for (const start of [0, 20, 40, 55, 60, 62, 63, 64, 66, 70, 100, -20, 240]) {
    assert.equal(ladderStep(ladderStep(start, 1, o), -1, o), start, `from ${start}`);
    assert.equal(ladderStep(ladderStep(start, -1, o), 1, o), start, `from ${start}`);
  }
  // Far off: coarse steps. Near the target: fine ones.
  assert.equal(ladderStep(0, 1, o), 20);
  assert.equal(ladderStep(-40, -1, o), -60);
  assert.equal(ladderStep(62, 1, o), 63);
  assert.equal(ladderStep(63, 1, o), 64);
  assert.equal(ladderStep(62.5, 1, o), 63);
  assert.equal(ladderStep(200, -1, o), 180);
});

test("ladder: steps shrink only near the target", () => {
  const o = { target: 63.3, fine: 1, coarse: 20 };
  const visited = [0];
  while (visited.at(-1) < 200) visited.push(ladderStep(visited.at(-1), 1, o));
  const gaps = visited.slice(1).map((v, i) => v - visited[i]);
  // Coarse at the start, finest right at 63, coarse again after.
  assert.equal(gaps[0], 20);
  assert.ok(gaps.includes(1));
  assert.equal(gaps.at(-1), 20);
  const at = visited.indexOf(63);
  assert.ok(at > 0 && visited[at + 1] === 64 && visited[at - 1] === 62, visited.join(" "));
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
          const n = notchesTo(r.answer, (v) => closeEnough(v, r.answer, scale), reactionLadder(r.answer, scale));
          assert.ok(n >= 0, JSON.stringify({ r, scale }));
          worst = Math.max(worst, n);
        }
      }
  assert.ok(worst <= 30, `${worst} notches`);
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
