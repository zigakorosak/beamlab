// Stress and strain states (napetosti): exam answers and independent checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rng } from "../src/exercises/kit.js";
import { answerOk } from "../src/core/grading.js";
import { planeStress } from "../src/exercises/napetosti/element.js";
import { mohr, mohrInverzna } from "../src/exercises/napetosti/mohr.js";
import { posevniPrerez } from "../src/exercises/napetosti/posevni.js";
import { deformacijeNapetosti } from "../src/exercises/napetosti/deformacije.js";
import { hookePalice, vpeta, cev } from "../src/exercises/napetosti/hooke.js";
import { hipoteze } from "../src/exercises/napetosti/hipoteze.js";

const near = (a, b, tol = 0.002) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const answer = (ex, key) => ex.answers.find((a) => a.key === key).value;
const rad = (d) => (d * Math.PI) / 180;
const many = (gen, n, fn) => {
  const r = rng(777);
  for (let i = 0; i < n; i++) {
    const p = gen.generate(r);
    fn(p, gen.build(p));
  }
};

/** Eigenvalues of a symmetric 2×2 (σx, σy, τ) by the characteristic polynomial. */
const eig2 = (a, b, c) => {
  const tr = a + b, det = a * b - c * c;
  const d = Math.sqrt(tr * tr / 4 - det);
  return [tr / 2 + d, tr / 2 - d];
};

test("mohr: exam 9.9.2016, σx = 20, σy = −40, τxy = −30 MPa", () => {
  const ex = mohr.build({ sx: 20, sy: -40, txy: -30, phi: 30 });
  near(answer(ex, "s1"), 32.426, 0.001);
  near(answer(ex, "s2"), -52.426, 0.001);
  near(answer(ex, "alpha"), -22.5);
  near(answer(ex, "tmax"), 42.426, 0.001);
});

test("mohr: σx = 50, σy = −10, τxy = 30 → C = 20, R = 42,43, α = 22,5°", () => {
  const ex = mohr.build({ sx: 50, sy: -10, txy: 30, phi: 45 });
  near(answer(ex, "s1"), 62.426, 0.001);
  near(answer(ex, "s2"), -22.426, 0.001);
  near(answer(ex, "alpha"), 22.5);
  // φ = 45°: σN = C + τxy = 50, τN = −(σx−σy)/2 = −30
  near(answer(ex, "sN"), 50);
  near(answer(ex, "tN"), -30);
});

test("mohr: σx < σy needs the 180° correction of 2α", () => {
  // σx = −40, σy = 20, τ = 30: X left of C and above → 2α = 135°, α = 67,5°
  const st = planeStress(-40, 20, 30);
  near(st.alpha, 67.5);
  near(st.sN(st.alpha), st.s1);
});

test("mohr: random tasks — σN(α) = σ1, τN(α) = 0, eigenvalues, circle", () => {
  many(mohr, 400, ({ sx, sy, txy, phi }, ex) => {
    const st = planeStress(sx, sy, txy);
    const a = answer(ex, "alpha");
    assert.ok(a > -90 && a <= 90);
    near(st.sN(a), answer(ex, "s1"));
    near(st.tN(a), 0, 1e-6);
    const [e1, e2] = eig2(sx, sy, txy);
    near(answer(ex, "s1"), e1);
    near(answer(ex, "s2"), e2);
    // σ_N, τ_N straight from the traction t = [σ]·n, n = (cos φ, sin φ)
    const n = [Math.cos(rad(phi)), Math.sin(rad(phi))], tv = [-n[1], n[0]];
    const t = [sx * n[0] + txy * n[1], txy * n[0] + sy * n[1]];
    near(answer(ex, "sN"), t[0] * n[0] + t[1] * n[1], 1e-6);
    near(answer(ex, "tN"), t[0] * tv[0] + t[1] * tv[1], 1e-6);
  });
});

