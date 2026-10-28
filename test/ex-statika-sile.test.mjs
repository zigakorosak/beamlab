// Reduction of force systems (2D, 3D box) and the parabolic cable:
// worked exam answers, then independent checks over many random tasks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rng } from "../src/exercises/kit.js";
import { redukcija2d, redukcija3d, solve3d, corners } from "../src/exercises/statika/reduction.js";
import { vrvParabola, solveCable } from "../src/exercises/statika/cables.js";

const near = (a, b, tol = 0.002) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const answer = (ex, key) => ex.answers.find((a) => a.key === key).value;
const cross = ([ax, ay, az], [bx, by, bz]) => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];

test("2D reduction (27.5.2004): R = (40, −13), M_O = 113, M_T(6, −2) = 111", () => {
  const ex = redukcija2d.build({
    forces: [{ F: [10, -15], at: [2, -5] }, { F: [5, -8], at: [-1, -2] }, { F: [25, 10], at: [0, -3] }],
    T: [6, -2],
  });
  near(answer(ex, "Rx"), 40);
  near(answer(ex, "Ry"), -13);
  near(answer(ex, "MO"), 113);
  near(answer(ex, "MT"), 111);
  near(answer(ex, "x0"), 113 / -13);
});

test("2D reduction: the resultant at (x_0, 0) reproduces M_O and M_T", () => {
  const r = rng(7);
  for (let i = 0; i < 500; i++) {
    const p = redukcija2d.generate(r);
    const ex = redukcija2d.build(p);
    const Rx = answer(ex, "Rx"), Ry = answer(ex, "Ry"), x0 = answer(ex, "x0");
    near(answer(ex, "MO"), x0 * Ry);
    near(answer(ex, "MT"), (x0 - p.T[0]) * Ry - (0 - p.T[1]) * Rx);
  }
});

test("3D reduction (30.1.2012): R, M_O and the moment about OB", () => {
  // Box 4 × 3 × 2: F1 = 3 kN at D(4,0,2) toward B(4,3,0), F2 = 7 kN at G(0,0,2) along +y.
  const base = { a: 4, b: 3, c: 2, forces: [{ from: "D", to: "B", F: 3 }, { from: "G", to: "F", F: 7 }], couple: null, point: "O" };
  const ex = redukcija3d.build({ ...base, variant: "tocka", axis: null });
  near(answer(ex, "Rx"), 0);
  near(answer(ex, "Ry"), 9.496);
  near(answer(ex, "Rz"), -1.664);
  near(answer(ex, "Mx"), -18.99);
  near(answer(ex, "My"), 6.656);
  near(answer(ex, "Mz"), 9.984);
  const ex2 = redukcija3d.build({ ...base, variant: "os", axis: ["O", "B"] });
  near(answer(ex2, "Mos"), -11.2);
  near(answer(ex2, "R"), Math.hypot(9.496, 1.664));
});

test("3D reduction: M about another point and about the axis, checked directly", () => {
  const r = rng(11);
  for (let i = 0; i < 500; i++) {
    const p = redukcija3d.generate(r);
    const res = solve3d(p);
    const K = corners(p.a, p.b, p.c);
    // Direct sum about the origin, then shift: M_P = M_O − r_P × R.
    let MO = [0, 0, 0];
    for (const f of p.forces) {
      const d = K[f.to].map((v, j) => v - K[f.from][j]);
      const L = Math.hypot(...d);
      const F = d.map((v) => (v * f.F) / L);
      MO = MO.map((v, j) => v + cross(K[f.from], F)[j]);
      assert.ok(Math.abs(Math.hypot(...F) - f.F) < 1e-9);
    }
    if (p.couple) {
      const d = K[p.couple.to].map((v, j) => v - K[p.couple.from][j]);
      const L = Math.hypot(...d);
      MO = MO.map((v, j) => v + (d[j] * p.couple.M) / L);
    }
    const rP = K[p.point];
    const MP = MO.map((v, j) => v - cross(rP, res.R)[j]);
    MP.forEach((v, j) => near(res.M[j], v, 1e-9));
    if (p.axis) {
      // Moment about the axis is the same about either of its end points.
      const [U, V] = p.axis;
      const e = K[V].map((v, j) => v - K[U][j]);
      const L = Math.hypot(...e);
      const MV = MO.map((v, j) => v - cross(K[V], res.R)[j]);
      near(res.os.Me, MV.reduce((t, v, j) => t + (v * e[j]) / L, 0), 1e-9);
    }
  }
});

