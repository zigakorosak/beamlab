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
  // "Nosilec … ima: nepomično členkasto podporo A …; pomično podporo B …" (accusative after "ima").
  assert.match(ex.text[0], /ima: nepomično členkasto podporo A na levem koncu; pomično podporo B na desnem koncu\./);
  near(answer(ex, "Mext"), 6); // F·a·b/L = 8·1·3/4
});

test("M_ekstr is unique: M constant between two points is flagged, random tasks never are", async () => {
  const { extremeMoment } = await import("../src/exercises/nosilec/beamNtm.js");
  const { solve } = await import("../src/core/solver.js");
  const { rng } = await import("../src/exercises/kit.js");
  // Overhang with a couple at 6 m: M = −15 on the whole of 5…6 m.
  const m = model(7.5, [["pin", 0], ["roller", 5]], [{ type: "moment", x: 6, value: -15 }]);
  assert.ok(extremeMoment(solve(m)).ambiguous);
  const r = rng(9);
  for (let i = 0; i < 300; i++) {
    const p = beamNtm.generate(r);
    assert.ok(!extremeMoment(solve(p.model)).ambiguous);
  }
});

test("a couple's jump in M is listed with both sides in the solution", () => {
  // Pin 0, roller 4, couple 8 kNm (ccw) at 1 m: A_y = 2, M(1−) = 2, M(1+) = 2 − 8 = −6.
  const ex = beamNtm.build({ model: model(4, [["pin", 0], ["roller", 4]], [{ type: "moment", x: 1, value: 8 }]) });
  near(answer(ex, "Ay"), 2);
  near(answer(ex, "Mext"), -6);
  assert.ok(ex.solution.includes("x = 1 m: T = 2 | 2 kN, M = 2 | −6 kNm"), ex.solution.join("\n"));
});

test("figure: a short load at the end of the beam keeps its label inside the picture", async () => {
  // Just enough of the DOM for draw.js (as in exercises.test.mjs).
  class El {
    constructor(tag) { this.tagName = tag; this.attrs = {}; this.children = []; this.text = ""; this.dataset = {}; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    append(...cs) { for (const c of cs) this.children.push(typeof c === "string" ? Object.assign(new El("#text"), { text: c }) : c); }
    set textContent(v) { this.children = []; this.text = String(v); }
    get textContent() { return this.text + this.children.map((c) => c.textContent).join(""); }
    *walk() { for (const c of this.children) { yield c; yield* c.walk(); } }
    querySelectorAll(sel) { const tags = sel.split(",").map((t) => t.trim()); return [...this.walk()].filter((e) => tags.includes(e.tagName)); }
  }
  const saved = globalThis.document;
  globalThis.document = { createElementNS: (ns, tag) => new El(tag) };
  try {
    const { figure } = await import("../src/exercises/draw.js");
    // Overhang 1,5 + 7 + 1,5 m with q = 11 kN/m on the last metre only.
    const ex = beamNtm.build({ model: model(10, [["pin", 1.5], ["roller", 8.5]], [{ type: "dist", x1: 9, x2: 10, q1: 11, q2: 11 }, { type: "point", x: 1, value: 6, angle: 0 }]) });
    for (const width of [326, 728]) {
      const f = figure();
      ex.figure(f);
      const svg = f.render(width, 300);
      const t = [...svg.walk()].find((e) => e.tagName === "text" && e.textContent.startsWith("q = 11"));
      const half = (t.textContent.length * 7) / 2; // 13 px semibold
      assert.ok(Number(t.attrs.x) + half <= width, `${width} px: label ends at ${Number(t.attrs.x) + half}`);
    }
  } finally {
    globalThis.document = saved;
  }
});
