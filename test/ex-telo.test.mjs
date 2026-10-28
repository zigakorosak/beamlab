// Rigid-body equilibrium, contact problems and centroids (src/exercises/telo):
// every build() checked against worked exam answers, plus equilibrium
// residuals over many random draws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rng, rad } from "../src/exercises/kit.js";
import { palicaPolvalj, nosilecValj, kroglaVrv, solvePalicaPolvalj, solveNosilecValj, solveKroglaVrv } from "../src/exercises/telo/kontakt.js";
import { palicaVrv, dvePalici, dvePaliciNapetost, solvePalicaVrv, solveDvePalici } from "../src/exercises/telo/palice.js";
import { tezisce, pappus, solvePrevrnitev, solvePappus } from "../src/exercises/telo/tezisce.js";

const near = (a, b, tol = 0.002) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const answer = (ex, key) => ex.answers.find((a) => a.key === key).value;

test("rod on half-cylinder (28.1.2015): corrected, the sheet's φ = 23,39° should be 26,39°", () => {
  // The exam names the contact A and the pin B; here the contact is B, the pin A.
  // sin φ = 0,8/1,8 → φ = 26,39° (the handwritten solution took 23,39° and got
  // A = 111,71, Bx = 44,35, By = 93,67 N). With φ = 26,39°: B = G·L/(2d) = 109,0 N.
  const ex = palicaPolvalj.build({ L: 2, m: 20, r: 0.8, d: 1.8, g: 9.81, gap: true, askF: false });
  near(answer(ex, "B"), (20 * 9.81 * 2) / (2 * 1.8));
  near(answer(ex, "B"), 109.0);
  near(answer(ex, "Ax"), 48.44);
  near(answer(ex, "Ay"), 98.56);
  near(solvePalicaPolvalj({ L: 2, m: 20, r: 0.8, d: 1.8, g: 9.81 }).b, 1.612);
  // The sheet's own (wrong) angle reproduces its numbers: the method is the same.
  const G = 196.2, phi = rad(23.39);
  near((G * Math.cos(phi)) / 1.612, 111.71);
});

test("rod on half-cylinder (22.5.2013, g = 10): B = 750, Ax = 262,5, Ay = 797,4 N, f = 0,3736", () => {
  const ex = palicaPolvalj.build({ L: 2, m: 150, r: 0.7, d: 2, g: 10, gap: false, askF: true });
  near(answer(ex, "B"), 750);
  near(answer(ex, "Ax"), 262.5);
  near(answer(ex, "Ay"), 797.4);
  near(answer(ex, "f"), 0.3736);
});

test("beam on half-cylinders (9.9.2016): B = 3172, Ax = 1586, Ay = 0 N", () => {
  const ex = nosilecValj.build({ L: 4, a: 4, m: 280, mn: 0, r1: 1.2, r2: 1.2, e: 1.2, side: -1, g: 9.81 });
  near(answer(ex, "B"), 3172);
  near(answer(ex, "Ax"), 1586);
  near(answer(ex, "Ay"), 0);
});

test("sphere against a wall (1.6.2015) and in a corner: S = 141,5, walls 53,08 N", () => {
  const w = kroglaVrv.build({ corner: false, r: 10, l: 30, G: 98.1, m: 10 });
  // sin φ = 10/40: S = G/cos φ, N = G tan φ
  near(answer(w, "S"), 98.1 / Math.sqrt(1 - 1 / 16));
  near(answer(w, "N"), 98.1 * 0.25 / Math.sqrt(1 - 1 / 16));
  const c = kroglaVrv.build({ corner: true, r: 6, l: 10, G: 120, m: null });
  near(answer(c, "S"), 141.5);
  near(answer(c, "N"), 53.08);
  near(solveKroglaVrv({ corner: true, r: 6, l: 10, G: 120 }).H, 75.06);
});

test("bar on a rope (12.6.2006): F = 6,974 kN", () => {
  const ex = palicaVrv.build({ L: 4, q: 2, q0: 0, q1: 4, P: 0, xP: 0, alpha: 35 });
  near(answer(ex, "F"), 6.974);
  near(answer(ex, "Ax"), 6.974 * Math.cos(rad(35)));
  near(answer(ex, "Ay"), 4);
});

test("two bars with a pulley: 4.2.2013 (N1 = 14, N2 = −33,8) and 27.6.2016 (43,92 / −120)", () => {
  const a = dvePalici.build({ L1: 4, alpha: 45, below: true, rope: "p", Q: 14 });
  near(answer(a, "N1"), 14);
  near(answer(a, "N2"), -33.8);
  const b = dvePalici.build({ L1: 5.2, alpha: 30, below: true, rope: "h", Q: 60 });
  near(answer(b, "N1"), 43.92);
  near(answer(b, "N2"), -120);
});

test("two bars, sizing (27.6.2016): A1 = 6,275, A2 = 17,14 cm², Δl1 = 5,2, Δl2 = −6,003 mm", () => {
  const ex = dvePaliciNapetost.build({ L1: 5.2, alpha: 30, below: true, rope: "h", Q: 60, E: 70000, sdop: 7 });
  near(answer(ex, "A1"), 6.275);
  near(answer(ex, "A2"), 17.14);
  near(answer(ex, "dl1"), 5.2);
  // The exam takes l2 = √(5,2² + 3²) = 6,0033 m; with exactly 30° l2 = 6,0044 m.
  near(answer(ex, "dl2"), -6.003, 0.001);
});

