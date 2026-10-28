// Prerezi in upogib: section properties against the worked exam answers and
// the course notes' examples, every part type against brute-force grid
// integration, and the bending exercises against the exams' numbers and
// against independent checks (sampled M, σ back-substituted).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rng } from "../src/exercises/kit.js";
import { SHAPES, sectionProps, staticMoment, widthAt, principal } from "../src/exercises/prerez/section.js";
import { prerezKarakteristike, makeSection } from "../src/exercises/prerez/karakteristike.js";
import { upogibNapetost, upogibDimenzioniranje, fibreStress, tubeW, bendSection } from "../src/exercises/prerez/upogib.js";
import { analyse } from "../src/exercises/prerez/beams.js";

const near = (a, b, tol = 0.002) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const answer = (ex, key) => ex.answers.find((a) => a.key === key).value;

test("exam T profile (flange 6×2 bottom, web 2×6): A = 24, y_T = 3, I_x = 136, I_y = 40", () => {
  const P = sectionProps(SHAPES.T(6, 2, 2, 6, true));
  near(P.A, 24);
  near(P.xT, 3);
  near(P.yT, 3);
  near(P.Ix, 136);
  near(P.Iy, 40);
  assert.equal(P.Ixy, 0);
  // Reference axes through the lower-right corner as in the old solution
  // (x_T = −3): the notes' I_xy = −∫xy dA gives +216; the old solution's
  // +ΣA·x·y gave −216 (same size, opposite sign). Steiner checks: 352, 256.
  const shifted = { parts: SHAPES.T(6, 2, 2, 6, true).parts.map((p) => ({ ...p, x: p.x - 6 })) };
  const Q = sectionProps(shifted);
  near(Q.xT, -3);
  near(Q.IxyO, 216);
  near(Q.IxO, 352);
  near(Q.IyO, 256);
  near(Q.IxO + Q.IyO, 608);
  const ex = prerezKarakteristike.build({ shape: "Tflip", a: [6, 2, 2, 6] });
  near(answer(ex, "A"), 24);
  near(answer(ex, "yT"), 3);
  near(answer(ex, "Ix"), 136);
  near(answer(ex, "Iy"), 40);
  near(answer(ex, "IxyO"), -216); // O at the lower-left corner: x_T = +3
});

test("notes §7 examples: Z section (R1) and rectangle with a rectangular hole (R2)", () => {
  // R1 (mm): bottom flange 30×10, web 3×15 at its right end, top flange 25×5 (A = 470).
  const Z = sectionProps({ parts: [{ t: "rect", x: 0, y: 0, w: 30, h: 10 }, { t: "rect", x: 27, y: 10, w: 3, h: 15 }, { t: "rect", x: 27, y: 25, w: 25, h: 5 }] });
  near(Z.A, 470);
  near(Z.xT, 22.80851);
  near(Z.yT, 12.18085);
  near(Z.Ix, 49681.29);
  near(Z.Iy, 83619.43);
  near(Z.Ixy, -50146.3);
  near(Z.alpha, 35.6523);
  // The notes call the moment about the α_G axis I_1 (here the smaller one).
  near(Z.Iu((Z.alpha * Math.PI) / 180), 13710.79);
  near(Z.I1, 119589.94);
  near(Z.I2, 13710.79);
  assert.equal(Z.alphaIsMax, false);

  const R2 = sectionProps({ parts: [{ t: "rect", x: 0, y: 0, w: 80, h: 60 }, { t: "rect", x: 40, y: 35, w: 30, h: 20, hole: true }] });
  near(R2.Ixy, 154285.714);
  near(R2.alpha, -7.86893);
  near(R2.I2, 1244390.65);
  near(R2.I1, 2382037.92);
});

test("notes R3: L shape with a round hole (t = 1): I_x = 82.94, I_y = 52.04, I_xy = 24.66, α = 28.96°", () => {
  // Read from the notes' figure: an upright leg 1 wide and 8 tall on the
  // left; a base 5 wide and 4 tall; a Ø2 hole with its centre at (3, 2).
  const P = sectionProps({
    parts: [
      { t: "rect", x: 0, y: 0, w: 5, h: 4 },
      { t: "rect", x: 0, y: 4, w: 1, h: 4 },
      { t: "circle", cx: 3, cy: 2, r: 1, hole: true },
    ],
  });
  near(P.A, 24 - Math.PI);
  near(P.Ix, 82.9414);
  near(P.Iy, 52.0377);
  near(P.Ixy, 24.6585);
  near(P.alpha, 28.9637);
  near(P.I1, 96.5893);
  near(P.I2, 38.3897);
});

