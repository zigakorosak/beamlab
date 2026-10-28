// Shared pieces of the stress-state exercises (napetostno stanje):
//   planeStress()   the course's formulas for a plane stress state
//                   (σ_N, τ_N on an inclined plane, C, R, σ_1, σ_2, α);
//   stressElement() the exam's square element with its stress arrows;
//   mohrCircle()    Mohr's circle for the solution figure.
//
// Sign conventions (vse_enacbe_in_postopki.md §8, snov.md §5):
//   tension positive; τ_xy positive when on the face with normal +x it
//   points in +y (and on the face with normal +y in +x);
//   φ is the angle of the plane's normal n from the x axis, counterclockwise;
//   σ_N = (σx+σy)/2 + (σx−σy)/2·cos2φ + τxy·sin2φ
//   τ_N = −(σx−σy)/2·sin2φ + τxy·cos2φ, positive along n turned by +90°;
//   Mohr: X = (σx, +τxy), Y = (σy, −τxy), τ axis up. The point of the plane
//   φ is then exactly (σ_N(φ), τ_N(φ)), so X is φ = 0 and Y is φ = 90°.

import { s, arrow } from "../../render/svg.js";
import { svgText, textWidth } from "../draw.js";
import { deg, num, rad } from "../kit.js";

/** A number for a product or sum in a solution line: negative ones in brackets. */
export const par = (v) => (v < -1e-12 ? `(${num(v)})` : num(v));

/** Everything the course computes from σx, σy, τxy. */
export function planeStress(sx, sy, txy) {
  const C = (sx + sy) / 2;
  const d = (sx - sy) / 2;
  const R = Math.hypot(d, txy);
  // α: direction of σ1, from x, counterclockwise, −90° < α ≤ 90°.
  // atan2 picks the quadrant of 2α from the point X relative to C.
  const two = deg(Math.atan2(txy, d));
  return {
    C,
    R,
    s1: C + R,
    s2: C - R,
    alpha: two / 2,
    twoAlpha: two,
    sN: (phi) => C + d * Math.cos(rad(2 * phi)) + txy * Math.sin(rad(2 * phi)),
    tN: (phi) => -d * Math.sin(rad(2 * phi)) + txy * Math.cos(rad(2 * phi)),
  };
}

/**
 * The steps that find α the way it's done by hand: arctan, then the
 * quadrant from the sign of σx − σy. Returns solution lines.
 */
export function alphaSteps(sx, sy, txy, { names = ["σ_x", "σ_y", "τ_{xy}"], unit = " MPa", sigma = "σ_1", normal = "σ_N" } = {}) {
  const [nx, ny, nt] = names;
  const st = planeStress(sx, sy, txy);
  const d = sx - sy;
  const lines = [];
  if (Math.abs(d) < 1e-9) {
    lines.push(`${nx} = ${ny}, zato tan 2α → ∞: 2α = ${txy > 0 ? "90" : "−90"}° (znak ${nt}), α = ${num(st.alpha)}°.`);
  } else {
    const t = (2 * txy) / d;
    const a0 = deg(Math.atan(t));
    lines.push(`tan 2α = 2${nt}/(${nx} − ${ny}) = 2·${par(txy)}/(${num(sx)} − ${par(sy)}) = ${num(t)} → arctan = ${num(a0)}°.`);
    if (d > 0) lines.push(`Ker je ${nx} − ${ny} > 0 (točka X leži desno od središča C), je 2α = ${num(st.twoAlpha)}° in α = ${num(st.alpha)}° (smer ${sigma}).`);
    else lines.push(`Ker je ${nx} − ${ny} < 0 (točka X leži levo od središča C), 2α popravimo za 180°: 2α = ${num(st.twoAlpha)}°, α = ${num(st.alpha)}° (smer ${sigma}).`);
  }
  lines.push(`Kontrola: ${normal}(α) = ${num(st.C)} + ${par((sx - sy) / 2)}·cos(${num(st.twoAlpha)}°) + ${par(txy)}·sin(${num(st.twoAlpha)}°) = ${num(st.sN(st.alpha))}${unit} = ${sigma} ✓`);
  return lines;
}

