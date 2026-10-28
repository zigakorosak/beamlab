// Deformacije → napetosti (notes §9–10, snov.md §6–7):
//   tenzor    a strain tensor (ε_x, ε_y, ε_z, ε_xy; ε_xz = ε_yz = 0), E, ν →
//             Lamé λ, G, ε_V, the stresses by Lamé's equations
//             σ_i = λ·ε_V + 2G·ε_i, τ_xy = 2G·ε_xy, and the principal
//             stresses σ1 ≥ σ2 ≥ σ3 (σz is one of them since ε_xz = ε_yz = 0).
//             Exam: [[1, −3, 0], [−3, 2, 0], [0, 0, 0]]·10⁻⁴, E = 2,1·10⁵ MPa,
//             ν = 0,3 → σ1 = 109,7, σ2 = 36,33, σ3 = 11,43 MPa.
//   merjene   a square element whose sides lengthen by Δa_x, Δa_y and whose
//             right angle shrinks by γ → ε_x, ε_y, ε_xy = γ/2 → principal
//             strains, their direction and γ_max (same formulas as stresses).

import { ans, nearZero, angleAns, num } from "../kit.js";
import { svgText } from "../draw.js";
import { s } from "../../render/svg.js";
import { alphaSteps, par, planeStress } from "./element.js";

const MATERIALS = [
  { E: 2.1e5, nu: 0.3 },
  { E: 2.1e5, nu: 0.3 },
  { E: 2.0e5, nu: 0.3 },
  { E: 2.1e5, nu: 0.25 },
  { E: 0.7e5, nu: 0.3 },
];
const U4 = "·10⁻⁴";
const e5 = (v) => `${num(v / 1e5)}·10^5`;

/** [ε] = [ … ]·10⁻⁴ drawn as a matrix, at a fixed size in px. */
function matrixFigure(f, rows) {
  f.custom([[0, 0], [3, 1]], (T) => {
    const g = s("g");
    const cx = (T.X(0) + T.X(3)) / 2, cy = (T.Y(0) + T.Y(1)) / 2;
    const dx = 46, dy = 30; // column and row spacing
    const opt = { class: "fig-label", "text-anchor": "middle", "font-size": "15" };
    const bl = cx - 1.5 * dx - 4, br = cx + 1.5 * dx + 4;
    const top = cy - 1.5 * dy - 2, bot = cy + 1.5 * dy + 2;
    g.append(svgText(bl - 32, cy + 5, "[ε] =", opt));
    g.append(s("polyline.fig-rope", { points: `${bl + 7},${top} ${bl},${top} ${bl},${bot} ${bl + 7},${bot}` }));
    g.append(s("polyline.fig-rope", { points: `${br - 7},${top} ${br},${top} ${br},${bot} ${br - 7},${bot}` }));
    rows.forEach((row, i) => row.forEach((v, j) => g.append(svgText(cx + (j - 1) * dx, cy + (i - 1) * dy + 5, num(v), opt))));
    g.append(svgText(br + 6, cy + 5, "·10^{−4}", { ...opt, "text-anchor": "start" }));
    return g;
  });
}

export const deformacijeNapetosti = {
  id: "deformacije-napetosti",
  group: "trdnost",
  title: "Deformacije in napetosti (Hooke)",
  desc: "Tenzor deformacij → λ, G, napetosti in glavne napetosti; ali merjene deformacije → glavne deformacije",

  generate(r) {
    for (;;) {
      if (r.chance(0.6)) {
        const ex = r.int(-4, 6), ey = r.int(-4, 6), exy = r.int(-4, 4);
        const ez = r.chance(0.6) ? 0 : r.int(-3, 4);
        if (exy === 0 || (ex === 0 && ey === 0)) continue;
        return { kind: "tenzor", ex, ey, ez, exy, ...r.pick(MATERIALS) };
      }
      const a = r.pick([50, 100, 100, 200]);
      const ex = r.int(-5, 6), ey = r.int(-5, 6), g = r.int(-6, 6);
      if (g === 0) continue;
      const st = planeStress(ex, ey, g / 2);
      if (Math.abs(st.alpha) > 84 || st.R < 1.5) continue;
      return { kind: "merjene", a, ex, ey, g };
    }
  },

  build(p) {
    return p.kind === "tenzor" ? tensorTask.call(this, p) : gaugeTask.call(this, p);
  },
};

