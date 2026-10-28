// Beam N-T-M exercise: the exam's worked beams, through the shared solver.
import { test } from "node:test";
import assert from "node:assert/strict";
import { beamNtm } from "../src/exercises/nosilec/beamNtm.js";

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const answer = (ex, key) => ex.answers.find((a) => a.key === key).value;
const model = (L, supports, loads) => ({
  beam: { x0: 0, length: L },
  supports: supports.map(([type, x], i) => ({ id: `s${i}`, type, x })),
  hinges: [],
  loads: loads.map((l, i) => ({ id: `l${i}`, ...l })),
});

test("overhang, q = 1.4 on 5 m, pin A, roller at 3 m (12.6.2006)", () => {
  const ex = beamNtm.build({ model: model(5, [["pin", 0], ["roller", 3]], [{ type: "dist", x1: 0, x2: 5, q1: 1.4, q2: 1.4 }]) });
  near(answer(ex, "By"), 5.833);
  near(answer(ex, "Ay"), 1.167);
  near(answer(ex, "Mext"), -2.8); // over the support, larger than the span's +0.486
  near(answer(ex, "xext"), 3);
});

test("two overhangs 2+3+2, q = 0.5 on both (9.9.2016): M = −1 between", () => {
  const ex = beamNtm.build({
    model: model(7, [["pin", 2], ["roller", 5]], [
      { type: "dist", x1: 0, x2: 2, q1: 0.5, q2: 0.5 },
      { type: "dist", x1: 5, x2: 7, q1: 0.5, q2: 0.5 },
    ]),
  });
  near(answer(ex, "Ay"), 1);
  near(answer(ex, "By"), 1);
  near(answer(ex, "Mext"), -1);
});

test("cantilever clamped at x = 0, P = 10 down at the end: M_A = +P·L (counterclockwise)", () => {
  const ex = beamNtm.build({ model: model(3, [["fixed", 0]], [{ type: "point", x: 3, value: 10, angle: 0 }]) });
  near(answer(ex, "Ay"), 10);
  near(answer(ex, "MA"), 30);
  near(answer(ex, "Mext"), -30);
  near(answer(ex, "xext"), 0);
});

test("solution text mentions every reaction equation", () => {
  const ex = beamNtm.build({ model: model(4, [["pin", 0], ["roller", 4]], [{ type: "point", x: 1, value: 8, angle: 0 }]) });
  assert.ok(ex.solution.some((l) => l.startsWith("ΣM_A = 0")) && ex.solution.some((l) => l.startsWith("ΣM_B = 0")));
  near(answer(ex, "Mext"), 6); // F·a·b/L = 8·1·3/4
});
