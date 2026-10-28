// Drawing helpers for the strength exercises in this folder (torsion,
// buckling, sections), built on draw.js's figure().custom():
//   torqueArc      a torque on a shaft seen from the side: a curved arrow
//                  round the axis (front of the ring moves down for a torque
//                  vector along +x, right-hand rule)
//   torqueVec      a moment vector: arrow with a double head
//   shaft          a (stepped, maybe hollow) shaft drawn from the side
//   section        cross-sections (rectangle, circle, tube, I, T) with dims
//   guide          a sliding clamp (vpetje z vodilom) at the top of a column
//   intoPage       a force perpendicular to the drawing (⊗ / ⊙)

import { s, arrowHead } from "../../render/svg.js";
import { svgText, textWidth } from "../draw.js";
import { num } from "../kit.js";

/**
 * Torque on a horizontal shaft at p (world), shaft radius `r` (world).
 * `sign` > 0: torque vector along +x (to the right), < 0: along −x.
 * `avoid`: [x (world), label] of another torque's label on the same row; when
 * the two would meet, this label first tries the side away from it.
 */
export function torqueArc(f, p, r, sign, label, { dy = 0, avoid } = {}) {
  f.custom(
    [p],
    (T) => {
      const x = T.X(p[0]), y = T.Y(p[1]);
      const R = r * T.ppm + 9, ex = 13;
      // Ring seen almost edge-on; θ measured from the right (front) side.
      const P = (th) => [x + ex * Math.cos(th), y - R * Math.sin(th)];
      const tA = (105 * Math.PI) / 180, tB = (-105 * Math.PI) / 180;
      const n = 24;
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push(P(tA + ((tB - tA) * i) / n));
      if (sign < 0) pts.reverse();
      const [x1, y1] = pts[pts.length - 1], [x0, y0] = pts[pts.length - 3];
      const g = s(
        "g.fig-force",
        {},
        s("path", { d: "M" + pts.slice(0, -1).map((q) => q.join(" ")).join(" L"), fill: "none" }),
        arrowHead(x1 + (x1 - x0) * 0.8, y1 + (y1 - y0) * 0.8, x1 - x0, y1 - y0, 9),
      );
      if (label) {
        const t = svgText(x, y - R - 8 + dy, label, { class: "fig-force-label", "text-anchor": "middle" });
        // Another torque's label close by (a short segment on a phone): to
        // one side, or a row higher (see placeLabels).
        const yl = y - R - 8 + dy;
        t.alts = [[x, yl, "middle"], [x + 8, yl, "end"], [x - 8, yl, "start"], [x, yl - 15, "middle"], [x + 8, yl - 15, "end"], [x - 8, yl - 15, "start"], [x + 8, yl - 30, "end"], [x - 8, yl - 30, "start"]];
        if (avoid) {
          // (The other label is placed later, in the middle over its arc.)
          const ox = T.X(avoid[0]), w = textWidth(label) * 1.05, wo = textWidth(avoid[1]) * 1.05; // (bold)
          const gap = Math.abs(ox - x) - wo / 2; // free room between this arc and the other label
          if (gap < w / 2 + 4) {
            // Beside the arc, away from the other label, or (no room there either) a row higher.
            const i = (ox > x ? 1 : 2) + (gap < 8 + 4 ? 3 : 0);
            t.alts.unshift(t.alts.splice(i, 1)[0]);
          }
        }
        g.append(t);
      }
      return g;
    },
    (ppm) => ({ l: 60, r: 60, b: 60, t: r * ppm + 9 + 8 + (avoid ? 30 : 15) + 16 }), // (two rows higher: beside a neighbour's label)

  );
}