test("mohr-inverzna: round trip through the forward formulas", () => {
  many(mohrInverzna, 400, (p, ex) => {
    const sx = answer(ex, "sx"), sy = answer(ex, "sy");
    const txy = p.kind === "kot" ? answer(ex, "txy") : p.txy;
    const st = planeStress(sx, sy, txy);
    near(st.s1, p.s1);
    near(st.s2, p.s2);
    if (p.kind === "kot") near(st.alpha, p.alpha);
    else {
      assert.ok(sx >= sy);
      near(st.alpha, answer(ex, "alpha"));
    }
  });
  // Hand check: σ1 = 100, σ2 = 20, α = 30° → σx = 80, σy = 40, τ = 34,64
  const ex = mohrInverzna.build({ kind: "kot", s1: 100, s2: 20, alpha: 30 });
  near(answer(ex, "sx"), 80);
  near(answer(ex, "sy"), 40);
  near(answer(ex, "txy"), 34.641);
});

test("posevni-prerez: exam 3×3 cm, F = 4,5 kN, β = 20°", () => {
  const ex = posevniPrerez.build({ kind: "napetosti", b: 3, h: 3, beta: 20, F: 4.5, tension: true });
  near(answer(ex, "sx"), 0.5);
  // The sheet writes σn = 0,0588; 0,5·sin²20° = 0,05849 (handwritten rounding).
  near(answer(ex, "sn"), 0.058489, 0.001);
  near(answer(ex, "tn"), 0.1607, 0.001);
});

test("posevni-prerez: exam 2×2 cm, F = 20 kN, glue at 30° to the axis", () => {
  const ex = posevniPrerez.build({ kind: "napetosti", b: 2, h: 2, beta: 30, F: 20, tension: true });
  near(answer(ex, "sx"), 5);
  near(answer(ex, "p"), 2.5);
  near(answer(ex, "sn"), 1.25);
  near(answer(ex, "tn"), 2.165, 0.001);
});

test("posevni-prerez: random tasks — p² = σn² + τn², F_max meets one limit exactly", () => {
  many(posevniPrerez, 400, (p, ex) => {
    const A = p.b * p.h, s = Math.sin(rad(p.beta)), c = Math.cos(rad(p.beta));
    if (p.kind === "napetosti") {
      near(answer(ex, "p") ** 2, answer(ex, "sn") ** 2 + answer(ex, "tn") ** 2);
      // Same as §8 with φ = 90° − β (normal of the plane from the axis)
      const st = planeStress(answer(ex, "sx"), 0, 0);
      near(answer(ex, "sn"), st.sN(90 - p.beta), 1e-6);
      near(answer(ex, "tn"), Math.abs(st.tN(90 - p.beta)), 1e-6);
    } else {
      const F = answer(ex, "Fmax");
      const sn = (F / A) * s * s, tn = (F / A) * s * c;
      assert.ok(sn <= p.sdop + 1e-9 && tn <= p.tdop + 1e-9);
      assert.ok(Math.abs(sn - p.sdop) < 1e-9 || Math.abs(tn - p.tdop) < 1e-9);
    }
  });
});

test("deformacije-napetosti: exam strain tensor [[1,−3,0],[−3,2,0],[0,0,0]]·10⁻⁴", () => {
  const ex = deformacijeNapetosti.build({ kind: "tenzor", ex: 1, ey: 2, ez: 0, exy: -3, E: 2.1e5, nu: 0.3 });
  near(answer(ex, "lam"), 121.15, 0.001);
  near(answer(ex, "sx"), 52.48, 0.001);
  near(answer(ex, "txy"), -48.46, 0.001);
  near(answer(ex, "s1"), 109.7, 0.001);
  near(answer(ex, "s2"), 36.35, 0.001); // σz (sheet: 36,33)
  near(answer(ex, "s3"), 11.43, 0.002);
});

