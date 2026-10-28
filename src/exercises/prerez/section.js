// Prerezi: composite cross-sections and their geometric properties, as in
// the course notes (vse_enacbe_in_postopki.md §7). Units: cm.
//
// A section is { parts, outline?, holes?, dims? }:
//   parts: the pieces the hand calculation splits it into, each
//     { t: "rect", x, y, w, h }            lower-left corner (x, y)
//     { t: "circle", cx, cy, r }
//     { t: "semi", cx, cy, r, dir }        half disc, centre of the diameter
//                                          at (cx, cy), bulging towards dir
//                                          (90 up, 270 down, 0 right, 180 left)
//     { t: "quarter", cx, cy, r, sx, sy }  quarter disc in quadrant (sx, sy) = (±1, ±1)
//     { t: "tri", x, y, b, h }             right triangle, the right angle at
//                                          (x, y), legs b along x and h along y
//                                          (signed: b < 0 goes left)
//   and `hole: true` on a part makes its area negative (a notch, a bore).
//   outline / holes: what the figure draws (the union outline, so the
//     division lines of the calculation don't show), as
//     { poly: [[x, y]…] } or { circle: [[cx, cy], r] }; defaults to the parts.
//   dims: dimension lines [a, b, text, off] in section coordinates;
//   labels: free texts [point, text, label options] (a tube's wall).
//
// Axes: x to the right, y up. The deviation (product) moment follows the
// notes: I_xy = −∫ x·y dA, so Steiner reads I_xy = Σ[I_xy,i − (x_i − x_T)(y_i − y_T)A_i]
// and the principal axes tan 2α = 2·I_xy / (I_x − I_y).

import { rad } from "../kit.js";

const E43 = 4 / (3 * Math.PI); // centroid of a half / quarter disc: e = 4r/(3π)

/**
 * One part: area A (negative for a hole), centroid (x, y), centroidal
 * moments Ix = ∫(y−y_c)² dA, Iy, and D = ∫(x−x_c)(y−y_c) dA (all signed
 * with the part, so a hole subtracts), and its y-extent.
 */
export function partProps(p) {
  const k = p.hole ? -1 : 1;
  let A, x, y, Ix, Iy, D, y0, y1;
  if (p.t === "rect") {
    A = p.w * p.h;
    x = p.x + p.w / 2;
    y = p.y + p.h / 2;
    Ix = (p.w * p.h ** 3) / 12;
    Iy = (p.w ** 3 * p.h) / 12;
    D = 0;
    [y0, y1] = [p.y, p.y + p.h];
  } else if (p.t === "circle") {
    A = Math.PI * p.r ** 2;
    [x, y] = [p.cx, p.cy];
    Ix = Iy = (Math.PI * p.r ** 4) / 4;
    D = 0;
    [y0, y1] = [p.cy - p.r, p.cy + p.r];
  } else if (p.t === "semi") {
    A = (Math.PI * p.r ** 2) / 2;
    const e = E43 * p.r;
    const [ux, uy] = [Math.round(Math.cos(rad(p.dir))), Math.round(Math.sin(rad(p.dir)))];
    x = p.cx + ux * e;
    y = p.cy + uy * e;
    const along = (Math.PI * p.r ** 4) / 8 - A * e * e; // about the axis parallel to the diameter
    const across = (Math.PI * p.r ** 4) / 8; // about the symmetry axis
    [Ix, Iy] = uy ? [along, across] : [across, along];
    D = 0;
    [y0, y1] = uy > 0 ? [p.cy, p.cy + p.r] : uy < 0 ? [p.cy - p.r, p.cy] : [p.cy - p.r, p.cy + p.r];
  } else if (p.t === "quarter") {
    A = (Math.PI * p.r ** 2) / 4;
    const e = E43 * p.r;
    x = p.cx + p.sx * e;
    y = p.cy + p.sy * e;
    Ix = Iy = (Math.PI * p.r ** 4) / 16 - A * e * e;
    // ∫xy about the corner = sx·sy·r⁴/8, moved to the centroid.
    D = p.sx * p.sy * (p.r ** 4 / 8 - A * e * e);
    [y0, y1] = p.sy > 0 ? [p.cy, p.cy + p.r] : [p.cy - p.r, p.cy];
  } else if (p.t === "tri") {
    const b = Math.abs(p.b), h = Math.abs(p.h);
    A = (b * h) / 2;
    x = p.x + p.b / 3;
    y = p.y + p.h / 3;
    Ix = (b * h ** 3) / 36;
    Iy = (b ** 3 * h) / 36;
    // Right angle at the origin, legs along +x and +y: ∫xy dA about the
    // centroid = b²h²/24 − A·(b/3)(h/3) = −b²h²/72; mirroring flips the sign.
    D = -Math.sign(p.b * p.h) * (b * b * h * h) / 72;
    [y0, y1] = [Math.min(p.y, p.y + p.h), Math.max(p.y, p.y + p.h)];
  } else throw new Error(`unknown part ${p.t}`);
  return { A: k * A, x, y, Ix: k * Ix, Iy: k * Iy, D: k * D, y0, y1, hole: !!p.hole };
}