/** Moment vector: an arrow with two heads, tip at p (tail: start at p). */
export function torqueVec(f, p, angle, label, { len = 46, tail = true, labelSide = 1 } = {}) {
  f.custom(
    [p],
    (T) => {
      const ux = Math.cos((angle * Math.PI) / 180), uy = -Math.sin((angle * Math.PI) / 180);
      const x = T.X(p[0]), y = T.Y(p[1]);
      const [sx, sy] = tail ? [x, y] : [x - ux * len, y - uy * len];
      const [tx, ty] = tail ? [x + ux * len, y + uy * len] : [x, y];
      const g = s(
        "g.fig-force",
        {},
        s("line", { x1: sx, y1: sy, x2: tx - ux * 6, y2: ty - uy * 6 }),
        arrowHead(tx, ty, ux, uy, 9),
        arrowHead(tx - ux * 8, ty - uy * 8, ux, uy, 9),
      );
      if (label) {
        const mx = (sx + tx) / 2 - uy * 14 * labelSide, my = (sy + ty) / 2 + ux * 14 * labelSide;
        g.append(svgText(mx, my + 4, label, { class: "fig-force-label", "text-anchor": Math.abs(uy) > 0.5 ? (ux * labelSide >= 0 && uy * labelSide < 0 ? "start" : "end") : "middle" }));
      }
      return g;
    },
    len + 30,
  );
}

/** A force perpendicular to the drawing at p: ⊗ (into) or ⊙ (out of the page). */
export function intoPage(f, p, into, label, { dx = 14, dy = -12 } = {}) {
  f.custom(
    [p],
    (T) => {
      const x = T.X(p[0]), y = T.Y(p[1]), r = 8;
      const g = s("g.fig-force", {}, s("path", { d: `M${x - r} ${y} A${r} ${r} 0 1 0 ${x + r} ${y} A${r} ${r} 0 1 0 ${x - r} ${y}`, fill: "none" }));
      if (into) {
        const k = r * 0.7;
        g.append(s("line", { x1: x - k, y1: y - k, x2: x + k, y2: y + k }), s("line", { x1: x - k, y1: y + k, x2: x + k, y2: y - k }));
      } else g.append(s("path", { d: `M${x - 2.4} ${y} A2.4 2.4 0 1 0 ${x + 2.4} ${y} A2.4 2.4 0 1 0 ${x - 2.4} ${y}Z` }));
      if (label) g.append(svgText(x + dx, y + dy, label, { class: "fig-force-label", "text-anchor": dx < 0 ? "end" : "start" }));
      return g;
    },
    40,
  );
}

/**
 * A shaft from the side along y = 0. `segs`: [{ x0, x1, r, ri }] in world
 * units (ri: bore radius, drawn with hidden dashed lines).
 */
export function shaft(f, segs) {
  for (const sg of segs) {
    f.rect(sg.x0, -sg.r, sg.x1 - sg.x0, 2 * sg.r);
    if (sg.ri) {
      f.dashed([sg.x0, sg.ri], [sg.x1, sg.ri]);
      f.dashed([sg.x0, -sg.ri], [sg.x1, -sg.ri]);
    }
  }
  const x0 = Math.min(...segs.map((g) => g.x0)), x1 = Math.max(...segs.map((g) => g.x1));
  const span = x1 - x0;
  f.line([x0 - span * 0.03, 0], [x1 + span * 0.03, 0], "fig-dashed");
}

/** Hatched wall at x through ±h; `left`: the wall material is on the left. */
export function wall(f, x, h, left = true) {
  if (left) f.ground([x, h], [x, -h]);
  else f.ground([x, -h], [x, h]);
}

/**
 * Sliding clamp at the top of a column at p: two hatched guides left and
 * right of the column, the column can move along its axis but not turn.
 */
export function guide(f, p, halfW) {
  f.custom(
    [p],
    (T) => {
      const x = T.X(p[0]), y = T.Y(p[1]);
      const w = Math.max(halfW * T.ppm, 3) + 2;
      const g = s("g.fig-support");
      for (const side of [-1, 1]) {
        const gx = x + side * w;
        g.append(s("line", { x1: gx, y1: y - 4, x2: gx, y2: y + 30, class: "fig-wall" }));
        for (let d = 0; d <= 30; d += 6) g.append(s("line.fig-hatch", { x1: gx, y1: y - 2 + d, x2: gx + side * 7, y2: y - 7 + d }));
      }
      return g;
    },
    30,
  );
}