// ---- brute force: integrate on a fine grid, point-in-part tests
function inside(p, x, y) {
  if (p.t === "rect") return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
  const dx = x - (p.cx ?? 0), dy = y - (p.cy ?? 0);
  if (p.t === "circle") return dx * dx + dy * dy <= p.r * p.r;
  if (p.t === "semi") {
    if (dx * dx + dy * dy > p.r * p.r) return false;
    const u = [Math.round(Math.cos((p.dir * Math.PI) / 180)), Math.round(Math.sin((p.dir * Math.PI) / 180))];
    return dx * u[0] + dy * u[1] >= 0;
  }
  if (p.t === "quarter") return dx * dx + dy * dy <= p.r * p.r && dx * p.sx >= 0 && dy * p.sy >= 0;
  if (p.t === "tri") {
    const s = (x - p.x) / p.b, t = (y - p.y) / p.h;
    return s >= 0 && t >= 0 && s + t <= 1;
  }
}
function grid(sec, n = 700) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of sec.parts) {
    const b = p.t === "rect" ? [p.x, p.x + p.w, p.y, p.y + p.h] : p.t === "tri" ? [Math.min(p.x, p.x + p.b), Math.max(p.x, p.x + p.b), Math.min(p.y, p.y + p.h), Math.max(p.y, p.y + p.h)] : [p.cx - p.r, p.cx + p.r, p.cy - p.r, p.cy + p.r];
    x0 = Math.min(x0, b[0]); x1 = Math.max(x1, b[1]); y0 = Math.min(y0, b[2]); y1 = Math.max(y1, b[3]);
  }
  const hx = (x1 - x0) / n, hy = (y1 - y0) / n, dA = hx * hy;
  let A = 0, Sx = 0, Sy = 0, Ixx = 0, Iyy = 0, Ixy = 0;
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * hx;
    for (let j = 0; j < n; j++) {
      const y = y0 + (j + 0.5) * hy;
      let w = 0;
      for (const p of sec.parts) if (inside(p, x, y)) w += p.hole ? -1 : 1;
      if (!w) continue;
      A += w * dA; Sx += w * y * dA; Sy += w * x * dA;
      Ixx += w * y * y * dA; Iyy += w * x * x * dA; Ixy += w * x * y * dA;
    }
  }
  const xT = Sy / A, yT = Sx / A;
  return { A, xT, yT, Ix: Ixx - A * yT * yT, Iy: Iyy - A * xT * xT, Ixy: -(Ixy - A * xT * yT) };
}

test("every part type and sign against grid integration", () => {
  const sections = [
    { parts: [{ t: "rect", x: 0, y: 0, w: 10, h: 8 }, { t: "tri", x: 0, y: 8, b: 6, h: 5 }] },
    { parts: [{ t: "rect", x: 0, y: 0, w: 10, h: 8 }, { t: "tri", x: 10, y: 0, b: -4, h: -3 }] },
    { parts: [{ t: "rect", x: 0, y: 0, w: 10, h: 8 }, { t: "quarter", cx: 10, cy: 8, r: 4, sx: -1, sy: -1, hole: true }] },
    { parts: [{ t: "rect", x: 0, y: 0, w: 8, h: 8 }, { t: "quarter", cx: 8, cy: 0, r: 5, sx: 1, sy: 1 }] },
    { parts: [{ t: "rect", x: 0, y: 0, w: 8, h: 6 }, { t: "semi", cx: 8, cy: 3, r: 3, dir: 0 }, { t: "semi", cx: 4, cy: 0, r: 2, dir: 90, hole: true }] },
    { parts: [{ t: "rect", x: 0, y: 0, w: 12, h: 9 }, { t: "circle", cx: 8, cy: 3, r: 2, hole: true }] },
    SHAPES.L(12, 8, 2),
    SHAPES.Z(14, 7, 9, 2),
    SHAPES.rectTri(10, 5, 4, 6),
    SHAPES.rectSemi(8, 5),
  ];
  for (const sec of sections) {
    const P = sectionProps(sec);
    const G = grid(sec);
    const sc = Math.max(P.Ix, P.Iy);
    assert.ok(Math.abs(P.A - G.A) < 0.003 * P.A, `A ${P.A} vs ${G.A}`);
    assert.ok(Math.abs(P.xT - G.xT) < 0.01 && Math.abs(P.yT - G.yT) < 0.01, "centroid");
    for (const k of ["Ix", "Iy", "Ixy"]) assert.ok(Math.abs(P[k] - G[k]) < 0.004 * sc, `${k}: ${P[k]} vs ${G[k]}`);
  }
});