test("deformacije-napetosti: random — stresses give back the strains (Hooke 3D)", () => {
  many(deformacijeNapetosti, 400, (p, ex) => {
    if (p.kind === "tenzor") {
      const { E, nu } = p;
      const G = E / (2 * (1 + nu));
      const lam = (E * nu) / ((1 + nu) * (1 - 2 * nu));
      const ev = (p.ex + p.ey + p.ez) * 1e-4;
      const sx = answer(ex, "sx"), sy = lam * ev + 2 * G * p.ey * 1e-4, sz = lam * ev + 2 * G * p.ez * 1e-4;
      near((sx - nu * (sy + sz)) / E, p.ex * 1e-4, 1e-9);
      near(answer(ex, "txy") / G, 2 * p.exy * 1e-4, 1e-9);
      const s = [answer(ex, "s1"), answer(ex, "s2"), answer(ex, "s3")];
      assert.ok(s[0] >= s[1] && s[1] >= s[2]);
      near(s[0] + s[1] + s[2], sx + sy + sz, 1e-6);
      // Each is an eigenvalue: det([σ] − s·I) = 0 (block form, σz on its own)
      const txy = answer(ex, "txy");
      for (const v of s) {
        const d = ((sx - v) * (sy - v) - txy * txy) * (sz - v);
        assert.ok(Math.abs(d) < 1e-6 * Math.max(1, Math.abs(sx) + Math.abs(sy) + Math.abs(sz)) ** 3, `${d}`);
      }
    } else {
      const [e1, e2] = eig2(p.ex, p.ey, p.g / 2);
      near(answer(ex, "e1"), e1);
      near(answer(ex, "e2"), e2);
      const st = planeStress(p.ex, p.ey, p.g / 2);
      near(st.sN(answer(ex, "alpha")), e1);
      near(answer(ex, "gmax"), e1 - e2);
    }
  });
});

test("hooke-palice: residuals of equilibrium and compatibility", () => {
  many(hookePalice, 400, (p, ex) => {
    if (p.kind === "stopnicasta") {
      near(answer(ex, "N1"), p.F1 + p.F2);
      near(answer(ex, "N2"), p.F2);
      const dL = (answer(ex, "N1") * p.L1 * 100) / (21000 * p.A1) + (answer(ex, "N2") * p.L2 * 100) / (21000 * p.A2);
      near(answer(ex, "dL"), dL * 10, 1e-9);
    } else if (p.kind === "vpeta") {
      const N1 = answer(ex, "N1"), N2 = answer(ex, "N2");
      near(-N1 + N2 + p.F, 0, 1e-9);
      const d1 = (N1 * p.L1 * 100) / (21000 * p.A1) + 1.2e-5 * p.dT * p.L1 * 100;
      const d2 = (N2 * p.L2 * 100) / (21000 * p.A2) + 1.2e-5 * p.dT * p.L2 * 100;
      near(d1 + d2, 0, 1e-9);
      near(answer(ex, "u"), d1 * 10, 1e-9);
      near(answer(ex, "s1"), (N1 / p.A1) * 10);
    } else {
      const Ns = answer(ex, "Ns"), Na = answer(ex, "Na"), L = p.L * 100;
      near(Ns + Na, -p.F, 1e-9);
      const ds = (Ns * L) / (21000 * p.As) + 1.2e-5 * p.dT * L;
      const da = (Na * L) / (7000 * p.Aa) + 2.3e-5 * p.dT * L;
      // Tube and rod end at the same plate: the rod, shorter by δ, closes the gap.
      near(da, ds - p.delta / 10, 1e-9);
      near(answer(ex, "dL"), da * 10, 1e-9);
      assert.ok(Ns <= 1e-9 || p.dT > 0);
    }
  });
});

test("hooke-palice: hand-checked cases", () => {
  // Equal parts, F = 10 kN in the middle of a clamped bar: halves 5 / −5.
  const v = vpeta({ A1: 4, A2: 4, L1: 1, L2: 1, F: 10, dT: 0 });
  near(v.N1, 5);
  near(v.N2, -5);
  // Heated clamped uniform bar: σ = −E α ΔT = −21000·1,2e−5·20 = −5,04 kN/cm².
  const t = vpeta({ A1: 5, A2: 5, L1: 1, L2: 1, F: 0, dT: 20 });
  near(t.N1 / 5, -5.04);
  near(t.u, 0, 1e-9);
  // Rod + tube, same length: the force splits by stiffness 21000·2 : 7000·6 = 1 : 1.
  const c = cev({ As: 2, Aa: 6, L: 1, F: 100, delta: 0, dT: 0 });
  near(c.Ns, -50);
  near(c.Na, -50);
});