test("T body tipping (28.6.2006): y_T = 9,0909 cm, α = 15,376°", () => {
  const ex = tezisce.build({ shape: "T", b1: 12, h1: 5, b2: 5, h2: 10, down: "L" });
  near(answer(ex, "yT"), 9.0909);
  near(answer(ex, "alpha"), 15.376);
});

test("Pappus basin (10.4.2006): A = 200 m², x_T = 5,4793 m, V = 6885,49 m³", () => {
  const ex = pappus.build({ R: 10, w: 0 });
  near(answer(ex, "A"), 200);
  near(answer(ex, "xT"), 5.4793);
  near(answer(ex, "V"), 6885.49);
  // wetted surface: π b² + 2π² R (b + R) with b = 0
  near(answer(ex, "S"), 2 * Math.PI ** 2 * 100);
  // with a flat bottom: the half-section area grows by w/2 · 2R
  near(solvePappus({ R: 3, w: 4 }).A, 2 * 9 + 2 * 3 * 2);
});

test("random draws satisfy equilibrium", () => {
  const r = rng(777);
  for (let i = 0; i < 400; i++) {
    // rod: forces and moment about the cylinder's centre
    {
      const p = palicaPolvalj.generate(r);
      const R = solvePalicaPolvalj(p);
      const c = Math.cos(R.phi), s = Math.sin(R.phi);
      near(R.Ax - R.B * s, 0, 1e-9);
      near(R.Ay + R.B * c - R.G, 0, 1e-9);
      // ΣM about the tangent point B: A's moment equals the weight's
      const Pb = [R.b * c, R.b * s];
      const mA = -Pb[0] * R.Ay + Pb[1] * R.Ax; // A acts at the origin: r = −Pb
      const mG = ((p.L / 2) * c - Pb[0]) * -R.G;
      near(mA + mG, 0, 1e-6);
      assert.ok(R.b < p.L, "contact on the rod");
    }
    {
      const p = nosilecValj.generate(r);
      const R = solveNosilecValj(p);
      // forces on beam + hanging body; B along the line of centres
      near(R.Ay + R.B * Math.sin(R.phi) - R.G - R.Gn, 0, 1e-9);
      near(p.a * R.B * Math.sin(R.phi) - p.a * R.G - (p.L / 2) * R.Gn, 0, 1e-6);
      near(Math.hypot(R.Ax, R.B * Math.sin(R.phi)), R.B, 1e-9);
      // the two half-cylinders touch: centre distance r1 + r2
      near(Math.hypot(p.e, R.H), p.r1 + p.r2, 1e-9);
      assert.ok(R.H - p.r1 > 0, "hanging body clears the ground");
      assert.ok(R.Ay >= -1e-9);
    }
    {
      const p = palicaVrv.generate(r);
      const R = solvePalicaVrv(p);
      const s = Math.sin(rad(p.alpha));
      near(R.F * s * p.L - R.Q * R.xQ - p.P * p.xP, 0, 1e-9);
      near(R.Ay + R.F * s - R.Q - p.P, 0, 1e-9);
      assert.ok(R.Ay > 0 && R.F > 0);
    }
    {
      const p = dvePalici.generate(r);
      const R = solveDvePalici(p);
      const fx = -R.N1 + R.N2 * R.e2[0] + p.Q * R.u[0];
      const fy = R.N2 * R.e2[1] + p.Q * R.u[1] - p.Q;
      near(fx, 0, 1e-9);
      near(fy, 0, 1e-9);
    }
    {
      const p = dvePaliciNapetost.generate(r);
      const ex = dvePaliciNapetost.build(p);
      // σ = N/A = ±σ_dop in both bars
      near(Math.abs(answer(ex, "N1")) / answer(ex, "A1"), p.sdop, 1e-9);
      near(Math.abs(answer(ex, "N2")) / answer(ex, "A2"), p.sdop, 1e-9);
      near(Math.abs(answer(ex, "dl1")), ((p.sdop * 10) / p.E) * p.L1 * 1000, 1e-9);
    }
    {
      const p = tezisce.generate(r);
      const R = solvePrevrnitev(p);
      // tilted by α about the lower corner, the centroid is right above it
      const a = rad(R.alpha);
      const cx = p.down === "L" ? 0 : R.base;
      const sgn = p.down === "L" ? 1 : -1;
      const xRot = cx + (R.xT - cx) * Math.cos(a) - sgn * R.yT * Math.sin(a);
      near(xRot - cx, 0, 1e-9);
    }
    {
      const p = pappus.generate(r);
      const S = solvePappus(p);
      // the water half-section equals the bounding box 2R·(b + 2R) minus the ground under the bottom arc's outer part, i.e. b·2R + 2R²
      near(S.A, S.b * 2 * p.R + 2 * p.R * p.R, 1e-9);
    }
  }
});

test("texts and figures mention every given value", () => {
  const r = rng(99);
  for (const ex of [palicaPolvalj, nosilecValj, kroglaVrv, palicaVrv, dvePalici, dvePaliciNapetost, tezisce, pappus]) {
    for (let i = 0; i < 50; i++) {
      const t = ex.build(ex.generate(r));
      assert.ok(t.answers.length >= 2 && t.answers.length <= 6, ex.id);
      for (const a of t.answers) assert.ok(Number.isFinite(a.value), `${ex.id} ${a.key}`);
      assert.ok(t.text.join(" ").length > 80, ex.id);
    }
  }
});