const unitPx = (a) => [Math.cos(rad(a)), -Math.sin(rad(a))]; // math angle → screen direction

/**
 * A square element at `c` (world), half-size h, turned by `rot` degrees,
 * with the stresses of its own (turned) frame: sx on the faces whose normal
 * is at rot and rot+180°, sy on rot±90°, txy the shear. Arrows point the
 * way the stress acts (tension out of the face, compression into it, shear
 * along the face). `labels`: texts for the +faces { sx, sy, txy } (null =
 * no text); a zero stress gets no arrow unless `show` lists it.
 */
export function stressElement(f, { sx = 0, sy = 0, txy = 0, rot = 0, c = [0, 0], h = 1, labels = {}, show = [], axes = true } = {}) {
  const W = (u, v) => [c[0] + u * Math.cos(rad(rot)) - v * Math.sin(rad(rot)), c[1] + u * Math.sin(rad(rot)) + v * Math.cos(rad(rot))];
  const corners = [W(-h, -h), W(h, -h), W(h, h), W(-h, h)];
  f.polygon(corners, "fig-body");
  f.custom(
    corners,
    (T) => {
      const g = s("g");
      const hp = h * T.ppm;
      const L = Math.max(24, Math.min(38, hp * 0.6));
      const cx = T.X(c[0]), cy = T.Y(c[1]);
      const text = (x, y, str, n) => {
        const anchor = n[0] > 0.4 ? "start" : n[0] < -0.4 ? "end" : "middle";
        const dy = n[1] > 0.4 ? 12 : n[1] < -0.4 ? -2 : 4;
        g.append(svgText(x, y + dy, str, { class: "fig-force-label", "text-anchor": anchor }));
      };
      for (let k = 0; k < 4; k++) {
        const n = unitPx(rot + 90 * k);
        const side = unitPx(rot + 90 * k + 90); // n turned by +90°
        const xFace = k % 2 === 0;
        const plus = k < 2;
        const fx = cx + n[0] * hp, fy = cy + n[1] * hp;
        // Normal stress.
        const sig = xFace ? sx : sy;
        const key = xFace ? "sx" : "sy";
        if (Math.abs(sig) > 1e-9 || show.includes(key)) {
          const a = [fx + n[0] * 3, fy + n[1] * 3], b = [fx + n[0] * (3 + L), fy + n[1] * (3 + L)];
          g.append(sig < 0 ? arrow(b[0], b[1], a[0], a[1], { cls: "fig-force", size: 8 }) : arrow(a[0], a[1], b[0], b[1], { cls: "fig-force", size: 8 }));
          if (plus && labels[key]) {
            // Vertical arrows of an upright element get the text beside them (the figure is
            // short); a turned element has room past the ends (its corners reach further).
            if (rot === 0 && Math.abs(n[1]) > 0.5) text(fx + n[0] * (3 + L * 0.55) - side[0] * 8, fy + n[1] * (3 + L * 0.55) - side[1] * 8, labels[key], [-side[0], 0]);
            else text(fx + n[0] * (L + 10), fy + n[1] * (L + 10), labels[key], n);
          }
        }
        // Shear: along the face, on the half towards `side`, 9 px outside.
        if (Math.abs(txy) > 1e-9 || show.includes("txy")) {
          // On x faces τ>0 points along `side` (+y on the +x face); on y faces against it.
          const along = (xFace ? 1 : -1) * (txy < 0 ? -1 : 1);
          const bx = fx + n[0] * 9, by = fy + n[1] * 9;
          const p0 = [bx + side[0] * hp * 0.12, by + side[1] * hp * 0.12];
          const p1 = [bx + side[0] * hp * 0.88, by + side[1] * hp * 0.88];
          g.append(along > 0 ? arrow(p0[0], p0[1], p1[0], p1[1], { cls: "fig-force", size: 8 }) : arrow(p1[0], p1[1], p0[0], p0[1], { cls: "fig-force", size: 8 }));
          if (plus && labels.txy) text(bx + side[0] * hp * 0.5 + n[0] * 7, by + side[1] * hp * 0.5 + n[1] * 7, labels.txy, n);
        }
      }
      if (axes) {
        // Global x, y at the lower left corner, clear of the arrows.
        const ox = cx - hp - 26, oy = cy + hp + 26;
        g.append(
          s("g.fig-axis", {}, arrow(ox, oy, ox + 34, oy, { size: 7 }), arrow(ox, oy, ox, oy - 34, { size: 7 }), svgText(ox + 38, oy + 4, "x"), svgText(ox - 4, oy - 36, "y", { "text-anchor": "end" })),
        );
      }
      return g;
    },
    // Room for the arrows and the longest text past their ends (σ = 70 on a phone was cut off).
    // An upright element has its texts right of or above the arrows: the left side needs only
    // the arrows (a phone's two sides together are capped, "σ = −130" on the right was cut off).
    (() => {
      const pad = Math.max(64, 55 + 7 * Math.max(0, ...Object.values(labels).filter(Boolean).map((t) => String(t).length)));
      return rot === 0 ? { l: 64, r: pad, t: pad, b: pad } : pad;
    })(),
  );
}