/** Width of one part at height y (cm), unsigned. */
function partWidth(p, y) {
  const disc = (dy, r) => (Math.abs(dy) <= r ? Math.sqrt(r * r - dy * dy) : 0);
  if (p.t === "rect") return y >= p.y && y <= p.y + p.h ? p.w : 0;
  if (p.t === "circle") return 2 * disc(y - p.cy, p.r);
  if (p.t === "semi") {
    const uy = Math.round(Math.sin(rad(p.dir)));
    if (uy > 0) return y >= p.cy ? 2 * disc(y - p.cy, p.r) : 0;
    if (uy < 0) return y <= p.cy ? 2 * disc(y - p.cy, p.r) : 0;
    return disc(y - p.cy, p.r);
  }
  if (p.t === "quarter") return (p.sy > 0 ? y >= p.cy : y <= p.cy) ? disc(y - p.cy, p.r) : 0;
  if (p.t === "tri") {
    const s = (y - p.y) / p.h;
    return s >= 0 && s <= 1 ? Math.abs(p.b) * (1 - s) : 0;
  }
  return 0;
}

/** Net width b(y) of the section at height y (holes subtract). */
export function widthAt(sec, y) {
  return sec.parts.reduce((t, p) => t + (p.hole ? -1 : 1) * partWidth(p, y), 0);
}

/**
 * Principal moments and the angle of the notes:
 *   tan 2α = 2·I_xy / (I_x − I_y), −45° < α ≤ 45°
 * (α counterclockwise from x). I1 = max, I2 = min; `alphaIsMax` tells
 * which of them belongs to the axis turned by α. `alphaMax` is the
 * direction of the I1 axis, −90° < alphaMax ≤ 90°.
 */
export function principal(Ix, Iy, Ixy) {
  const avg = (Ix + Iy) / 2;
  const R = Math.hypot((Ix - Iy) / 2, Ixy);
  let a = Math.abs(Ix - Iy) < 1e-12 ? (Ixy === 0 ? 0 : Math.sign(Ixy) * Math.PI / 4) : 0.5 * Math.atan(2 * Ixy / (Ix - Iy));
  const Iu = (a) => avg + ((Ix - Iy) / 2) * Math.cos(2 * a) + Ixy * Math.sin(2 * a);
  const alpha = (a * 180) / Math.PI;
  const alphaIsMax = Iu(a) >= avg;
  let alphaMax = alphaIsMax ? alpha : alpha + 90;
  if (alphaMax > 90) alphaMax -= 180;
  return { I1: avg + R, I2: avg - R, alpha, alphaIsMax, alphaMax, Iu };
}