test("static moment S*: zero at the centroid split, b·h²/8 for a rectangle, width b(y)", () => {
  const P = sectionProps(SHAPES.rect(10, 20));
  near(staticMoment(SHAPES.rect(10, 20), P.yT), (10 * 400) / 8);
  for (const sec of [SHAPES.T(8, 2, 2, 8), SHAPES.tube(10, 1), SHAPES.notchedI(12, 12, 4, 4), SHAPES.rectSemi(6, 4)]) {
    const Q = sectionProps(sec);
    assert.ok(Math.abs(staticMoment(sec, Q.ymin - 1)) < 1e-3 * Q.A * (Q.ymax - Q.ymin), "S* of the whole section = 0");
  }
  // T: S* at the neutral axis = web below it: 2·6,5·6,5/2 = 42,25.
  near(staticMoment(SHAPES.T(8, 2, 2, 8), 6.5), 42.25, 0.001);
  near(widthAt(SHAPES.notchedI(12, 12, 4, 4), 6), 4);
  near(widthAt(SHAPES.notchedI(12, 12, 4, 4), 2), 12);
});

test("principal(): the notes' formulas", () => {
  const p = principal(100, 40, 40);
  near(p.I1 + p.I2, 140);
  near(p.I1, 70 + 50);
  near(p.alpha, (0.5 * Math.atan(80 / 60) * 180) / Math.PI);
  assert.equal(p.alphaIsMax, true);
});

test("bending stress, exam vectors (σ in kN/cm²)", () => {
  let P = sectionProps(SHAPES.notchedI(12, 12, 4, 4));
  near(P.Ix, 1685.33);
  near(fibreStress(P, 1).bot, 0.356, 0.003);

  P = sectionProps(SHAPES.T(8, 2, 2, 8)); // flange on top
  near(P.Ix, 290.67);
  near(P.yT, 6.5); // 1,5 cm above mid-height
  const s = fibreStress(P, -1.8);
  near(s.top, 2.167);
  near(s.bot, -4.025);

  P = sectionProps(SHAPES.rect(10, 20));
  near(P.Wtop, 666.67);
  near(fibreStress(P, 2).bot, 0.3);

  P = sectionProps(SHAPES.Hrot(5, 15, 25, 5));
  near(P.Ix, 3072.9);
  near(Math.abs(fibreStress(P, -10).top), 2.44, 0.003);

  P = sectionProps(SHAPES.hollowRect(15, 25, 10, 20));
  near(P.Ix, 12864.6);
  near(P.Wtop, 1029.2);
  near(Math.abs(fibreStress(P, 12).top), 1.166);
});

test("upogib-napetost: exam beams through the solver", () => {
  // T post as a cantilever: M = −1,8 kNm at the wall.
  let ex = upogibNapetost.build({ beam: { kind: "cantilever", L: 1, clamp: "left", loads: [{ t: "F", x: 1, F: 1.8 }] }, shape: "T", a: [8, 2, 2, 8] });
  near(answer(ex, "M"), -1.8);
  near(answer(ex, "x"), 0);
  near(answer(ex, "I"), 290.67);
  near(answer(ex, "yT"), 6.5);
  near(answer(ex, "st"), 21.67);
  near(answer(ex, "sb"), -40.25);

  // Overhang: span 2,5 m with q = 16, F = 10 kN at the end of a 1 m overhang: M = −10 / +8.
  const beam = { kind: "overhang", s: 2.5, L: 3.5, loads: [{ t: "q", x1: 0, x2: 2.5, q: 16 }, { t: "F", x: 3.5, F: 10 }] };
  const an = analyse(beam);
  near(an.crit.value, -10);
  near(an.crit.x, 2.5);
  near(an.pos.value, 8);
  near(an.pos.x, 1);
  ex = upogibNapetost.build({ beam, shape: "Hrot", a: [5, 15, 25, 5] });
  near(answer(ex, "I"), 3072.9);
  near(answer(ex, "st"), 24.4, 0.003);
  near(answer(ex, "sb"), -24.4, 0.003);

  // Simply supported 3 m, couple 12 kNm at A; hollow rectangle.
  ex = upogibNapetost.build({ beam: { kind: "simple", L: 3, s: 3, loads: [{ t: "M", x: 0, M: 12 }] }, shape: "hollowRect", a: [15, 25, 10, 20] });
  near(Math.abs(answer(ex, "M")), 12);
  near(answer(ex, "x"), 0);
  near(answer(ex, "W"), 1029.2);
  near(Math.abs(answer(ex, "st")), 11.66);

  // 10 × 20 beam, M = 2 kNm (F = 2 kN at the middle of a 4 m span).
  ex = upogibNapetost.build({ beam: { kind: "simple", L: 4, s: 4, loads: [{ t: "F", x: 2, F: 2 }] }, shape: "rect", a: [10, 20] });
  near(answer(ex, "M"), 2);
  near(answer(ex, "W"), 666.67);
  near(answer(ex, "sb"), 3);
  near(answer(ex, "st"), -3);
});

