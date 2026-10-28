// Strength exercises in src/exercises/trdnost2 (torzija, tankostenski
// prerezi, uklon, strig, tlačne posode, upogib + torzija): worked examples
// from the course notes as test vectors, plus independent physics checks
// (equilibrium, compatibility, ∫τ b dz = T, back-substitution of dimensions).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rng, deg, rad } from "../src/exercises/kit.js";
import { figure } from "../src/exercises/draw.js";
import { torzija, circle } from "../src/exercises/trdnost2/torzija.js";
import { tankostenski, torsionThin } from "../src/exercises/trdnost2/tankostenski.js";
import { uklon, critical, props, solveLength, solveDiameter, MATERIALS } from "../src/exercises/trdnost2/uklon.js";
import { strig, shear } from "../src/exercises/trdnost2/strig.js";
import { posoda } from "../src/exercises/trdnost2/posoda.js";
import { kombinirana, combined, requiredD } from "../src/exercises/trdnost2/kombinirana.js";

const near = (a, b, tol = 0.002) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const answer = (ex, key) => ex.answers.find((a) => a.key === key).value;
const MINE = [torzija, tankostenski, uklon, strig, posoda, kombinirana];

// ---------- Torzija

// The notes print M_t = 1,179·10⁵ Nmm, but their own numbers give 1,171·10⁵
// (and their τ = 176,7 MPa follows from 1,171·10⁵): a typo in the notes.
test("torsion spring (zapiski): d = 15 mm, l = 1,5 m, G = 81 GPa, φ = 25° → M_t = 117,1 Nm, τ = 176,7 MPa", () => {
  const { IT, WT } = circle(15);
  const Mt = (rad(25) * 81000 * IT) / 1500; // Nmm
  near(Mt, 1.171e5, 0.002);
  near(Mt / WT, 176.7, 0.002);
});

test("welded tube (NTF izvleček p. 80): R = 10, r = 9 cm → I_T = 5401,97 cm⁴, u_C = 1,497 cm", () => {
  const { IT } = circle(200, 180);
  near(IT / 1e4, 5401.97, 1e-4);
  // u_C = φ·a with M = 40440,151 Nm, L = 2 m, a = 1 m, G = 100 GPa
  const phi = (40440.151e3 * 2000) / (100000 * IT);
  near(phi * 100, 1.49723, 1e-4);
});

test("torzija odseki: equilibrium of torques and twist by segments", () => {
  const p = { kind: "odseki", L1: 1, L2: 1.5, D1: 80, D2: 60, d: 0, MB: 6, MC: -2 };
  const ex = torzija.build(p);
  near(answer(ex, "MA"), 4); // M_A = −(6 − 2)
  near(answer(ex, "t1"), (4e6 * 16) / (Math.PI * 80 ** 3));
  near(answer(ex, "t2"), (2e6 * 16) / (Math.PI * 60 ** 3));
  const phi = (4e6 * 1000) / (80000 * circle(80).IT) - (2e6 * 1500) / (80000 * circle(60).IT);
  near(answer(ex, "phi"), Math.abs(deg(phi)));
});

test("torzija dim: the two diameters meet τ_dop and φ_dop exactly", () => {
  for (const alpha of [0, 0.6]) {
    const p = { kind: "dim", M: 5, L: 2, tauDop: 60, phiDop: 1, alpha };
    const ex = torzija.build(p);
    const Dt = answer(ex, "Dt"), Dp = answer(ex, "Dp");
    near((5e6 / circle(Dt, alpha * Dt).WT), 60, 1e-6);
    near(deg((5e6 * 2000) / (80000 * circle(Dp, alpha * Dp).IT)), 1, 1e-6);
    near(answer(ex, "D"), Math.max(Dt, Dp));
  }
});

test("torzija nedoločena: M_A + M_B = M_T and equal twist of C from both sides", () => {
  const ex = torzija.build({ kind: "nedolocena", L1: 1, L2: 2, M: 9, D: 70 });
  const MA = answer(ex, "MA"), MB = answer(ex, "MB");
  near(MA + MB, 9);
  near(MA * 1, MB * 2);
  near(MA, 6);
  near(answer(ex, "phi"), deg((6e6 * 1000) / (80000 * circle(70).IT)));
});

// ---------- Tankostenski

test("Bredt on a thin circular tube ≈ exact hollow-circle formula", () => {
  const x = torsionThin({ kind: "cev", D: 200, t: 2, M: 1 });
  const exact = 1e6 / circle(200, 196).WT;
  assert.ok(Math.abs(x.tauZ - exact) / exact < 0.02, `${x.tauZ} vs ${exact}`);
  near(x.ITz, circle(200, 196).IT, 0.01);
  near(x.ITo, (2 * Math.PI * 99 * 8) / 3);
});

test("box section: A_m inside the midline, I_T = 4A_m²/∮ds/t", () => {
  const x = torsionThin({ kind: "skatla", B: 100, H: 200, t1: 10, t2: 5, M: 2 });
  near(x.Am, 95 * 190);
  near(x.tauZ, 2e6 / (2 * 95 * 190 * 5));
  near(x.ITz, (4 * (95 * 190) ** 2) / (2 * 95 / 10 + (2 * 190) / 5));
  near(x.ITo, (2 * 95 * 1000 + 2 * 190 * 125) / 3);
  near(x.tauO, (2e6 * 10) / x.ITo);
});