/** Everything about a section: A, centroid, centroidal moments, extreme fibres, W. */
export function sectionProps(sec) {
  const rows = sec.parts.map(partProps);
  const A = rows.reduce((t, r) => t + r.A, 0);
  const Sx = rows.reduce((t, r) => t + r.A * r.y, 0); // static moments about the reference axes
  const Sy = rows.reduce((t, r) => t + r.A * r.x, 0);
  const xT = Sy / A, yT = Sx / A;
  let Ix = 0, Iy = 0, D = 0;
  for (const r of rows) {
    r.dx = r.x - xT;
    r.dy = r.y - yT;
    Ix += r.Ix + r.A * r.dy ** 2;
    Iy += r.Iy + r.A * r.dx ** 2;
    D += r.D + r.A * r.dx * r.dy;
  }
  const Ixy = clean(-D, Ix + Iy);
  const solids = rows.filter((r) => !r.hole);
  const ymax = Math.max(...solids.map((r) => r.y1));
  const ymin = Math.min(...solids.map((r) => r.y0));
  const eTop = ymax - yT, eBot = yT - ymin;
  // About the reference axes through O (0, 0): Steiner back from the centroid.
  const IxO = Ix + A * yT * yT, IyO = Iy + A * xT * xT, IxyO = clean(Ixy - xT * yT * A, Ix + Iy);
  return { rows, A, Sx, Sy, xT, yT, Ix, Iy, Ixy, Ip: Ix + Iy, ymin, ymax, eTop, eBot, Wtop: Ix / eTop, Wbot: Ix / eBot, IxO, IyO, IxyO, ...principal(Ix, Iy, Ixy) };
}

// Round-off from summing parts: a symmetric section must give exactly 0.
const clean = (v, scale) => (Math.abs(v) < 1e-10 * Math.max(1, Math.abs(scale)) ? 0 : v);

/**
 * Static moment S* of the part of the section above the cut y = c, about
 * the centroidal x axis: S* = ∫_{y>c} (y − y_T) dA (for τ = T·S* / (I·b)).
 * The part below has −S*. Simpson between the parts' edges (exact for
 * rectangles, very close for the round parts).
 */
export function staticMoment(sec, c, yT = sectionProps(sec).yT) {
  const rows = sec.parts.map(partProps);
  const top = Math.max(...rows.map((r) => r.y1));
  if (c >= top) return 0;
  const cuts = [c, top, ...rows.flatMap((r) => [r.y0, r.y1])].filter((y) => y >= c && y <= top);
  // Round parts: also break at their centres (the width has a kink there).
  for (const p of sec.parts) if (p.cy !== undefined && p.cy > c && p.cy < top) cuts.push(p.cy);
  const ys = [...new Set(cuts.map((y) => Math.round(y * 1e9) / 1e9))].sort((a, b) => a - b);
  let S = 0;
  for (let i = 0; i < ys.length - 1; i++) {
    const a = ys[i], b = ys[i + 1];
    const n = 200;
    const h = (b - a) / n;
    // Sample just inside the interval so a rectangle's edge counts once.
    const f = (y) => (y - yT) * widthAt(sec, Math.min(b - 1e-9, Math.max(a + 1e-9, y)));
    let s = f(a) + f(b);
    for (let k = 1; k < n; k++) s += f(a + k * h) * (k % 2 ? 4 : 2);
    S += (s * h) / 3;
  }
  return S;
}

// ---------------------------------------------------------------- shapes
// Builders for the sections of the exams. All dimensions in cm, the
// reference point O at the lower-left corner of the bounding box.

const R = (x, y, w, h, hole) => ({ t: "rect", x, y, w, h, ...(hole ? { hole: true } : {}) });
const poly = (...pts) => ({ poly: pts });

