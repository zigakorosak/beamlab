// Friction exercises (trenje): build() against the worked exam answers, and
// for many random tasks an independent check that the limit state is in
// equilibrium (force vectors summed in x–y, friction exactly f·N, pointing
// against the impending motion).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rng, rad } from "../src/exercises/kit.js";
import { trenjeKlanec, solveKlanec } from "../src/exercises/trenje/klanec.js";
import { trenjeBloka, solveBloka } from "../src/exercises/trenje/bloka.js";
import { trenjeLestev, solveLestev } from "../src/exercises/trenje/lestev.js";
import { trenjeVrvi } from "../src/exercises/trenje/vrvi.js";
import { trenjePrag } from "../src/exercises/trenje/prag.js";

const near = (a, b, tol = 0.002) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const answer = (ex, key) => ex.answers.find((a) => a.key === key).value;
const zero = (v, scale) => assert.ok(Math.abs(v) <= 1e-9 * Math.max(1, scale), `residual ${v}`);
const vec = (a, F) => [F * Math.cos(rad(a)), F * Math.sin(rad(a))];
const sum = (...vs) => vs.reduce((s, v) => [s[0] + v[0], s[1] + v[1]], [0, 0]);

test("brick pressed onto a board (11.4.2007): F = 18,093 N", () => {
  const ex = trenjeKlanec.build({ kind: "pravokotna", alpha: 35, f: 0.4, m: 3 });
  near(answer(ex, "G"), 29.43);
  near(answer(ex, "Fmin"), 18.093);
});

test("stacked blocks: G1 = 3, G2 = 4, f = 0,4 → F = 4,0 kN", () => {
  const ex = trenjeBloka.build({ G1: 3, G2: 4, f1: 0.4, f2: 0.4, beta: 0 });
  near(answer(ex, "S"), 1.2);
  near(answer(ex, "F"), 4.0);
});

test("ladder: 150 N, 4 m, 60°, worker 1000 N at 3 m → Bx 476,31 (sheet: 476,13, a typo), By 1150, f 0,4142", () => {
  const ex = trenjeLestev.build({ kind: "koef", Q: 150, P: 1000, L: 4, alpha: 60, a: 3 });
  near(answer(ex, "Bx"), 476.31, 1e-4); // 3300·cos 60° / (4 sin 60°); f = 476,31/1150 = 0,4142
  near(answer(ex, "By"), 1150);
  near(answer(ex, "f"), 0.4142);
  // B_x is graded against its own size, not against the larger B_y.
  assert.equal(ex.answers.find((a) => a.key === "Bx").scale, answer(ex, "Bx"));
  // The reverse question at that f puts the worker back at 3 m.
  const back = trenjeLestev.build({ kind: "visina", Q: 150, P: 1000, L: 4, alpha: 60, f: answer(ex, "f") });
  near(answer(back, "x"), 3);
});

test("rope over a drum (23.6.2015): N 433,01, T 173,2, S 423,2, B 978,1 N", () => {
  const ex = trenjeVrvi.build({ kind: "klanec", max: true, A: 500, alpha: 30, f1: 0.4, f2: 0.4 });
  near(answer(ex, "N"), 433.01);
  near(answer(ex, "T"), 173.2);
  near(answer(ex, "S"), 423.2);
  near(answer(ex, "B"), 978.1);
});

test("wheel over a step (exam): α 56,25°, f 1,496, M_t 1496 Nm", () => {
  const ex = trenjePrag.build({ kind: "pogon", d: 90, h: 20, G: 4 });
  near(answer(ex, "alpha"), 56.25);
  near(answer(ex, "f"), 1.496);
  near(answer(ex, "Mt"), 1496, 0.001);
});

test("incline: limit states are equilibria (random tasks)", () => {
  const r = rng(7);
  for (let i = 0; i < 400; i++) {
    const p = trenjeKlanec.generate(r);
    const { alpha: a, f } = p;
    const R = solveKlanec(p);
    const G = R.W;
    assert.ok(R.Fmin > 0 && (p.kind === "pravokotna" || R.Fmax > R.Fmin), JSON.stringify(p));
    // Applied force direction per kind.
    const Fdir = { vzporedna: a, dva: a, vodoravna: 0, pravokotna: a - 90 }[p.kind];
    for (const [F, down] of [[R.Fmin, true], [R.Fmax, false]]) {
      if (p.kind === "pravokotna" && !down) continue;
      // Normal from the contact: whatever balances the normal components.
      const Fv = vec(Fdir, F);
      const Gv = [0, -G];
      const nrm = [Math.cos(rad(a + 90)), Math.sin(rad(a + 90))];
      const N = -((Fv[0] + Gv[0]) * nrm[0] + (Fv[1] + Gv[1]) * nrm[1]);
      assert.ok(N > 0);
      const T = vec(down ? a : a + 180, f * N); // against the impending slide
      const res = sum(Fv, Gv, vec(a + 90, N), T);
      zero(res[0], G);
      zero(res[1], G);
    }
    // Without the force the block slides: G sin α > f G cos α.
    assert.ok(Math.sin(rad(a)) > f * Math.cos(rad(a)));
  }
});