test("upogib-dimenzioniranje: timber overhang x = 4,31 cm; tube D 68 × 3 F_max", () => {
  let ex = upogibDimenzioniranje.build({ variant: "rect", beam: { kind: "overhang", s: 3, L: 5, loads: [{ t: "q", x1: 3, x2: 5, q: 5 }] }, k: [3, 5], sdop: 1, unit: "kN/cm²" });
  near(answer(ex, "M"), 10);
  near(answer(ex, "W"), 1000);
  near(answer(ex, "x"), 4.309, 0.001);

  ex = upogibDimenzioniranje.build({ variant: "Fmax", beam: { kind: "cantilever", L: 2.5, clamp: "left", loads: [{ t: "F", x: 2.5, F: 1, name: "F" }] }, shape: "tube", a: [68, 3], sdop: 160 });
  near(answer(ex, "W"), 9.536); // π(68⁴ − 62⁴)/(32·68) mm³
  near(answer(ex, "Mdop"), 1.5258);
  near(answer(ex, "F"), 610.3); // N
});

test("random sections: properties against the grid, I_1 + I_2 = I_x + I_y", () => {
  const r = rng(7);
  for (let i = 0; i < 25; i++) {
    const p = prerezKarakteristike.generate(r);
    const sec = makeSection(p);
    const P = sectionProps(sec);
    const G = grid(sec, 900);
    const sc = Math.max(P.Ix, P.Iy);
    for (const k of ["A", "xT", "yT"]) assert.ok(Math.abs(P[k] - G[k]) < 0.01 * Math.max(1, Math.abs(P[k])), `${p.shape} ${k}: ${P[k]} vs ${G[k]} ${JSON.stringify(p)}`);
    for (const k of ["Ix", "Iy", "Ixy"]) assert.ok(Math.abs(P[k] - G[k]) < 0.01 * sc, `${p.shape} ${k}: ${P[k]} vs ${G[k]}`);
    near(P.I1 + P.I2, P.Ix + P.Iy, 1e-9);
    const Iu = P.Iu((P.alpha * Math.PI) / 180);
    near(Iu, P.alphaIsMax ? P.I1 : P.I2, 1e-9);
  }
});

test("upogib-napetost, random: M_max = sampled max |M|, stresses linear over the depth", () => {
  const r = rng(99);
  for (let i = 0; i < 150; i++) {
    const p = upogibNapetost.generate(r);
    const ex = upogibNapetost.build(p);
    const { sol } = analyse(p.beam);
    let m = 0;
    for (let k = 0; k <= 4000; k++) m = Math.max(m, Math.abs(sol.M((p.beam.L * k) / 4000)));
    const M = answer(ex, "M");
    assert.ok(Math.abs(Math.abs(M) - m) < 1e-3 * m + 1e-9 || Math.abs(M) > m, `M ${M} vs sampled ${m}`);
    assert.ok(Math.abs(Math.abs(M) - m) < 0.02 * m, `M ${M} vs sampled ${m}`);
    const P = sectionProps(bendSection(p));
    // σ_top/e_top = −σ_bot/e_bot (linear, zero at the centroid); M > 0 → bottom in tension.
    near(answer(ex, "st") / P.eTop, -answer(ex, "sb") / P.eBot, 1e-9);
    assert.ok(Math.sign(answer(ex, "sb")) === Math.sign(M));
  }
});

test("upogib-dimenzioniranje, random: the answer meets σ_dop exactly", () => {
  const r = rng(5);
  for (let i = 0; i < 150; i++) {
    const p = upogibDimenzioniranje.generate(r);
    const ex = upogibDimenzioniranje.build(p);
    if (p.variant === "rect") {
      const x = answer(ex, "x");
      const W = (p.k[0] * x * (p.k[1] * x) ** 2) / 6;
      const s = p.unit === "MPa" ? p.sdop / 10 : p.sdop;
      near((answer(ex, "M") * 100) / W, s, 1e-6);
    } else if (p.variant === "tube") {
      near(tubeW(answer(ex, "D"), p.t), (answer(ex, "M") * 1e6) / p.sdop, 1e-6);
    } else {
      const F = answer(ex, "F") / (ex.answers.at(-1).unit === "N" ? 1000 : 1);
      const m = Math.abs(analyse(p.beam).crit.value);
      near((F * m * 100) / answer(ex, "W"), p.sdop / 10, 1e-6);
    }
  }
});