export const SHAPES = {
  /** Rectangle b × h. */
  rect(b, h) {
    return { name: "pravokotnik", parts: [R(0, 0, b, h)], dims: [[[0, 0], [b, 0], `${b}`, 22], [[0, 0], [0, h], `${h}`, -22]] };
  },

  /** Hollow rectangle B × H with a centred b × h opening. */
  hollowRect(B, H, b, h) {
    const x = (B - b) / 2, y = (H - h) / 2;
    return {
      name: "votel pravokotnik",
      parts: [R(0, 0, B, H), R(x, y, b, h, true)],
      dims: [[[0, 0], [B, 0], `${B}`, 22], [[0, 0], [0, H], `${H}`, -22], [[x, y + h], [x + b, y + h], `${b}`, -12], [[x + b, y], [x + b, y + h], `${h}`, -12]],
    };
  },

  /**
   * I section from flanges: top flange bt × tt, bottom bb × tb, web tw × hw
   * (centred). Unequal flanges give a section symmetric only about the vertical axis.
   */
  I(bt, tt, tw, hw, bb = bt, tb = tt) {
    const W = Math.max(bt, bb), H = tb + hw + tt;
    const xb = (W - bb) / 2, xt = (W - bt) / 2, xw = (W - tw) / 2;
    return {
      name: "I prerez",
      parts: [R(xb, 0, bb, tb), R(xw, tb, tw, hw), R(xt, tb + hw, bt, tt)],
      outline: [poly([xb, 0], [xb + bb, 0], [xb + bb, tb], [xw + tw, tb], [xw + tw, tb + hw], [xt + bt, tb + hw], [xt + bt, H], [xt, H], [xt, tb + hw], [xw, tb + hw], [xw, tb], [xb, tb])],
      dims: [
        [[xt, H], [xt + bt, H], `${bt}`, -20],
        [[xb, 0], [xb + bb, 0], `${bb}`, 22],
        [[xw, tb + hw * 0.5], [xw + tw, tb + hw * 0.5], `${tw}`, 0.001],
        [[W, 0], [W, tb], `${tb}`, 22],
        [[W, tb], [W, tb + hw], `${hw}`, 22],
        [[W, tb + hw], [W, H], `${tt}`, 22],
      ],
    };
  },

  /**
   * The same I drawn as on the 2016 exam: an a × H rectangle with two
   * notches n × hn cut from the sides (negative areas).
   */
  notchedI(a, H, n, hn) {
    const y = (H - hn) / 2;
    const I = SHAPES.I(a, y, a - 2 * n, hn);
    return {
      ...I,
      name: "I prerez (pravokotnik z izrezoma)",
      parts: [R(0, 0, a, H), R(0, y, n, hn, true), R(a - n, y, n, hn, true)],
      dims: [[[0, H], [a, H], `${a}`, -20], [[0, y], [n, y], `${n}`, 14], [[a - n, y], [a, y], `${n}`, 14], [[a, 0], [a, y], `${num0(y)}`, 22], [[a, y], [a, y + hn], `${hn}`, 22], [[a, y + hn], [a, H], `${num0(y)}`, 22]],
    };
  },

  /** T: flange bf × tf on top of a web tw × hw (flip = flange at the bottom, ⊥). */
  T(bf, tf, tw, hw, flip = false) {
    const xw = (bf - tw) / 2, H = tf + hw;
    if (!flip) {
      return {
        name: "T prerez",
        parts: [R(xw, 0, tw, hw), R(0, hw, bf, tf)],
        outline: [poly([xw, 0], [xw + tw, 0], [xw + tw, hw], [bf, hw], [bf, H], [0, H], [0, hw], [xw, hw])],
        dims: [[[0, H], [bf, H], `${bf}`, -20], [[xw, 0], [xw + tw, 0], `${tw}`, 22], [[bf, 0], [bf, hw], `${hw}`, 22], [[bf, hw], [bf, H], `${tf}`, 22]],
      };
    }
    return {
      name: "obrnjen T prerez",
      parts: [R(0, 0, bf, tf), R(xw, tf, tw, hw)],
      outline: [poly([0, 0], [bf, 0], [bf, tf], [xw + tw, tf], [xw + tw, H], [xw, H], [xw, tf], [0, tf])],
      dims: [[[0, 0], [bf, 0], `${bf}`, 22], [[xw, H], [xw + tw, H], `${tw}`, -20], [[bf, 0], [bf, tf], `${tf}`, 22], [[bf, tf], [bf, H], `${hw}`, 22]],
    };
  },

  /** U open upwards: base b × tb, two walls tw × hw standing on it. */
  U(b, tb, tw, hw) {
    const H = tb + hw;
    return {
      name: "U prerez",
      parts: [R(0, 0, b, tb), R(0, tb, tw, hw), R(b - tw, tb, tw, hw)],
      outline: [poly([0, 0], [b, 0], [b, H], [b - tw, H], [b - tw, tb], [tw, tb], [tw, H], [0, H])],
      dims: [[[0, 0], [b, 0], `${b}`, 22], [[0, H], [tw, H], `${tw}`, -16], [[b - tw, H], [b, H], `${tw}`, -16], [[b, 0], [b, tb], `${tb}`, 22], [[b, tb], [b, H], `${hw}`, 22]],
    };
  },

  /** C (channel) open to the right: web tw × H, flanges bf × tf top and bottom. */
  C(H, tw, bf, tf) {
    return {
      name: "C prerez",
      parts: [R(0, 0, tw, H), R(tw, 0, bf - tw, tf), R(tw, H - tf, bf - tw, tf)],
      outline: [poly([0, 0], [bf, 0], [bf, tf], [tw, tf], [tw, H - tf], [bf, H - tf], [bf, H], [0, H])],
      dims: [[[0, H], [bf, H], `${bf}`, -20], [[0, 0], [tw, 0], `${tw}`, 22], [[0, 0], [0, H], `${H}`, -22], [[bf, 0], [bf, tf], `${tf}`, 22], [[bf, H - tf], [bf, H], `${tf}`, 22]],
    };
  },

  /** L angle: vertical leg of height a, horizontal leg of length b, thickness t. */
  L(a, b, t) {
    return {
      name: "L prerez (kotnik)",
      parts: [R(0, 0, t, a), R(t, 0, b - t, t)],
      outline: [poly([0, 0], [b, 0], [b, t], [t, t], [t, a], [0, a])],
      dims: [[[0, 0], [b, 0], `${b}`, 22], [[0, 0], [0, a], `${a}`, -22], [[0, a], [t, a], `${t}`, -16], [[b, 0], [b, t], `${t}`, 22]],
    };
  },

  /** Z: bottom flange to the left, top flange to the right, web t × H. */
  Z(H, b1, b2, t) {
    // web at x = b1 − t … b1; bottom flange 0 … b1, top flange b1 − t … b1 − t + b2
    const xw = b1 - t;
    return {
      name: "Z prerez",
      parts: [R(0, 0, b1, t), R(xw, t, t, H - 2 * t), R(xw, H - t, b2, t)],
      outline: [poly([0, 0], [b1, 0], [b1, H - t], [xw + b2, H - t], [xw + b2, H], [xw, H], [xw, t], [0, t])],
      dims: [
        [[0, 0], [b1, 0], `${b1}`, 22],
        [[xw, H], [xw + b2, H], `${b2}`, -20],
        [[xw, H / 2], [b1, H / 2], `${t}`, 0.001],
        [[xw + b2, 0], [xw + b2, t], `${t}`, 22],
        [[xw + b2, t], [xw + b2, H - t], `${H - 2 * t}`, 22],
        [[xw + b2, H - t], [xw + b2, H], `${t}`, 22],
      ],
    };
  },

  /** H lying on its side: two upright flanges tf × hf, web lw × tw between them (centred). */
  Hrot(tf, hf, lw, tw) {
    const W = 2 * tf + lw, yw = (hf - tw) / 2;
    return {
      name: "H prerez",
      parts: [R(0, 0, tf, hf), R(tf, yw, lw, tw), R(tf + lw, 0, tf, hf)],
      outline: [poly([0, 0], [tf, 0], [tf, yw], [tf + lw, yw], [tf + lw, 0], [W, 0], [W, hf], [tf + lw, hf], [tf + lw, yw + tw], [tf, yw + tw], [tf, hf], [0, hf])],
      dims: [[[0, 0], [tf, 0], `${tf}`, 22], [[tf, 0], [tf + lw, 0], `${lw}`, 22], [[tf + lw, 0], [W, 0], `${tf}`, 22], [[0, 0], [0, hf], `${hf}`, -22], [[W, yw], [W, yw + tw], `${tw}`, 22]],
    };
  },

  /** Solid circle of diameter d. */
  circle(d) {
    const r = d / 2;
    return { name: "krog", parts: [{ t: "circle", cx: r, cy: r, r }], dims: [[[0, r], [d, r], `Ø${d}`, 0.001]] };
  },

  /** Tube: outer diameter D, wall t. */
  tube(D, t) {
    const r = D / 2;
    return {
      name: "cev",
      parts: [{ t: "circle", cx: r, cy: r, r }, { t: "circle", cx: r, cy: r, r: r - t, hole: true }],
      dims: [[[0, 0], [D, 0], `D = ${D}`, 22]],
      labels: [[[r, D], `t = ${t}`, { dy: -10 }]],
    };
  },

  /** Rectangle b × h with a round hole Ø d centred at (cx, cy). */
  rectHole(b, h, d, cx, cy) {
    return {
      name: "pravokotnik z luknjo",
      parts: [R(0, 0, b, h), { t: "circle", cx, cy, r: d / 2, hole: true }],
      dims: [[[0, 0], [b, 0], `${b}`, 22], [[0, 0], [0, h], `${h}`, -22], [[0, h], [cx, h], `${cx}`, -18], [[b, 0], [b, cy], `${cy}`, 22], [[cx - d / 2, cy], [cx + d / 2, cy], `Ø${d}`, 0.001]],
    };
  },

  /** Rectangle b × h with a half disc (Ø b) on top. */
  rectSemi(b, h) {
    const r = b / 2;
    const arc = [];
    for (let i = 0; i <= 36; i++) arc.push([r + r * Math.cos((Math.PI * i) / 36), h + r * Math.sin((Math.PI * i) / 36)]);
    return {
      name: "pravokotnik s polkrogom",
      parts: [R(0, 0, b, h), { t: "semi", cx: r, cy: h, r, dir: 90 }],
      outline: [poly([0, 0], [b, 0], ...arc, [0, 0])],
      dims: [[[0, 0], [b, 0], `${b}`, 22], [[b, 0], [b, h], `${h}`, 22], [[r, h], [b, h], `r = ${num0(r)}`, 0.001]],
    };
  },

  /** Rectangle b × h with a right triangle (legs c along the top, k up) standing on its top-left. */
  rectTri(b, h, c, k) {
    return {
      name: "pravokotnik s trikotnikom",
      parts: [R(0, 0, b, h), { t: "tri", x: 0, y: h, b: c, h: k }],
      outline: [poly([0, 0], [b, 0], [b, h], [c, h], [0, h + k])],
      dims: [[[0, 0], [b, 0], `${b}`, 22], [[b, 0], [b, h], `${h}`, 22], [[0, h], [0, h + k], `${k}`, -22], [[0, h + k], [c, h + k], `${c}`, -14]],
    };
  },
};

