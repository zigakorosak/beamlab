// Geometrijske karakteristike prerezov: centroid, centroidal moments of
// inertia, the product (deviation) moment and the principal axes of a
// composite section — the "prerez" part of the strength problem.
//
//   Symmetric sections (T, ⊥, I with unequal flanges, I as a notched
//   rectangle, U, C, rectangle with a half disc): A, x_T, y_T, I_x, I_y
//   and I_xy about the reference axes through O (old exam, T profile).
//   Non-symmetric (L, Z, rectangle with an off-centre hole or with a
//   triangle): I_x, I_y, I_xy and the principal I_1, I_2, α_G.
//
// Convention of the notes (vse_enacbe_in_postopki.md §7): I_xy = −∫xy dA,
// tan 2α_G = 2·I_xy / (I_x − I_y), α_G counterclockwise from x.

import { ans, angleAns, num } from "../kit.js";
import { SHAPES, bbox, drawSection, sectionProps } from "./section.js";
import { sectionLines } from "./steps.js";

const SYM = ["T", "Tflip", "Iun", "notchedI", "U", "C", "rectSemi"];
const NONSYM = ["L", "Z", "rectHole", "rectTri"];

/** params → section (plain JSON params, so tests can feed exam numbers). */
export function makeSection({ shape, a }) {
  if (shape === "Tflip") return SHAPES.T(...a, true);
  if (shape === "Iun") return SHAPES.I(...a);
  return SHAPES[shape](...a);
}

function randomShape(r, shape) {
  const i = (lo, hi) => r.int(lo, hi);
  switch (shape) {
    case "T":
    case "Tflip": {
      const tw = i(1, 4);
      return [tw + 2 * i(1, 6), i(1, 4), tw, i(4, 14)];
    }
    case "Iun": {
      const tw = i(1, 3);
      const bt = tw + 2 * i(1, 6);
      let bb = tw + 2 * i(1, 7);
      if (bb === bt) bb += 2;
      return [bt, i(1, 4), tw, i(4, 14), bb, i(1, 4)];
    }
    case "notchedI": {
      const n = i(2, 5), w = i(2, 5), hn = i(3, 10), t = i(2, 5);
      return [2 * n + w, hn + 2 * t, n, hn];
    }
    case "U": {
      const tw = i(1, 3);
      return [2 * tw + i(2, 12), i(1, 4), tw, i(3, 12)];
    }
    case "C": {
      const tf = i(1, 3);
      return [2 * tf + i(4, 16), i(1, 4), i(4, 10), tf];
    }
    case "rectSemi":
      return [2 * i(2, 6), i(3, 12)];
    case "L": {
      const t = i(1, 3);
      let a = t + i(4, 14), b = t + i(3, 12);
      if (a === b) a += 2;
      return [a, b, t];
    }
    case "Z": {
      const t = i(1, 3);
      return [2 * t + i(4, 14), t + i(3, 10), t + i(3, 10), t];
    }
    case "rectHole": {
      const b = i(8, 20), h = i(8, 20), d = 2 * i(1, 3);
      const cx = i(d / 2 + 1, b - d / 2 - 1), cy = i(d / 2 + 1, h - d / 2 - 1);
      return [b, h, d, cx, cy];
    }
    case "rectTri": {
      const b = i(6, 16);
      return [b, i(2, 8), i(2, Math.min(8, b - 2)), i(3, 9)];
    }
  }
}