test("hipoteze: Tresca and Mises against principal stresses", () => {
  many(hipoteze, 400, (p, ex) => {
    if (p.kind === "sigma-tau") {
      const [a, b] = eig2(p.sigma, 0, p.tau);
      const pr = [a, b, 0].sort((x, y) => y - x);
      near(answer(ex, "T"), pr[0] - pr[2]);
      near(answer(ex, "M"), Math.sqrt(((pr[0] - pr[1]) ** 2 + (pr[1] - pr[2]) ** 2 + (pr[2] - pr[0]) ** 2) / 2));
      near(answer(ex, "nT"), p.spl / answer(ex, "T"));
    } else if (p.kind === "ravninsko") {
      const [a, b] = eig2(p.sx, p.sy, p.txy);
      const pr = [a, b, 0].sort((x, y) => y - x);
      near(answer(ex, "T"), pr[0] - pr[2]);
      near(answer(ex, "M"), Math.sqrt(((pr[0] - pr[1]) ** 2 + (pr[1] - pr[2]) ** 2 + (pr[2] - pr[0]) ** 2) / 2));
    } else {
      near(Math.sqrt(p.sigma ** 2 + 4 * answer(ex, "tT") ** 2), p.sdop);
      near(Math.sqrt(p.sigma ** 2 + 3 * answer(ex, "tM") ** 2), p.sdop);
    }
  });
  // σ = 100, τ = 50: Tresca √(1e4 + 1e4) = 141,4; Mises √(1e4 + 7500) = 132,3
  const ex = hipoteze.build({ kind: "sigma-tau", sigma: 100, tau: 50, spl: 240 });
  near(answer(ex, "T"), 141.42, 0.001);
  near(answer(ex, "M"), 132.29, 0.001);
});

test("napetosti: every task has 2–6 answers, all finite, and a figure", () => {
  for (const gen of [mohr, mohrInverzna, posevniPrerez, deformacijeNapetosti, hookePalice, hipoteze]) {
    many(gen, 200, (p, ex) => {
      assert.ok(ex.answers.length >= 2 && ex.answers.length <= 6, gen.id);
      for (const a of ex.answers) assert.ok(Number.isFinite(a.value), `${gen.id} ${a.key}`);
      assert.equal(typeof ex.figure, "function");
      assert.ok(!ex.solution.join(" ").includes("NaN"), gen.id);
    });
  }
});

test("napetosti: draws stay realistic — Hooke below yield, glue joint stresses like the exams", () => {
  many(hookePalice, 600, (p, ex) => {
    const keys = p.kind === "cev" ? [["ss", 240], ["sa", 150]] : [["s1", 240], ["s2", 240]];
    for (const [k, lim] of keys) assert.ok(Math.abs(answer(ex, k)) <= lim + 1e-9, `${p.kind} ${k} = ${answer(ex, k)}`);
  });
  many(posevniPrerez, 600, (p, ex) => {
    if (p.kind === "napetosti") assert.ok(Math.abs(answer(ex, "sx")) >= 0.3 - 1e-9 && Math.abs(answer(ex, "sx")) <= 6 + 1e-9);
  });
});

test("napetosti: solution wording — strains check ε_N, Tresca with both principal stresses compressive", () => {
  const g = deformacijeNapetosti.build({ kind: "merjene", a: 200, ex: -5, ey: 2, g: 3 }).solution.join("\n");
  assert.ok(g.includes("ε_N(α)") && !g.includes("σ_N(α)"));
  // σx = −90, σy = −40, τ = 20: σ1 ≈ −32,4 < 0 → σ_ekv,Tresca = 0 − σ2 = 97,6
  const ex = hipoteze.build({ kind: "ravninsko", sx: -90, sy: -40, txy: 20, sdop: 140 });
  near(answer(ex, "T"), -answer(ex, "s2"));
  assert.ok(ex.solution.join("\n").includes("obe glavni napetosti sta tlačni"));
});