function num0(v) {
  return String(Math.round(v * 100) / 100).replace(".", ",");
}

/** The section's bounding box in its own coordinates. */
export function bbox(sec) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of sec.parts) {
    if (p.hole) continue;
    let a, b, c, d;
    if (p.t === "rect") [a, b, c, d] = [p.x, p.x + p.w, p.y, p.y + p.h];
    else if (p.t === "tri") [a, b, c, d] = [Math.min(p.x, p.x + p.b), Math.max(p.x, p.x + p.b), Math.min(p.y, p.y + p.h), Math.max(p.y, p.y + p.h)];
    else [a, b, c, d] = [p.cx - p.r, p.cx + p.r, p.cy - p.r, p.cy + p.r];
    x0 = Math.min(x0, a); x1 = Math.max(x1, b); y0 = Math.min(y0, c); y1 = Math.max(y1, d);
  }
  return { x0, x1, y0, y1 };
}

/** Outline of one part as a polygon (for drawing). */
function partOutline(p) {
  if (p.t === "rect") return { poly: [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]] };
  if (p.t === "circle") return { circle: [[p.cx, p.cy], p.r] };
  if (p.t === "tri") return { poly: [[p.x, p.y], [p.x + p.b, p.y], [p.x, p.y + p.h]] };
  // Half / quarter disc: the centre, then the arc.
  const pts = [[p.cx, p.cy]];
  const a0 = p.t === "semi" ? p.dir - 90 : p.sx > 0 ? (p.sy > 0 ? 0 : 270) : p.sy > 0 ? 90 : 180;
  const span = p.t === "semi" ? 180 : 90;
  for (let i = 0; i <= 24; i++) {
    const a = rad(a0 + (span * i) / 24);
    pts.push([p.cx + p.r * Math.cos(a), p.cy + p.r * Math.sin(a)]);
  }
  return { poly: pts };
}