export const prerezKarakteristike = {
  id: "prerez-karakteristike",
  group: "trdnost",
  title: "Geometrijske karakteristike prereza",
  desc: "Težišče, I_x, I_y, I_xy (Steiner) in glavni vztrajnostni momenti",

  generate(r) {
    for (;;) {
      const sym = r.chance(0.5);
      const shape = r.pick(sym ? SYM : NONSYM);
      const p = { shape, a: randomShape(r, shape) };
      const P = sectionProps(makeSection(p));
      if (!(P.A > 0)) continue;
      if (!sym) {
        // A clear principal direction, away from the ±45° ends of the range.
        if (Math.abs(P.alpha) > 40 || Math.abs(P.Ixy) < 0.04 * P.I1 || P.I1 - P.I2 < 0.1 * P.I1) continue;
        if (shape === "rectHole" && (Math.abs(P.xT - p.a[0] / 2) < 0.05 || Math.abs(P.yT - p.a[1] / 2) < 0.05)) continue;
      }
      return p;
    }
  },

  build(params) {
    const sec = makeSection(params);
    const P = sectionProps(sec);
    const sym = SYM.includes(params.shape);
    const text = sym
      ? [
          `Za prerez na sliki (mere v cm) določite ploščino A in lego težišča T (x_T, y_T) glede na točko O.`,
          "Izračunajte vztrajnostna momenta I_x in I_y glede na težiščni osi ter deviacijski moment I_{xy} glede na osi x, y skozi točko O. Uporabite dogovor iz zapiskov: I_{xy} = −∫xy dA.",
        ]
      : [
          "Za nesimetrični prerez na sliki (mere v cm) določite vztrajnostna momenta I_x, I_y in deviacijski moment I_{xy} glede na težiščni osi, vzporedni z osema x in y (I_{xy} = −∫xy dA).",
          "Določite glavna vztrajnostna momenta I_1 ≥ I_2 in kot α_G, za katerega velja tan 2α_G = 2I_{xy}/(I_x − I_y) (−45° < α_G ≤ 45°, v nasprotni smeri urinega kazalca od osi x).",
        ];
    const answers = sym
      ? [
          ans("A", "A", "cm²", P.A),
          ans("xT", "x_T", "cm", P.xT),
          ans("yT", "y_T", "cm", P.yT),
          ans("Ix", "I_x", "cm⁴", P.Ix, { note: "težiščna os" }),
          ans("Iy", "I_y", "cm⁴", P.Iy, { note: "težiščna os" }),
          ans("IxyO", "I_{xy}", "cm⁴", P.IxyO, { note: "osi skozi O" }),
        ]
      : [
          ans("Ix", "I_x", "cm⁴", P.Ix),
          ans("Iy", "I_y", "cm⁴", P.Iy),
          ans("Ixy", "I_{xy}", "cm⁴", P.Ixy),
          ans("I1", "I_1", "cm⁴", P.I1),
          ans("I2", "I_2", "cm⁴", P.I2),
          angleAns("alpha", "α_G", P.alpha, { note: "med −45° in 45°" }),
        ];

    const solution = sectionLines(sec, P, { x: true, xy: true });
    if (sym) {
      solution.push(
        `Prerez ima simetrijsko os, zato je težiščni I_{xy} = 0 (os x ali y v težišču je glavna os).`,
        `Glede na osi skozi O (Steiner nazaj): I_{xy,O} = I_{xy} − x_T·y_T·A = 0 − ${num(P.xT)}·${num(P.yT)}·${num(P.A)} = ${num(P.IxyO)} cm⁴.`,
        `Pozor na predznak: zapiski uporabljajo I_{xy} = −∫xy dA. Nekatere stare rešitve računajo +ΣA_i·x_i·y_i (= +∫xy dA) in dobijo ${num(-P.IxyO)} cm⁴ — isti znesek, nasproten predznak.`,
        `Za kontrolo: I_{x,O} = I_x + y_T²·A = ${num(P.IxO)} cm⁴, I_{y,O} = I_y + x_T²·A = ${num(P.IyO)} cm⁴, I_p = I_x + I_y = ${num(P.Ip)} cm⁴.`,
      );
    } else {
      const avg = (P.Ix + P.Iy) / 2;
      const Rm = (P.I1 - P.I2) / 2;
      solution.push(
        `tan 2α_G = 2I_{xy}/(I_x − I_y) = 2·${num(P.Ixy)}/(${num(P.Ix)} − ${num(P.Iy)}) = ${num((2 * P.Ixy) / (P.Ix - P.Iy))} → α_G = ${num(P.alpha)}°`,
        `I_{1,2} = (I_x + I_y)/2 ± √(((I_x − I_y)/2)² + I_{xy}²) = ${num(avg)} ± ${num(Rm)} → I_1 = ${num(P.I1)} cm⁴, I_2 = ${num(P.I2)} cm⁴`,
        `Katera os je katera: I_u(α_G) = (I_x + I_y)/2 + (I_x − I_y)/2·cos 2α_G + I_{xy}·sin 2α_G = ${num(P.Iu((P.alpha * Math.PI) / 180))} cm⁴, torej je os, zasukana za α_G, os ${P.alphaIsMax ? "1 (največji moment)" : "2 (najmanjši moment); os 1 je pravokotna nanjo"}.`,
        `Kontrola: I_1 + I_2 = I_x + I_y = ${num(P.Ip)} cm⁴.`,
      );
    }

    return {
      title: this.title,
      text,
      figure(f) {
        drawSection(f, sec, { origin: true });
      },
      answers,
      solution,
      solutionFigure(f) {
        drawSection(f, sec, { dims: false, parts: true, centroid: true, props: P, principalAxes: !sym });
        const b = bbox(sec);
        f.label([b.x0, b.y0], `T: x_T = ${num(P.xT)} cm, y_T = ${num(P.yT)} cm`, { dy: 34, anchor: "start" });
      },
    };
  },
};