test("cable, level supports (22.5.2013): L = 30, f = 2, q = 40 → H = 2250 N", () => {
  const ex = vrvParabola.build({ variant: "simetricna", q: 40, l: 30, f: 2 });
  near(answer(ex, "H"), 2250);
  near(answer(ex, "V"), 600);
  near(answer(ex, "Smax"), Math.hypot(2250, 600));
});

test("cable over a pulley (21.1.2013): l = 1, f = 0.06, q = 3 → H = 6.25, V = 1.5, Q = 6.427 N", () => {
  const ex = vrvParabola.build({ variant: "skripec", q: 3, l: 1, f: 0.06 });
  near(answer(ex, "H"), 6.25);
  near(answer(ex, "V"), 1.5);
  near(answer(ex, "Q"), 6.427);
  // The inverse: the weight gives back the sag.
  const inv = vrvParabola.build({ variant: "skripec", q: 3, l: 1, Q: Math.hypot(6.25, 1.5) });
  near(answer(inv, "f"), 0.06);
});

test("cable, supports at different heights (29.1.2009): S_B = 305.941 N at 11.31°", () => {
  const ex = vrvParabola.build({ variant: "sila", q: 3, l: 60, S: 305.941, alpha: 11.31 });
  near(answer(ex, "H"), 300);
  near(answer(ex, "xB"), 20);
  near(answer(ex, "b"), 2);
  near(answer(ex, "h"), 6);
  near(answer(ex, "Smax"), 323.11);
  // The same cable from h and b.
  const ex2 = vrvParabola.build({ variant: "visina", q: 3, l: 60, h: 6, b: 2 });
  near(answer(ex2, "H"), 300);
  near(answer(ex2, "xA"), 40);
  near(answer(ex2, "Smax"), 323.11);
});

test("cable: random tasks satisfy the parabola at both supports", () => {
  const r = rng(3);
  for (let i = 0; i < 1000; i++) {
    const p = vrvParabola.generate(r);
    const s = solveCable(p);
    assert.ok(s.xA > 0 && s.xB > 0 && s.H > 0, JSON.stringify(p));
    near(s.xA + s.xB, s.l, 1e-9);
    near(s.zA, (p.q * s.xA ** 2) / (2 * s.H), 1e-9);
    if (p.variant === "visina") {
      near(s.zA, p.h + p.b, 1e-9);
      near(s.zB, p.b, 1e-9);
    }
    if (p.variant === "skripec" && p.Q !== undefined) near(s.SB, p.Q, 1e-9);
    if (p.variant === "sila") near(s.SB, p.S, 1e-9);
    // The higher support carries the larger force.
    assert.ok(s.zA >= s.zB - 1e-9 && s.Smax === s.SA);
    const ex = vrvParabola.build(p);
    for (const a of ex.answers) assert.ok(Number.isFinite(a.value) && a.value > 0, `${p.variant}: ${a.key}`);
  }
});

test("F4: the angle is never next to 0°/360° (no wrap-around in grading)", async () => {
  const { sileF4 } = await import("../src/exercises/statika/concurrent.js");
  const r = rng(21);
  for (let i = 0; i < 1000; i++) {
    const phi = answer(sileF4.build(sileF4.generate(r)), "phi");
    assert.ok(phi > 2 && phi < 358, String(phi));
  }
});

test("2D reduction: x_0 is never within 0,5 m of O (5 % of it would be millimetres)", () => {
  const r = rng(13);
  for (let i = 0; i < 2000; i++) {
    const x0 = answer(redukcija2d.build(redukcija2d.generate(r)), "x0");
    assert.ok(Math.abs(x0) >= 0.5 && Math.abs(x0) <= 30, String(x0));
  }
});