/**
 * Mohr's circle (world units = MPa): σ axis right, τ axis up, X = (σx, τxy),
 * Y = (σy, −τxy), C, σ1, σ2, τ_max and the angle 2α at C. `extra`: more
 * points [{ p: [σ, τ], name }].
 */
export function mohrCircle(f, sx, sy, txy, { extra = [], unit = "MPa", names = ["X", "Y"] } = {}) {
  const st = planeStress(sx, sy, txy);
  const { C, R } = st;
  const blank = () => s("g"); // (an item that only keeps room)
  const lo = Math.min(st.s2, 0) - 0.3 * R;
  // The σ axis reaches past the circle far enough for its name to sit
  // beside the circle, not on it: a share k of the drawing's width (about
  // 60 px; the scale depends on the screen, a phone's drawing is narrower).
  // (A phone's drawing is as wide as the screen and far from as tall as
  // allowed: three rows' room above and below the circle for the points' texts.)
  const sigmaAxis = (k, room) => (g) => {
    const hi = Math.max(Math.max(st.s1, 0) + 0.35 * R, st.s1 + (k / (1 - k)) * (st.s1 - lo));
    g.bounds([[lo, -1.2 * R], [hi, 1.2 * R]]);
    if (room) g.custom([[C, R], [C, -R]], blank, { l: 0, r: 0, t: room, b: room });
    g.force([lo, 0], 0, { tail: true, world: hi - lo, cls: "fig-axis" });
    g.label([hi, 0], `σ [${unit}]`, { dx: 2, dy: -10, anchor: "end", cls: "fig-name", alts: [[2, 20, "end"], [2, -24, "end"], [2, 34, "end"], [2, -38, "end"]] });
  };
  f.byWidth(500, sigmaAxis(0.24, 54), sigmaAxis(0.1, 0));
  f.force([0, -1.2 * R], 90, { tail: true, world: 2.4 * R, cls: "fig-axis" });

  f.label([0, 1.2 * R], "τ", { dx: -10, dy: 6, anchor: "end", cls: "fig-name", alts: [[10, 6, "start"]] });
  f.circle([C, 0], R, "fig-rope");
  const X = [sx, txy], Y = [sy, -txy];
  f.dashed(X, Y);
  f.dashed([sx, 0], X);
  f.dashed([sy, 0], Y);
  if (Math.abs(st.twoAlpha) > 3) f.angle([C, 0], 0, st.twoAlpha, "2α", 26);
  const side = (p) => (p[0] >= C ? { dx: 8, anchor: "start" } : { dx: -8, anchor: "end" });
  const vert = (p) => (p[1] >= 0 ? -8 : 16);
  // Other places for a point's text when it would sit on another one or on
  // a line (a phone's small circle): the other side above/below, then across.
  const others = (p) => {
    const { dx, anchor } = side(p), dy = vert(p), flip = anchor === "start" ? "end" : "start";
    return [[dx, dy === -8 ? 16 : -8, anchor], [-dx, dy, flip], [-dx, dy === -8 ? 16 : -8, flip]];
  };
  // On a phone the long "X (σ; τ)" texts go inside the circle, towards the
  // σ axis (beside the points, outside, they took most of the width); or
  // outside, beside the point or a row further out; or, when the circle is
  // crowded, clear of it over the point: above its top (a point in the upper
  // half) or below its bottom (the lower half).
  const pointText = (p, text) => {
    const inward = p[0] >= C ? "end" : "start", dxIn = p[0] >= C ? -6 : 6;
    const dyIn = p[1] >= 0 ? 18 : -9;
    const near = [[dxIn, dyIn, inward], [dxIn, dyIn === 18 ? -9 : 18, inward], [0, p[1] >= 0 ? -9 : 18, "middle"], [0, dyIn, "middle"], ...others(p), [dxIn, dyIn === 18 ? 32 : -23, inward], [0, p[1] >= 0 ? -23 : 32, "middle"], [side(p).dx, vert(p), side(p).anchor], [side(p).dx, vert(p) === -8 ? -22 : 30, side(p).anchor]];
    f.byWidth(
      500,
      (g) => {
        g.point(p, "");
        // (A point on the circle's side keeps room for its text outside, beside it.)
        const w = textWidth(text) + 12;
        if (Math.abs(p[0] - C) > 0.6 * R) g.custom([p], blank, p[0] >= C ? { l: 0, r: w, t: 0, b: 0 } : { l: w, r: 0, t: 0, b: 0 });
        g.custom([p], (T) => {
          const x = T.X(p[0]), y = T.Y(p[1]), top = T.Y(R), bottom = T.Y(-R);
          const clear = p[1] >= 0 ? [top - 8, top - 22, top - 36] : [bottom + 18, bottom + 32, bottom + 46];
          const alts = [...near.map(([dx, dy, an]) => [x + dx, y + dy, an]), ...clear.map((yy) => [x, yy, "middle"])];
          const t = svgText(alts[0][0], alts[0][1], text, { class: "fig-name", "text-anchor": alts[0][2] });
          t.alts = alts;
          return t;
        });
      },
      (g) => g.point(p, text, { ...side(p), dy: vert(p), alts: others(p) }),
    );
  };
  for (const [p, name] of [[X, names[0]], [Y, names[1]]]) pointText(p, `${name} (${num(p[0])}; ${num(p[1])})`);
  f.point([C, 0], `C = ${num(C)}`, { dx: 0, dy: 16, anchor: "middle", alts: [[0, -8, "middle"], [6, 16, "start"], [-6, 16, "end"], [6, -8, "start"], [-6, -8, "end"], [0, 30, "middle"], [0, -22, "middle"]] });
  f.point([st.s1, 0], `σ_1 = ${num(st.s1)}`, { dx: 6, dy: 16, anchor: "start", alts: [[6, -8, "start"], [6, 30, "start"], [-6, -22, "end"], [-6, 44, "end"], [6, -22, "start"], [6, 44, "start"]] });
  f.point([st.s2, 0], `σ_2 = ${num(st.s2)}`, { dx: -6, dy: 16, anchor: "end", alts: [[-6, -8, "end"], [-6, 30, "end"], [-6, -22, "end"], [-6, 44, "end"]] });

  // The top of the circle; its text would sit on X's or Y's when 2α ≈ ±90°.
  const crowded = [X, Y, ...extra.map((e) => e.p)].some((p) => Math.hypot(p[0] - C, p[1] - R) < 0.55 * R);
  f.point([C, R], crowded ? "" : `τ_{max} = R = ${num(R)}`, { dx: 0, dy: -8, anchor: "middle", alts: [[8, -8, "start"], [-8, -8, "end"], [0, -22, "middle"], [8, -22, "start"], [-8, -22, "end"]] });
  for (const e of extra) pointText(e.p, e.name);


  return st;
}