/**
 * Draw the section into a figure: `at` = where the section's origin O
 * goes (world units), `scale` = world units per cm. Options:
 *   dims (default true)   the section's dimension lines
 *   dimText               replaces dimension texts (array, same order; then sec.labels)
 *   centroid              mark T and the centroidal axes (needs props)
 *   parts                 dashed outlines of the calculation's parts
 *   origin                mark O with the reference axes x, y
 *   principalAxes         draw axes 1, 2 (needs props)
 */
export function drawSection(f, sec, { at = [0, 0], scale = 1, dims = true, dimText, centroid, parts = false, origin = false, principalAxes = false, props } = {}) {
  const P = ([x, y]) => [at[0] + x * scale, at[1] + y * scale];
  const draw = (item, cls) => {
    if (item.poly) f.polygon(item.poly.map(P), cls);
    else f.circle(P(item.circle[0]), item.circle[1] * scale, cls);
  };
  const outline = sec.outline ?? sec.parts.filter((p) => !p.hole).map(partOutline);
  const holes = sec.holes ?? sec.parts.filter((p) => p.hole).map(partOutline);
  for (const o of outline) draw(o, "fig-body");
  for (const o of holes) draw(o, "fig-hole");
  if (parts) {
    for (const p of sec.parts) {
      const o = partOutline(p);
      if (o.poly) f.polyline([...o.poly, o.poly[0]].map(P), "fig-dashed");
    }
  }
  const box = bbox(sec);
  if (centroid && props) {
    const T = [props.xT, props.yT];
    const ext = 0.18 * Math.max(box.x1 - box.x0, box.y1 - box.y0);
    f.dashed(P([box.x0 - ext, T[1]]), P([box.x1 + ext, T[1]]));
    f.dashed(P([T[0], box.y0 - ext]), P([T[0], box.y1 + ext]));
    f.point(P(T), "T", { dx: 6, dy: -6 });
  }
  if (principalAxes && props) {
    const T = P([props.xT, props.yT]);
    const len = 0.62 * Math.max(box.x1 - box.x0, box.y1 - box.y0) * scale;
    const a1 = props.alphaMax;
    for (const [a, name] of [[a1, "1"], [a1 + 90, "2"]]) {
      const u = [Math.cos(rad(a)), Math.sin(rad(a))];
      f.line([T[0] - u[0] * len * 0.6, T[1] - u[1] * len * 0.6], [T[0] + u[0] * len, T[1] + u[1] * len], "fig-rope");
      f.label([T[0] + u[0] * len, T[1] + u[1] * len], name, { dx: u[0] * 12, dy: -u[1] * 12 + 4, cls: "fig-name" });
    }
  }
  if (origin) {
    f.point(P([0, 0]), "O", { dx: -8, dy: 16, anchor: "end" });
    f.axes(P([0, 0]), { len: 34 });
  }
  if (dims) {
    (sec.dims ?? []).forEach(([a, b, text, off], i) => {
      f.dim(P(a), P(b), dimText?.[i] ?? text, off);
    });
    // Free labels (a tube's wall thickness) continue the dimText numbering.
    const n = (sec.dims ?? []).length;
    (sec.labels ?? []).forEach(([p, text, o], i) => f.label(P(p), dimText?.[n + i] ?? text, { cls: "fig-dim-label", ...o }));
  }
}