test("stacked blocks: both free bodies balance (random tasks)", () => {
  const r = rng(8);
  for (let i = 0; i < 300; i++) {
    const p = trenjeBloka.generate(r);
    const R = solveBloka(p);
    // Block 1: rope to the wall (up-left at β), friction to the right.
    const b1 = sum(vec(180 - p.beta, R.S), [0, -p.G1], [0, R.N1], [p.f1 * R.N1, 0]);
    zero(b1[0], p.G1);
    zero(b1[1], p.G1);
    assert.ok(R.N1 > 0);
    // Block 2: F right, friction from block 1 and floor to the left.
    const b2 = sum([R.F, 0], [-p.f1 * R.N1, 0], [0, -R.N1 - p.G2], [0, R.N2], [-p.f2 * R.N2, 0]);
    zero(b2[0], p.G2);
    zero(b2[1], p.G2);
  }
});

test("ladder: moments about the top also vanish (random tasks)", () => {
  const r = rng(9);
  for (let i = 0; i < 300; i++) {
    const p = trenjeLestev.generate(r);
    const R = solveLestev(p);
    const x = p.kind === "koef" ? p.a : R.x;
    const c = Math.cos(rad(p.alpha)), s = Math.sin(rad(p.alpha));
    // About A (top): B_y·L cos α − B_x·L sin α − Q·(L/2)cos α − P·(L − x)cos α = 0
    const M = R.By * p.L * c - R.Bx * p.L * s - p.Q * (p.L / 2) * c - p.P * (p.L - x) * c;
    zero(M, R.By * p.L);
    if (p.kind === "koef") assert.ok(R.f > 0 && R.f < 1);
    else assert.ok(x > 0 && x < p.L);
  }
});

test("rope friction: the rope is about to slip, block in limit equilibrium (random tasks)", () => {
  const r = rng(10);
  for (let i = 0; i < 400; i++) {
    const p = trenjeVrvi.generate(r);
    const ex = trenjeVrvi.build(p);
    if (p.kind === "klanec") {
      const { A, alpha: a, f1, f2, max } = p;
      const S = answer(ex, "S"), N = answer(ex, "N"), B = answer(ex, "B");
      // Block: rope up the slope, friction against the motion.
      const res = sum(vec(a, S), [0, -A], vec(a + 90, N), vec(max ? a + 180 : a, f1 * N));
      zero(res[0], A);
      zero(res[1], A);
      assert.ok(S > 0 && B > 0);
      // Larger tension on the side the rope slips to.
      const ratio = max ? B / S : S / B;
      near(Math.log(ratio), f2 * rad(90 + a), 1e-9);
    } else if (p.kind === "steber") {
      near(answer(ex, "Fmin") * Math.exp(p.f * answer(ex, "delta")), p.Q, 1e-9);
    } else {
      const n = answer(ex, "n");
      const holds = (k) => p.F * Math.exp(p.f * Math.PI * (1 + 2 * k)) >= p.Q;
      assert.ok(Number.isInteger(n) && n >= 1 && holds(n) && !holds(n - 1), JSON.stringify(p));
    }
  }
});

test("wheel over a step: the force triangle closes (random tasks)", () => {
  const r = rng(11);
  for (let i = 0; i < 300; i++) {
    const p = trenjePrag.generate(r);
    const ex = trenjePrag.build(p);
    const rr = p.d / 2;
    // Unit vector from the edge E to the centre C.
    const e = [-Math.sqrt(rr * rr - (rr - p.h) ** 2) / rr, (rr - p.h) / rr];
    if (p.kind === "vodoravna") {
      const R = answer(ex, "R"), F = answer(ex, "F");
      zero(F + R * e[0], p.G);
      zero(R * e[1] - p.G, p.G);
    } else if (p.kind === "najmanjsa") {
      const R = answer(ex, "R"), F = answer(ex, "F"), b = answer(ex, "beta");
      const Fv = vec(b, F);
      zero(Fv[0] + R * e[0], p.G);
      zero(Fv[1] + R * e[1] - p.G, p.G);
      // Perpendicular to R and no smaller force can close the triangle.
      zero(Fv[0] * e[0] + Fv[1] * e[1], p.G);
    } else {
      const f = answer(ex, "f");
      // N along E→C, T perpendicular to it with |T| = f·N; sum is +G.
      const N = p.G * e[1];
      const t = [e[1], -e[0]]; // perpendicular to e (pointing right-up)
      const res = sum(vec(0, 0), [N * e[0] + f * N * t[0], N * e[1] + f * N * t[1]]);
      zero(res[0], p.G);
      near(res[1], p.G, 1e-9);
      near(answer(ex, "Mt"), f * N * 1000 * (rr / 100), 1e-9);
    }
  }
});
