// Frames (okvirji): the solver against worked exam solutions and textbook
// cases, its sign convention (dM/ds = T, dT/ds = −q), node equilibrium,
// and every generator over many random draws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rng } from "../src/exercises/kit.js";
import { solveFrame, keyValues } from "../src/exercises/okvir/frame.js";
import { okvirL, lFrameModel } from "../src/exercises/okvir/okvirL.js";
import { okvirKonzola, konzolaModel } from "../src/exercises/okvir/okvirKonzola.js";
import { okvirPosevni, vejaModel, strehaModel } from "../src/exercises/okvir/okvirPosevni.js";

const near = (a, b, tol = 0.002) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const answer = (ex, key) => {
  const a = ex.answers.find((x) => x.key === key);
  assert.ok(a, `no answer ${key}`);
  return a.value;
};

test("30.1.2012: clamped column with a beam at B — A_x = 13, A_y = 6, M_A = −35, node check 26 − 9 − 22 + 5 = 0", () => {
  const p = { mirror: false, H: 3, hb: 1, b: 3, q: 2, Fh: 13, FhDir: -1, M0: 5 };
  const ex = okvirKonzola.build(p);
  near(answer(ex, "A_x"), 13);
  near(answer(ex, "A_y"), 6);
  near(answer(ex, "M_A"), -35);
  near(answer(ex, "MAB"), 22);
  near(answer(ex, "Mbeam"), -9);
  const sol = solveFrame(konzolaModel(p));
  // Exam fields: column top M = 13·s (26 at B), bottom M = 35 − 13 s, N = −6, beam M = −s²
  near(sol.members.BC.start.M, 26);
  near(sol.members.AB.start.M, 35);
  near(sol.members.AB.start.N, -6);
  near(sol.members.AB.start.T, -13);
  near(sol.members.BD.at(1).M, -4);
  const chk = sol.nodeCheck("B");
  near(chk.M, 0);
  const moments = chk.parts.map((x) => Math.round(x.M * 1000) / 1000).sort((a, b) => a - b);
  assert.deepEqual(moments, [-22, -9, 5, 26]);
});

test("22.5.2013: L-frame, q = 5 on the column — A_x = 15, A_y = −3,75, B = 3,75, M corner −22,5", () => {
  const ex = okvirL.build({ layout: "top", mirror: true, a: 6, h: 3, sup: "pinEnd", qc: 5, qcDir: -1 });
  near(answer(ex, "A_x"), 15);
  near(answer(ex, "A_y"), -3.75);
  near(answer(ex, "B"), 3.75);
  near(answer(ex, "Mc"), -22.5);
  near(answer(ex, "Nb"), -15);
  near(answer(ex, "Nc"), -3.75);
});

test("6.7.2016: column on a beam — B_x = −4 (4 kN left), A = 1, B_y = 5, M corner 6, M_max 6,25", () => {
  const ex = okvirL.build({ layout: "bottom", mirror: false, a: 3, h: 1.5, sup: "rollerCorner", qb: 2, Fh: 4, FhDir: 1 });
  near(answer(ex, "B_x"), -4);
  near(answer(ex, "A"), 1);
  near(answer(ex, "B_y"), 5);
  near(answer(ex, "Mc"), 6);
  near(answer(ex, "Mext"), 6.25);
});

test("7.3.2013: L-frame with a 45° bar — S = 4,773, B_x = 3,375, B_y = 5,625 (the solution's numbers are consistent)", () => {
  const ex = okvirL.build({ layout: "top", mirror: false, a: 3, h: 4, sup: "strut", beta: 45, ls: 1, qb: 3 });
  near(answer(ex, "S"), 4.773);
  near(answer(ex, "B_x"), 3.375);
  near(answer(ex, "B_y"), 5.625);
  near(answer(ex, "Mc"), -13.5);
});

test("28.6.2006: branch 30° above horizontal, G = 800 N at 1,2 m — N = −400, T = 692,8, M = −960", () => {
  const ex = okvirPosevni.build({ kind: "veja", mirror: false, alpha: 30, p: 1.2, tip: 1.8, G: 800 });
  near(answer(ex, "N"), -400);
  near(answer(ex, "T"), 692.82);
  near(answer(ex, "M"), -960);
  const mirrored = okvirPosevni.build({ kind: "veja", mirror: true, alpha: 30, p: 1.2, tip: 1.2, G: 800 });
  near(answer(mirrored, "N"), -400);
  near(answer(mirrored, "T"), 692.82);
  near(answer(mirrored, "M"), -960);
});

test("inclined beam, q per horizontal projection: like a simple beam of span a", () => {
  const a = 4, h = 3, qv = 2;
  const ex = okvirPosevni.build({ kind: "streha", mirror: false, a, h, q: qv, sup: "rollerV" });
  near(answer(ex, "A_x"), 0);
  near(answer(ex, "A_y"), (qv * a) / 2);
  near(answer(ex, "B"), (qv * a) / 2);
  near(answer(ex, "Mmax"), (qv * a * a) / 8);
  near(answer(ex, "x"), a / 2);
  near(answer(ex, "NA"), -((qv * a) / 2) * (h / 5));
});