// ---------- Uklon

test("NPI 160 (zapiski): I = 54,7 cm⁴, A = 22,8 cm², L = 3,2 m → λ = 206, F_cr = 110,7 kN", () => {
  const c = critical(MATERIALS.jeklo, 22.8, 54.7, 320);
  near(c.lam, 206.4, 0.002);
  assert.ok(c.euler);
  near(c.Fcr, 110.7, 0.002);
  near(c.Fcr / 3, 36.9, 0.002);
});

test("Euler and Tetmajer nearly meet at λ = 105 (steel) and 100 (timber)", () => {
  for (const m of [MATERIALS.jeklo, MATERIALS.les]) {
    const euler = (Math.PI ** 2 * m.E * 10) / m.lamE ** 2; // MPa
    const tet = m.a - m.b * m.lamE;
    assert.ok(Math.abs(euler - tet) / tet < 0.02, `${m.name}: ${euler} vs ${tet}`);
  }
});

test("section properties: I section weak axis, tube", () => {
  const I = props({ kind: "I", H: 20, B: 10, tf: 1, tw: 0.6 });
  near(I.A, 2 * 10 + 18 * 0.6);
  near(I.I, (2 * 1 * 1000) / 12 + (18 * 0.216) / 12);
  const t = props({ kind: "tube", D: 10, t: 1 });
  near(t.I, (Math.PI * (1e4 - 4096)) / 64);
});

test("uklon: L_max and d put the column exactly at F_cr = ν·F (Euler and Tetmajer branches)", () => {
  const r = rng(7);
  let seen = { e: 0, t: 0 };
  for (let n = 0; n < 400; n++) {
    const p = uklon.generate(r);
    if (p.kind === "dolzina") {
      const x = solveLength(p);
      const { A, I } = props(p.sec);
      const c = critical(MATERIALS[p.mat], A, I, p.beta * x.L * 100);
      near(c.Fcr, p.nu * p.F, 1e-6);
      seen[c.euler ? "e" : "t"]++;
    } else if (p.kind === "premer") {
      const x = solveDiameter(p);
      const d = x.d;
      const c = critical(MATERIALS.jeklo, (Math.PI * d * d) / 4, (Math.PI * d ** 4) / 64, p.beta * p.L * 100);
      near(c.Fcr, p.nu * p.F, 1e-6);
      near(c.lam, x.lam, 1e-9);
      seen[c.euler ? "e" : "t"]++;
    } else {
      const ex = uklon.build(p);
      near(answer(ex, "Fdop") * p.nu, answer(ex, "Fcr"));
    }
  }
  assert.ok(seen.e > 5 && seen.t > 5, JSON.stringify(seen));
});

// ---------- Strig

/** Numerical S*(y) and ∫τ b dy over a section given as b(y) on [0, H] (y from the bottom). */
function numericShear(bOf, H, T, n = 20000) {
  const dy = H / n;
  let A = 0, Sy = 0;
  for (let i = 0; i < n; i++) { const y = (i + 0.5) * dy; A += bOf(y) * dy; Sy += bOf(y) * y * dy; }
  const yc = Sy / A;
  let I = 0;
  for (let i = 0; i < n; i++) { const y = (i + 0.5) * dy; I += bOf(y) * (y - yc) ** 2 * dy; }
  const Sstar = (y0) => { let s = 0; const m = 4000, h = (H - y0) / m; for (let i = 0; i < m; i++) { const y = y0 + (i + 0.5) * h; s += bOf(y) * (y - yc) * h; } return s; };
  let resultant = 0; // ∫ τ b dy = T/I ∫ S* dy
  const m = 800;
  for (let i = 0; i < m; i++) resultant += (T * Sstar(((i + 0.5) * H) / m)) / I * (H / m);
  return { A, yc, I, Sstar, resultant };
}

test("shear: rectangle 1,5·T/A, circle 4/3·T/A", () => {
  const r = shear({ kind: "rect", b: 10, h: 16 }, 4.5, 4);
  near(r.tmax, (1.5 * 4.5) / 160);
  near(r.ty, (4.5 / (2 * r.I)) * (64 - 16));
  const c = shear({ kind: "circle", d: 10 }, 10, 3);
  near(c.tmax, (4 / 3) * (10 / (Math.PI * 25)));
  near(c.ty, (10 * (25 - 9)) / (3 * c.I));
});

