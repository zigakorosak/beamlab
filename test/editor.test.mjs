import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem, BEAM_TYPES, LEVELS } from "../src/core/generator.js";
import { solve } from "../src/core/solver.js";
import { createDiagramEditor } from "../src/ui/diagramEditor.js";

test("automatic moment curve: right key points give the exact M at every segment's middle", () => {
  let seed = 41;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let curved = 0;
  for (const t of BEAM_TYPES)
    for (const lv of LEVELS)
      for (let i = 0; i < 30; i++) {
        const model = generateProblem(t.id, lv.id, rnd);
        const sol = solve(model);
        const ed = createDiagramEditor({ sol, model, kind: "M", momentSide: "up", autoMid: true });
        assert.ok(ed.dots.every((d) => d.side !== "mid"), "no middle dots to drag");
        for (const d of ed.dots) d.value = d.answer;
        assert.ok(ed.grade().ok);
        const pts = ed.curve();
        for (let k = 0; k < sol.xs.length - 1; k++) {
          const [a, b] = [sol.xs[k], sol.xs[k + 1]];
          const m = (a + b) / 2;
          const p = pts.find(([x]) => Math.abs(x - m) < 1e-9);
          if (!p) continue; // a straight piece: two points, no middle one
          curved++;
          assert.ok(Math.abs(p[1] - sol.M(m)) < 1e-6, `${t.id}/${lv.id}: M(${m}) = ${sol.M(m)}, curve ${p[1]}`);
          // Under a uniform load M is a parabola: the curve is exact everywhere.
          const uniform = model.loads.every((l) => l.type !== "dist" || l.q1 === l.q2);
          if (uniform) for (const [x, v] of pts.filter(([x]) => x > a + 1e-9 && x < b - 1e-9)) assert.ok(Math.abs(v - sol.M(x)) < 1e-6);
        }
      }
  assert.ok(curved > 100, `${curved} curved pieces`);
});

test("halfway dots when automatic is off: M gets its middle dots back", () => {
  const model = generateProblem("simple", "medium", () => 0.3);
  const sol = solve(model);
  const off = createDiagramEditor({ sol, model, kind: "M", momentSide: "up", autoMid: false });
  const on = createDiagramEditor({ sol, model, kind: "M", momentSide: "up", autoMid: true });
  assert.ok(off.dots.some((d) => d.side === "mid"));
  assert.ok(!on.dots.some((d) => d.side === "mid"));
  // V keeps its middle dots under a varying load either way (not affected).
});

test("wheel: every diagram dot can be scrolled to a right value, finer steps near it", () => {
  let seed = 77;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let worst = 0;
  for (const t of BEAM_TYPES)
    for (const lv of LEVELS)
      for (let i = 0; i < 15; i++) {
        const model = generateProblem(t.id, lv.id, rnd);
        const sol = solve(model);
        for (const kind of ["V", "M"]) {
          const ed = createDiagramEditor({ sol, model, kind, momentSide: "up", autoMid: false });
          ed.dots.forEach((d, i) => {
            ed.select(i);
            // Overshoot-free: scroll towards the answer until a notch would pass it.
            let n = 0;
            for (; n < 200; n++) {
              const dir = Math.sign(d.answer - d.value);
              const before = d.value;
              if (!dir) break;
              ed.nudge(dir);
              if (Math.sign(d.answer - d.value) !== dir) {
                // Passed it: take the closer of the two.
                if (Math.abs(before - d.answer) < Math.abs(d.value - d.answer)) d.value = before;
                break;
              }
            }
            worst = Math.max(worst, n);
          });
          assert.ok(ed.grade().ok, `${t.id}/${lv.id} ${kind}`);
        }
      }
  assert.ok(worst <= 40, `${worst} notches`);
});