test("three-hinged portal: H = qL²/(8h)", () => {
  const L = 6, h = 3, qv = 2;
  const sol = solveFrame({
    nodes: { A: [0, 0], C: [0, h], G: [L / 2, h], D: [L, h], B: [L, 0] },
    members: [
      { id: "AC", a: "A", b: "C", dashed: "right" },
      { id: "CG", a: "C", b: "G", dashed: "right" },
      { id: "GD", a: "G", b: "D", dashed: "right" },
      { id: "BD", a: "B", b: "D", dashed: "left" },
    ],
    supports: [{ node: "A", type: "pin" }, { node: "B", type: "pin" }],
    hinges: [{ node: "G", member: "CG" }],
    loads: [{ type: "dist", member: "CG", q: qv, angle: -90 }, { type: "dist", member: "GD", q: qv, angle: -90 }],
  });
  near(sol.R.A_x, (qv * L * L) / (8 * h));
  near(sol.R.B_x, -(qv * L * L) / (8 * h));
  near(sol.R.A_y, (qv * L) / 2);
  near(sol.members.CG.end.M, 0);
});

test("triangular load on a cantilever: M at the clamp = −qL²/6, T = qL/2", () => {
  const L = 3, qv = 4;
  const sol = solveFrame({
    nodes: { A: [0, 0], B: [L, 0] },
    members: [{ id: "AB", a: "A", b: "B", dashed: "right" }],
    supports: [{ node: "A", type: "clamp" }],
    loads: [{ type: "dist", member: "AB", q: qv, q1: 0, angle: -90 }],
  });
  near(sol.members.AB.start.M, -(qv * L * L) / 6);
  near(sol.members.AB.start.T, (qv * L) / 2);
  near(sol.R.M_A, (qv * L * L) / 6);
});

test("degenerate supports are rejected", () => {
  // Pin at A and a roller whose reaction line passes through A.
  assert.throws(() =>
    solveFrame({
      nodes: { A: [0, 0], B: [4, 0] },
      members: [{ id: "AB", a: "A", b: "B", dashed: "right" }],
      supports: [{ node: "A", type: "pin" }, { node: "B", type: "roller", angle: 0 }],
      loads: [{ type: "force", member: "AB", at: 2, F: 1, angle: -90 }],
    }),
  );
});

/** Checks on a solved frame: equilibrium, node balance, dM/ds = T, dT/ds = −q⊥. */
function checkFrame(sol, label) {
  const scale = Math.max(1, ...sol.reactions.map((r) => Math.abs(r.value)));
  for (const v of sol.residual) assert.ok(Math.abs(v) < 1e-7 * scale, `${label}: residual ${v}`);
  const nodes = new Set(Object.values(sol.members).flatMap((m) => [m.a, m.b]));
  for (const n of nodes) {
    const c = sol.nodeCheck(n);
    for (const v of [c.Fx, c.Fy, c.M]) assert.ok(Math.abs(v) < 1e-7 * scale * 10, `${label}: node ${n} ${v}`);
  }
  for (const m of Object.values(sol.members)) {
    for (let j = 0; j + 1 < m.breaks.length; j++) {
      const s0 = m.breaks[j], s1 = m.breaks[j + 1];
      const sm = (s0 + s1) / 2, d = (s1 - s0) * 1e-4;
      const dM = (m.M(sm + d) - m.M(sm - d)) / (2 * d);
      assert.ok(Math.abs(dM - m.T(sm)) < 1e-4 * scale, `${label}: dM/ds ${dM} vs T ${m.T(sm)}`);
      // dT/ds = −q⊥ with q⊥ from the loads on this member
      const dT = (m.T(sm + d) - m.T(sm - d)) / (2 * d);
      let qn = 0;
      for (const it of sol.items) {
        if (it.kind !== "D" || it.member !== m.id || sm < it.from || sm > it.to) continue;
        const qs = it.q0 + ((it.q1 - it.q0) * (sm - it.from)) / (it.to - it.from);
        qn += qs * (it.d[0] * m.n[0] + it.d[1] * m.n[1]);
      }
      assert.ok(Math.abs(dT + qn) < 1e-4 * scale, `${label}: dT/ds ${dT} vs −q ${-qn}`);
    }
    // Extremes really are where T = 0.
    for (const x of m.extremes) assert.ok(Math.abs(m.T(x.s)) < 1e-6 * scale, `${label}: T at extreme`);
    assert.ok(keyValues(m).every((k) => Number.isFinite(k.M)));
  }
}

test("generators: 400 random frames each — equilibrium, node balance, dM/ds = T, sensible answers", () => {
  const cases = [
    [okvirL, (p) => lFrameModel(p)],
    [okvirKonzola, (p) => konzolaModel(p)],
    [okvirPosevni, (p) => (p.kind === "veja" ? vejaModel(p) : strehaModel(p))],
  ];
  for (const [ex, model] of cases) {
    const r = rng(2024);
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
      const p = ex.generate(r);
      const task = ex.build(p);
      assert.ok(task.answers.length >= 2 && task.answers.length <= 6, ex.id);
      for (const a of task.answers) assert.ok(Number.isFinite(a.value), `${ex.id}: ${a.key}`);
      assert.ok(task.solution.every((l) => typeof l === "string" && !l.includes("NaN") && !l.includes("undefined")), `${ex.id}: solution text`);
      assert.ok(task.text.every((l) => !l.includes("NaN") && !l.includes("undefined")), `${ex.id}: text`);
      checkFrame(solveFrame(model(p)), ex.id);
      seen.add(JSON.stringify([p.layout ?? p.kind, p.sup ?? p.hb === p.H]));
    }
    assert.ok(seen.size >= 2, `${ex.id}: variety`);
  }
});

test("rope in the inclined-beam task is always in tension", () => {
  const r = rng(99);
  for (let i = 0; i < 400; i++) {
    const p = okvirPosevni.generate(r);
    if (p.kind !== "streha" || p.sup !== "rope") continue;
    assert.ok(solveFrame(strehaModel(p)).R.S > 0.2);
  }
});