/**
 * Cross-section with dimension lines, drawn centred at `c` with `k` world
 * units per cm. Kinds (dims in cm):
 *   { kind: "rect", b, h }   { kind: "circle", d }   { kind: "tube", D, t }
 *   { kind: "I", B, H, tf, tw }   (symmetric I, flanges B×tf, web tw)
 *   { kind: "T", B, tf, hw, tw }  (flange on top, web below)
 * `unit`: the text after the numbers in the dimension labels.
 */
export function section(f, sec, c, k, { unit = "cm", axis = true } = {}) {
  const [cx, cy] = c;
  const P = (x, y) => [cx + x * k, cy + y * k];
  const lab = (v) => `${num(v)} ${unit}`.trim();
  if (sec.kind === "rect") {
    const { b, h } = sec;
    f.polygon([P(-b / 2, -h / 2), P(b / 2, -h / 2), P(b / 2, h / 2), P(-b / 2, h / 2)]);
    f.dim(P(-b / 2, -h / 2), P(b / 2, -h / 2), `b = ${lab(b)}`, 20);
    f.dim(P(b / 2, -h / 2), P(b / 2, h / 2), `h = ${lab(h)}`, 20);
  } else if (sec.kind === "circle") {
    f.circle(c, (sec.d / 2) * k);
    f.dim(P(-sec.d / 2, -sec.d / 2), P(sec.d / 2, -sec.d / 2), `d = ${lab(sec.d)}`, 16);
  } else if (sec.kind === "tube") {
    f.circle(c, (sec.D / 2) * k);
    f.circle(c, (sec.D / 2 - sec.t) * k, "fig-hole");
    f.dim(P(-sec.D / 2, -sec.D / 2), P(sec.D / 2, -sec.D / 2), `D = ${lab(sec.D)}`, 18);
    f.label(P(sec.D * 0.3536, sec.D * 0.3536), `t = ${lab(sec.t)}`, { dx: 8, dy: -6, anchor: "start" });
  } else if (sec.kind === "I") {
    const { B, H, tf, tw } = sec;
    const h2 = H / 2, b2 = B / 2, w2 = tw / 2;
    f.polygon([
      P(-b2, -h2), P(b2, -h2), P(b2, -h2 + tf), P(w2, -h2 + tf), P(w2, h2 - tf), P(b2, h2 - tf),
      P(b2, h2), P(-b2, h2), P(-b2, h2 - tf), P(-w2, h2 - tf), P(-w2, -h2 + tf), P(-b2, -h2 + tf),
    ]);
    f.dim(P(-b2, h2), P(b2, h2), `${lab(B)}`, -18);
    f.dim(P(b2, -h2), P(b2, h2), `${lab(H)}`, 22);
    f.label(P(-b2, h2 - tf / 2), `t_f = ${num(tf)}`, { dx: -6, dy: 4, anchor: "end" });
    f.label(P(-w2, -H / 5), `t_w = ${num(tw)}`, { dx: -6, dy: 4, anchor: "end" });
  } else if (sec.kind === "T") {
    // Placed with the flange top at y = +top; c is the middle of the total height.
    const { B, tf, hw, tw } = sec;
    const H = tf + hw, h2 = H / 2, b2 = B / 2, w2 = tw / 2;
    f.polygon([P(-b2, h2), P(b2, h2), P(b2, h2 - tf), P(w2, h2 - tf), P(w2, -h2), P(-w2, -h2), P(-w2, h2 - tf), P(-b2, h2 - tf)]);
    f.dim(P(-b2, h2), P(b2, h2), `${lab(B)}`, -18);
    f.label(P(b2, h2 - tf / 2), `t_f = ${num(tf)}`, { dx: 6, dy: 4, anchor: "start" });
    f.dim(P(w2, -h2), P(w2, h2 - tf), `${lab(hw)}`, 20);
    f.label(P(-w2, -h2 + hw / 3), `t_w = ${num(tw)}`, { dx: -6, dy: 4, anchor: "end" });
  }
  if (axis) {
    const ext = (sec.kind === "circle" ? sec.d : sec.kind === "tube" ? sec.D : sec.kind === "rect" ? sec.b : sec.B) / 2 + 1.5;
    f.line(P(-ext, 0), P(ext, 0), "fig-dashed");
  }
}