test("napetosti: near-zero scales stay tight — σ = N/A follows N's scale, no scale without cancellation", () => {
  const scaleOf = (ex, key) => ex.answers.find((a) => a.key === key).scale;
  // Clamped bar: σ scale = (scale of N)/A, so a small σ isn't graded against the other part's large σ.
  many(hookePalice, 600, (p, ex) => {
    if (p.kind === "vpeta" && !p.dT) {
      // No heating: N₁, N₂, σ, u are products (no cancellation), each graded to its own 5 %.
      for (const k of ["N1", "N2", "s1", "s2", "u"]) assert.equal(scaleOf(ex, k), undefined, k);
    } else if (p.kind === "vpeta") {
      const sN = scaleOf(ex, "N1");
      near(scaleOf(ex, "s1"), (sN / p.A1) * 10, 1e-9);
      near(scaleOf(ex, "s2"), (sN / p.A2) * 10, 1e-9);
    } else if (p.kind === "stopnicasta") {
      for (const k of ["N1", "N2", "s1", "s2"]) assert.equal(scaleOf(ex, k), undefined, k);
    }
  });
  // A1 = 18, A2 = 3, F = 90 kN, no heating: N2 = −3,6 kN must not accept −4,4 kN (N1 = 86,4).
  const v = hookePalice.build({ kind: "vpeta", A1: 18, A2: 3, L1: 0.5, L2: 2, F: 90, dT: 0 });
  near(answer(v, "N2"), -3.6);
  assert.equal(answerOk(-4.4, v.answers.find((a) => a.key === "N2")), false);
  // e.g. N1 = 5 kN, A1 = 15 cm², N2 = 60 kN on 3 cm²: σ1 = 3,333 MPa must not accept 2 MPa.
  const st = hookePalice.build({ kind: "stopnicasta", A1: 15, A2: 3, L1: 1, L2: 1, F1: -55, F2: 60 });
  assert.equal(answerOk(2, st.answers.find((a) => a.key === "s1")), false);
  // τxy = R·sin 2α and τxy = 2G·ε_xy are never about 0: own 5 %.
  assert.equal(scaleOf(mohrInverzna.build({ kind: "kot", s1: 120, s2: 90, alpha: 15 }), "txy"), undefined);
  assert.equal(scaleOf(deformacijeNapetosti.build({ kind: "tenzor", ex: 6, ey: 6, ez: 4, exy: 1, E: 2.1e5, nu: 0.3 }), "txy"), undefined);
});

test("hooke-palice: ΔL of the stepped bar and the heated bar's u don't nearly cancel", () => {
  many(hookePalice, 1500, (p, ex) => {
    const a = ex.answers.find((x) => x.key === (p.kind === "stopnicasta" ? "dL" : "u"));
    if (!a || a.scale === undefined) return;
    // the near-zero tolerance (3 % of the terms) stays within 20 % of the answer
    assert.ok(0.03 * a.scale <= 0.2 * Math.abs(a.value) + 1e-12, `${JSON.stringify(p)} ${a.key} = ${a.value}, scale ${a.scale}`);
  });
});

test("mohr: τ_max is the in-plane one (R); with σ1, σ2 of one sign the solution names the absolute one", () => {
  // σx = 40, σy = 50, τ = −30: σ1 = 75,41, σ2 = 14,59 → R = 30,41, but with σ3 = 0 the absolute τ is 37,71.
  const ex = mohr.build({ sx: 40, sy: 50, txy: -30, phi: 105 });
  near(answer(ex, "tmax"), 30.414, 0.001);
  assert.ok(ex.text.join(" ").includes("τ_{max} v ravnini x, y"));
  assert.ok(ex.solution.join("\n").includes("absolutno največja strižna napetost (σ_{max} − σ_{min})/2 = 37,71 MPa"));
  // σ1 > 0 > σ2: R is also the absolute maximum, no note.
  assert.ok(!mohr.build({ sx: 50, sy: -10, txy: 30, phi: 45 }).solution.join("\n").includes("absolutno"));
});