test("shear: I and T sections agree with a numerical S*, and ∫τ b dz = T", () => {
  const Isec = { kind: "I", H: 30, B: 16, tf: 1.5, tw: 0.8 };
  const bI = (y) => (y < 1.5 || y > 28.5 ? 16 : 0.8);
  const nI = numericShear(bI, 30, 50);
  const xI = shear(Isec, 50);
  near(xI.I, nI.I, 1e-3);
  near(xI.S0, nI.Sstar(15), 1e-3);
  near(xI.Sf, nI.Sstar(28.5), 1e-3);
  near(nI.resultant, 50, 2e-3);

  const Tsec = { kind: "T", B: 12, tf: 2, hw: 16, tw: 2 };
  const bT = (y) => (y > 16 ? 12 : 2); // flange on top
  const nT = numericShear(bT, 18, 30);
  const xT = shear(Tsec, 30);
  near(18 - xT.yc, nT.yc, 1e-3); // yc from the top vs from the bottom
  near(xT.I, nT.I, 1e-3);
  near(xT.S0, xT.S0top, 1e-9);
  near(xT.S0, nT.Sstar(nT.yc), 1e-3);
  near(xT.Sf, nT.Sstar(16), 1e-3);
  near(nT.resultant, 30, 2e-3);
});

test("strig build: T_max of the beam", () => {
  const ex = strig.build({ beam: { kind: "point", L: 4, F: 20, a: 1 }, sec: { kind: "rect", b: 10, h: 20 }, y0: 5 });
  near(answer(ex, "T"), 15);
  near(answer(ex, "tmax"), ((1.5 * 15) / 200) * 10);
});

// ---------- Tlačna posoda

test("pressure vessel: σ_ob = pd/2t, σ_aks = σ_ob/2, end-cap force, thickness and pressure", () => {
  const ex = posoda.build({ kind: "napetosti", shape: "valj", bar: true, p: 20, d: 1000, t: 10, sdop: 140 });
  near(answer(ex, "sob"), 100);
  near(answer(ex, "sax"), 50);
  near(answer(ex, "mis"), Math.sqrt(100 ** 2 - 5000 + 2500));
  near(answer(ex, "F"), (2 * Math.PI * 1e6) / 4 / 1000);
  const t = posoda.build({ kind: "debelina", shape: "valj", bar: false, p: 2, d: 1400, t: 10, sdop: 140 });
  near(answer(t, "tN"), 10);
  near(answer(t, "tM"), 10 * Math.sqrt(3) / 2);
  const s = posoda.build({ kind: "debelina", shape: "krogla", bar: false, p: 2, d: 1400, t: 10, sdop: 140 });
  near(answer(s, "t"), 5);
  const pp = posoda.build({ kind: "tlak", shape: "valj", bar: true, p: 0, d: 1000, t: 10, sdop: 100 });
  near(answer(pp, "pN"), 20); // 2 MPa = 20 bar
});

// ---------- Kombinirana

test("arm AB + BC: moment of F about A by the cross product gives M = F·L, M_T = F·a", () => {
  const p = { kind: "rocica", mode: "kontrola", hyp: "Mises", sdop: 160, L: 1.5, a: 0.4, F: 4, D: 60 };
  const ex = kombinirana.build(p);
  // r = (L, −a, 0) (arm drawn towards −y), F = (0, 0, −F): M_A = −r × F
  const [rx, ry] = [1.5, -0.4];
  const m = [ry * -4, -(rx * -4), 0];
  near(answer(ex, "MT"), Math.abs(m[0]));
  near(answer(ex, "M"), Math.abs(m[1]));
  const W = (Math.PI * 60 ** 3) / 32;
  near(answer(ex, "s"), 6e6 / W);
  near(answer(ex, "t"), 1.6e6 / (2 * W));
  near(answer(ex, "eq"), Math.sqrt((6e6 / W) ** 2 + 3 * (0.8e6 / W) ** 2));
});

test("combined: required d gives σ_ekv = σ_dop (both hypotheses)", () => {
  for (const hyp of ["Mises", "Tresca"]) {
    const { d } = requiredD({ M: 3, MT: 2, hyp, sdop: 120 });
    near(combined({ M: 3, MT: 2, D: d, hyp }).eq, 120, 1e-9);
  }
  const ex = kombinirana.build({ kind: "jermen", mode: "kontrola", hyp: "Tresca", sdop: 120, L: 2, a: 0.5, R: 200, S1: 10, S2: 4, D: 60 });
  near(answer(ex, "MT"), 1.2);
  near(answer(ex, "M"), (14 * 0.5 * 1.5) / 2);
});

// ---------- Every generator

test("trdnost2 generators: 300 tasks each, positive finite answers, figures build", () => {
  for (const ex of MINE) {
    const r = rng(2024);
    const kinds = new Set();
    for (let i = 0; i < 300; i++) {
      const p = ex.generate(r);
      kinds.add(p.kind ?? p.sec?.kind);
      const task = ex.build(p);
      assert.deepEqual(ex.build(p).answers, task.answers); // pure
      assert.ok(task.text.length && task.solution.length, ex.id);
      assert.ok(task.answers.length >= 2 && task.answers.length <= 6, ex.id);
      for (const a of task.answers) assert.ok(Number.isFinite(a.value) && a.value > 0, `${ex.id}: ${a.key} = ${a.value} ${JSON.stringify(p)}`);
      for (const line of [...task.text, ...task.solution]) assert.ok(!/NaN|undefined|Infinity/.test(line), `${ex.id}: ${line}`);
      task.figure(figure());
    }
    assert.ok(kinds.size >= 2, `${ex.id}: ${[...kinds]}`);
  }
});