function tensorTask({ ex, ey, ez, exy, E, nu }) {
  const k = 1e-4;
  const lam = (E * nu) / ((1 + nu) * (1 - 2 * nu));
  const G = E / (2 * (1 + nu));
  const ev = (ex + ey + ez) * k;
  const sx = lam * ev + 2 * G * ex * k;
  const sy = lam * ev + 2 * G * ey * k;
  const sz = lam * ev + 2 * G * ez * k;
  const txy = 2 * G * exy * k;
  const st = planeStress(sx, sy, txy);
  const [s1, s2, s3] = [st.s1, st.s2, sz].sort((a, b) => b - a);
  const rows = [[ex, exy, 0], [exy, ey, 0], [0, 0, ez]];
  return {
    title: deformacijeNapetosti.title,
    text: [
      `V točki telesa poznamo tenzor deformacij (na sliki; izvendiagonalni členi so tenzorske strižne deformacije ε_{ij} = γ_{ij}/2). Material je linearno elastičen z E = ${e5(E)} MPa in ν = ${num(nu)}.`,
      "Izračunajte Lamejevi konstanti λ in G, volumsko deformacijo ε_V, komponente tenzorja napetosti (σ_x, σ_y, σ_z, τ_{xy}) in glavne napetosti σ_1 ≥ σ_2 ≥ σ_3. V okenca vpišite λ (v GPa), σ_x, τ_{xy} in glavne napetosti (v MPa).",
    ],
    figure(f) {
      matrixFigure(f, rows);
    },
    answers: nearZero(
      [
        ans("lam", "λ", "GPa", lam / 1000),
        ans("sx", "σ_x", "MPa", sx),
        ans("txy", "τ_{xy}", "MPa", txy),
        ans("s1", "σ_1", "MPa", s1),
        ans("s2", "σ_2", "MPa", s2),
        ans("s3", "σ_3", "MPa", s3),
      ],
      ["sx", "s1", "s2", "s3"],
    ),
    solution: [
      `λ = Eν/((1 + ν)(1 − 2ν)) = ${num(E)}·${num(nu)}/(${num(1 + nu)}·${num(1 - 2 * nu)}) = ${num(lam)} MPa = ${num(lam / 1000)} GPa`,
      `G = E/(2(1 + ν)) = ${num(G)} MPa`,
      `ε_V = ε_x + ε_y + ε_z = (${num(ex)} + ${par(ey)} + ${par(ez)})·10^{−4} = ${num(ex + ey + ez)}·10^{−4}`,
      `Lamejeve enačbe: σ_x = λε_V + 2Gε_x = ${num(lam * ev)} + ${par(2 * G * ex * k)} = ${num(sx)} MPa`,
      `σ_y = λε_V + 2Gε_y = ${num(sy)} MPa, σ_z = λε_V + 2Gε_z = ${num(sz)} MPa`,
      `τ_{xy} = 2G·ε_{xy} = G·γ_{xy} = ${num(G)}·${par(2 * exy)}·10^{−4} = ${num(txy)} MPa (τ_{xz} = τ_{yz} = 0)`,
      `Ker sta τ_{xz} = τ_{yz} = 0, je σ_z = ${num(sz)} MPa ena od glavnih napetosti. Drugi dve iz ravnine x, y:`,
      `C = (σ_x + σ_y)/2 = ${num(st.C)}, R = √(((σ_x − σ_y)/2)² + τ_{xy}²) = ${num(st.R)} MPa → C ± R = ${num(st.s1)} MPa in ${num(st.s2)} MPa.`,
      `Urejeno: σ_1 = ${num(s1)} MPa, σ_2 = ${num(s2)} MPa, σ_3 = ${num(s3)} MPa.`,
      `Kontrola: σ_1 + σ_2 + σ_3 = ${num(s1 + s2 + s3)} = σ_x + σ_y + σ_z = (3λ + 2G)·ε_V = ${num((3 * lam + 2 * G) * ev)} MPa ✓`,
    ],
  };
}

function gaugeTask({ a, ex, ey, g }) {
  // Changes of length in mm: ε·a.
  const dax = ex * 1e-4 * a, day = ey * 1e-4 * a;
  const exy = g / 2;
  const st = planeStress(ex, ey, exy); // in units of 10⁻⁴
  const gmax = st.s1 - st.s2;
  const len = (v) => `${v > 0 ? "podaljša" : v < 0 ? "skrajša" : "ne spremeni"}${v ? ` za ${num(Math.abs(v))} mm` : ""}`;
  return {
    title: deformacijeNapetosti.title,
    text: [
      `Kvadratni element s stranico a = ${a} mm ima robova vzporedna z osema x in y. Po obremenitvi se rob v smeri x ${len(dax)}, rob v smeri y ${len(day)}, pravi kot med robovoma pa se ${g > 0 ? "zmanjša" : "poveča"} za ${num(Math.abs(g))}·10^{−4} rad. Deformacija je homogena (na sliki črtkano, močno povečano).`,
      "Izračunajte glavni deformaciji ε_1 ≥ ε_2, kot α med osjo x in smerjo ε_1 (od osi x v nasprotni smeri urinega kazalca, −90° < α ≤ 90°) in največjo spremembo pravega kota γ_{max}.",
    ],
    figure(f) {
      const m = Math.max(Math.abs(ex), Math.abs(ey), Math.abs(g) / 2);
      const k = 0.14 / m; // exaggerate
      const B = [1 + ex * k, (g / 2) * k], Cc = [(g / 2) * k, 1 + ey * k];
      f.rect(0, 0, 1, 1);
      f.polygon([[0, 0], B, [B[0] + Cc[0], B[1] + Cc[1]], Cc], "fig-dashed");
      f.force([1.2, 0], 0, { tail: true, len: 30, cls: "fig-axis" });
      f.force([0, 1.2], 90, { tail: true, len: 30, cls: "fig-axis" });
      f.label([1.2, 0], "x", { dx: 36, dy: 4, anchor: "start", cls: "fig-name" });
      f.label([0, 1.2], "y", { dx: -6, dy: -30, anchor: "end", cls: "fig-name" });
      f.point([0, 0], "A", { dx: -8, dy: 14, anchor: "end" });
      f.dim([0, 0], [1, 0], `a = ${a} mm`, 30);
      f.label([1.18, 0.5], `Δa_x = ${num(dax)} mm`, { anchor: "start", dx: 6 });
      f.label([0.5, 1.18], `Δa_y = ${num(day)} mm`, { dy: -10 });
      f.bounds([[-0.1, -0.1], [1.3, 1.3]]);
    },
    answers: nearZero(
      [
        ans("e1", "ε_1", U4, st.s1),
        ans("e2", "ε_2", U4, st.s2),
        angleAns("alpha", "α", st.alpha, { period: 180, note: "smer ε₁ od osi x, −90° < α ≤ 90°" }),
        ans("gmax", "γ_{max}", U4, gmax),
      ],
      ["e1", "e2"],
    ),
    solution: [
      `ε_x = Δa_x/a = ${num(dax)}/${a} = ${num(ex)}·10^{−4}, ε_y = Δa_y/a = ${num(ey)}·10^{−4}`,
      `γ_{xy} = ${num(g)}·10^{−4} rad (zmanjšanje pravega kota je pozitivno), ε_{xy} = γ_{xy}/2 = ${num(exy)}·10^{−4}`,
      `(ε_x + ε_y)/2 = ${num(st.C)}·10^{−4}, R = √(((ε_x − ε_y)/2)² + ε_{xy}²) = ${num(st.R)}·10^{−4}`,
      `ε_1 = ${num(st.C)} + ${num(st.R)} = ${num(st.s1)}·10^{−4}, ε_2 = ${num(st.C)} − ${num(st.R)} = ${num(st.s2)}·10^{−4}`,
      ...alphaSteps(ex, ey, exy, { names: ["ε_x", "ε_y", "ε_{xy}"], unit: "·10^{−4}", sigma: "ε_1", normal: "ε_N" }),
      `Največja strižna deformacija: ε_T^{max} = (ε_1 − ε_2)/2 = ${num(st.R)}·10^{−4} pri α ± 45°, sprememba pravega kota γ_{max} = 2ε_T^{max} = ε_1 − ε_2 = ${num(gmax)}·10^{−4} rad.`,
    ],
  };
}
