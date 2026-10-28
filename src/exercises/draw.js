// Exam-style figures: a little vocabulary of what the exam sheets draw
// (members, ropes, hatched ground, pin / roller / clamped supports, force
// arrows, distributed loads, dimension lines, angle arcs, labels).
//
// Shapes are given in world units (metres, or cm for a cross-section),
// y up. Arrows, supports and text have fixed pixel sizes, so each shape is
// stored as a closure and drawn once the scale is known:
//
//   const f = figure();
//   f.member([0, 0], [4, 0]);
//   f.pin([0, 0]);
//   f.force([4, 0], -90, { label: "F = 10 kN" });
//   f.dim([0, 0], [4, 0], "4 m", -30);
//   svg = f.render(width, maxHeight);

import { s, arrowHead } from "../render/svg.js";
import { rad, richParts } from "./kit.js";

const PAD = 46; // px around the drawing for arrows and labels

/** Characters a label shows (markup removed). */
const plainLength = (text) => richParts(String(text)).reduce((n, [t]) => n + t.length, 0);

/** Room (px per side) a text at offset (dx, dy) needs: ~6.5 px per character at 12–13 px. */
function textPad(text, dx, dy, anchor) {
  const w = plainLength(text) * 6.5;
  const left = anchor === "end" ? w - dx : anchor === "middle" ? w / 2 - dx : -dx;
  const right = anchor === "start" ? w + dx : anchor === "middle" ? w / 2 + dx : dx;
  return { l: Math.max(8, left + 4), r: Math.max(8, right + 4), t: Math.max(16, 16 - dy), b: Math.max(8, dy + 6) };
}

/** Text with sub/superscripts as an SVG <text>. */
export function svgText(x, y, text, attrs = {}) {
  const t = s("text", { x, y, ...attrs });
  for (const [part, kind] of richParts(String(text))) {
    if (!kind) t.append(s("tspan", { text: part }));
    else {
      t.append(s("tspan", { text: part, "baseline-shift": kind === "sub" ? "-25%" : "40%", "font-size": "75%" }));
      // A zero-width spacer returns to the baseline in every browser.
      t.append(s("tspan", { text: "​" }));
    }
  }
  return t;
}

export function figure() {
  const items = [];
  const add = (pts, draw, pad = 0) => items.push({ pts, draw, pad });

  // Unit vector of a math angle in degrees, in screen space (y down).
  const dirPx = (angle) => [Math.cos(rad(angle)), -Math.sin(rad(angle))];

  const api = {
    /** A structural member: thick line. */
    member(a, b, cls = "") {
      add([a, b], (T) => s(`line.fig-member${cls ? "." + cls : ""}`, { x1: T.X(a[0]), y1: T.Y(a[1]), x2: T.X(b[0]), y2: T.Y(b[1]) }));
    },
    /** Thin line (rope, cable, construction line with cls "fig-thin"). */
    line(a, b, cls = "fig-rope") {
      add([a, b], (T) => s(`line.${cls}`, { x1: T.X(a[0]), y1: T.Y(a[1]), x2: T.X(b[0]), y2: T.Y(b[1]) }));
    },
    dashed(a, b) {
      api.line(a, b, "fig-dashed");
    },
    polyline(pts, cls = "fig-rope") {
      add(pts, (T) => s(`polyline.${cls}`, { points: pts.map((p) => `${T.X(p[0])},${T.Y(p[1])}`).join(" ") }));
    },
    /** A filled body (block, section part, …). */
    polygon(pts, cls = "fig-body") {
      add(pts, (T) => s(`polygon.${cls}`, { points: pts.map((p) => `${T.X(p[0])},${T.Y(p[1])}`).join(" ") }));
    },
    rect(x, y, w, h, cls = "fig-body") {
      api.polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], cls);
    },
    circle(c, r, cls = "fig-body") {
      add([[c[0] - r, c[1] - r], [c[0] + r, c[1] + r]], (T) => s(`circle.${cls}`, { cx: T.X(c[0]), cy: T.Y(c[1]), r: r * T.ppm }));
    },
    /** Circular arc from angle a0 to a1 (degrees, counterclockwise). */
    arc(c, r, a0, a1, cls = "fig-rope") {
      const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 5));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = rad(a0 + ((a1 - a0) * i) / n);
        pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
      }
      api.polyline(pts, cls);
    },
    /** Closed region bounded by an arc and its chord (half-cylinder etc.). */
    sector(c, r, a0, a1, cls = "fig-body", withCentre = false) {
      const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 5));
      const pts = withCentre ? [c] : [];
      for (let i = 0; i <= n; i++) {
        const a = rad(a0 + ((a1 - a0) * i) / n);
        pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
      }
      api.polygon(pts, cls);
    },
    /** Hatched ground or wall along a→b; the hatch is on the right of a→b. */
    ground(a, b) {
      add([a, b], (T) => {
        const x1 = T.X(a[0]), y1 = T.Y(a[1]), x2 = T.X(b[0]), y2 = T.Y(b[1]);
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
        // Right of the direction a→b, on screen (y down) that's (−uy, ux).
        const nx = -uy, ny = ux;
        const g = s("g.fig-ground", {}, s("line", { x1, y1, x2, y2 }));
        for (let d = 4; d < len; d += 9) {
          const px = x1 + ux * d, py = y1 + uy * d;
          g.append(s("line.fig-hatch", { x1: px, y1: py, x2: px + nx * 8 - ux * 6, y2: py + ny * 8 - uy * 6 }));
        }
        return g;
      });
    },
    /**
     * Fixed pin support at p. `angle` is the direction from the ground to
     * the pin (90 = ground below, 270 = hanging from a ceiling, 0 = wall on
     * the left).
     */
    pin(p, angle = 90) {
      add([p], (T) => support(T, p, angle, false), 34);
    },
    /** Roller (pomična podpora): reaction only along `angle`. */
    roller(p, angle = 90) {
      add([p], (T) => support(T, p, angle, true), 34);
    },
    /** Clamped end (vpetje): wall through p, perpendicular to `angle`. */
    fixed(p, angle = 180) {
      // `angle`: direction from the wall into the member (180 = wall on the right of p… member going left).
      add([p], (T) => {
        const [dx, dy] = dirPx(angle);
        const nx = -dy, ny = dx;
        const x = T.X(p[0]), y = T.Y(p[1]);
        const g = s("g.fig-support", {}, s("line", { x1: x - nx * 18, y1: y - ny * 18, x2: x + nx * 18, y2: y + ny * 18, class: "fig-wall" }));
        for (let d = -16; d <= 16; d += 7) {
          const px = x + nx * d, py = y + ny * d;
          g.append(s("line.fig-hatch", { x1: px, y1: py, x2: px - dx * 8 + nx * 5, y2: py - dy * 8 + ny * 5 }));
        }
        return g;
      }, 26);
    },
    /** Internal hinge / joint: small open circle. */
    hinge(p) {
      add([p], (T) => s("circle.fig-hinge", { cx: T.X(p[0]), cy: T.Y(p[1]), r: 4.5 }), 8);
    },
    /** A dot with a name next to it ("A", "O"…). */
    point(p, name, { dx = 8, dy = -8, anchor = "start", dot = true } = {}) {
      add([p], (T) =>
        s("g", {}, dot ? s("circle.fig-dot", { cx: T.X(p[0]), cy: T.Y(p[1]), r: 2.6 }) : null, svgText(T.X(p[0]) + dx, T.Y(p[1]) + dy, name, { class: "fig-name", "text-anchor": anchor })),
      textPad(name, dx, dy, anchor));
    },
    /** Free text at a world point, offset in px. */
    label(p, text, { dx = 0, dy = 0, anchor = "middle", cls = "fig-label" } = {}) {
      add([p], (T) => svgText(T.X(p[0]) + dx, T.Y(p[1]) + dy, text, { class: cls, "text-anchor": anchor }), textPad(text, dx, dy, anchor));
    },
    /**
     * Force arrow pointing in direction `angle` (degrees, math sense).
     * By default the tip touches p; `tail: true` starts the arrow at p.
     */
    force(p, angle, { label, len: lenPx = 52, world, tail = false, cls = "fig-force", labelSide = 1, labelAt = "side" } = {}) {
      // `world`: the arrow's length in world units instead of pixels.
      const pts = [p];
      if (world) pts.push([p[0] + (tail ? 1 : -1) * world * Math.cos(rad(angle)), p[1] + (tail ? 1 : -1) * world * Math.sin(rad(angle))]);
      add(pts, (T) => {
        const len = world ? world * T.ppm : lenPx;
        const [ux, uy] = dirPx(angle);
        const x = T.X(p[0]), y = T.Y(p[1]);
        const [tx, ty] = tail ? [x + ux * len, y + uy * len] : [x, y];
        const [sx, sy] = tail ? [x, y] : [x - ux * len, y - uy * len];
        const g = s(`g.${cls}`, {}, s("line", { x1: sx, y1: sy, x2: tx - ux * 6, y2: ty - uy * 6 }), arrowHead(tx, ty, ux, uy, 10));
        if (label && labelAt === "end") {
          // Past the far end of the arrow (the tip for `tail`, else the tail).
          const [ex, ey] = tail ? [tx + ux * 10, ty + uy * 10] : [sx - ux * 10, sy - uy * 10];
          const dir = tail ? 1 : -1;
          const anchor = ux * dir > 0.35 ? "start" : ux * dir < -0.35 ? "end" : "middle";
          g.append(svgText(ex, ey + (uy * dir > 0.35 ? 12 : uy * dir < -0.35 ? -4 : 4), label, { class: "fig-force-label", "text-anchor": anchor }));
        } else if (label) {
          // Beside the middle of the shaft, on the left of its direction.
          const mx = (sx + tx) / 2 + uy * 12 * labelSide, my = (sy + ty) / 2 - ux * 12 * labelSide;
          const anchor = Math.abs(uy) > 0.5 ? (labelSide * uy > 0 ? "start" : "end") : "middle";
          g.append(svgText(mx, my + (Math.abs(uy) > 0.5 ? 4 : uy * -2 + (ux * labelSide > 0 ? -2 : 12)), label, { class: "fig-force-label", "text-anchor": anchor }));
        }
        return g;
      }, (world ? 30 : lenPx + 30) + (label && labelAt === "end" ? plainLength(label) * 6.5 : 0));
    },
    /** Point moment (couple) as a curved arrow around p. */
    moment(p, ccw, label) {
      add([p], (T) => {
        const x = T.X(p[0]), y = T.Y(p[1]), r = 16;
        const a0 = rad(ccw ? -50 : 230), a1 = rad(ccw ? 200 : -20);
        const P = (a) => [x + r * Math.cos(a), y - r * Math.sin(a)];
        const [x0, y0] = P(a0), [x1, y1] = P(a1);
        const tan = ccw ? [-Math.sin(a1), -Math.cos(a1)] : [Math.sin(a1), Math.cos(a1)];
        return s("g.fig-force", {}, s("path", { d: `M${x0} ${y0} A${r} ${r} 0 1 ${ccw ? 0 : 1} ${x1} ${y1}`, fill: "none" }), arrowHead(x1 + tan[0] * 4, y1 + tan[1] * 4, tan[0], tan[1], 9), label ? svgText(x + r + 5, y - r - 2, label, { class: "fig-force-label" }) : null);
      }, label ? { l: 44, r: 44 + plainLength(label) * 6.5, t: 44, b: 44 } : 44);
    },
    /**
     * Distributed load on the segment a→b: arrows in direction `angle`
     * (default straight down) ending on the segment, their tails joined.
     * `h0`, `h1`: arrow lengths (px) at a and b, for a triangular load.
     */
    dist(a, b, { label, angle = -90, h0 = 26, h1 = h0 } = {}) {
      add([a, b], (T) => {
        const [ux, uy] = dirPx(angle);
        const x1 = T.X(a[0]), y1 = T.Y(a[1]), x2 = T.X(b[0]), y2 = T.Y(b[1]);
        const len = Math.hypot(x2 - x1, y2 - y1);
        const n = Math.max(2, Math.round(len / 16));
        const g = s("g.fig-load");
        const tails = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
          const h = h0 + (h1 - h0) * t;
          tails.push([x - ux * h, y - uy * h]);
          if (h > 3) g.append(s("line", { x1: x - ux * h, y1: y - uy * h, x2: x - ux * 5, y2: y - uy * 5 }), arrowHead(x, y, ux, uy, 7));
        }
        g.append(s("polyline", { points: tails.map((p) => p.join(",")).join(" "), fill: "none" }));
        if (label) {
          const m = tails[Math.floor(tails.length / 2)];
          g.append(svgText(m[0] - ux * 12, m[1] - uy * 12 + 4, label, { class: "fig-force-label", "text-anchor": "middle" }));
        }
        return g;
      }, Math.max(h0, h1) + 26);
    },
    /** Dimension line between a and b, offset sideways by `off` px: positive = right of a→b on screen (below a left-to-right one), negative = above it. */
    dim(a, b, text, off = -26) {
      add([a, b], (T) => {
        const x1 = T.X(a[0]), y1 = T.Y(a[1]), x2 = T.X(b[0]), y2 = T.Y(b[1]);
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
        const nx = uy, ny = -ux; // left of a→b on screen
        const ox = nx * -off, oy = ny * -off;
        const ax = x1 + ox, ay = y1 + oy, bx = x2 + ox, by = y2 + oy;
        const g = s(
          "g.fig-dim",
          {},
          s("line", { x1: x1 + ox * 0.15, y1: y1 + oy * 0.15, x2: ax + ox * 0.2, y2: ay + oy * 0.2 }),
          s("line", { x1: x2 + ox * 0.15, y1: y2 + oy * 0.15, x2: bx + ox * 0.2, y2: by + oy * 0.2 }),
          s("line", { x1: ax, y1: ay, x2: bx, y2: by }),
          arrowHead(ax, ay, -ux, -uy, 7),
          arrowHead(bx, by, ux, uy, 7),
        );
        let ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
        if (ang > 90) ang -= 180;
        if (ang < -90) ang += 180;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const sx = Math.sign(off || -1);
        const tx = mx + nx * 9 * -sx, ty = my + ny * 9 * -sx;
        const t = svgText(tx, ty + 4, text, { class: "fig-dim-label", "text-anchor": "middle", transform: `rotate(${ang} ${tx} ${ty})` });
        g.append(t);
        return g;
      }, Math.abs(off) + 18);
    },
    /** Angle arc at p from direction a0 to a1 (degrees, ccw), with a label. */
    angle(p, a0, a1, text, r = 30) {
      add([p], (T) => {
        const x = T.X(p[0]), y = T.Y(p[1]);
        const n = 16;
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const a = rad(a0 + ((a1 - a0) * i) / n);
          pts.push(`${x + r * Math.cos(a)},${y - r * Math.sin(a)}`);
        }
        const am = rad((a0 + a1) / 2);
        return s("g.fig-angle", {}, s("polyline", { points: pts.join(" "), fill: "none" }), text ? svgText(x + (r + 13) * Math.cos(am), y - (r + 13) * Math.sin(am) + 4, text, { class: "fig-angle-label", "text-anchor": "middle" }) : null);
      }, r + 26);
    },
    /** Coordinate axes at o (2D): x right, y up, with names. */
    axes(o, { x = "x", y = "y", len = 40 } = {}) {
      api.force(o, 0, { len, tail: true, cls: "fig-axis" });
      api.force(o, 90, { len, tail: true, cls: "fig-axis" });
      add([o], (T) => s("g.fig-axis", {}, svgText(T.X(o[0]) + len + 6, T.Y(o[1]) + 4, x), svgText(T.X(o[0]) - 4, T.Y(o[1]) - len - 6, y, { "text-anchor": "end" })), len + 14);
    },
    /** Make sure these world points are inside the picture. */
    bounds(pts) {
      add(pts, () => s("g"));
    },
    /** Raw access: draw(T) gets { X, Y, ppm } and returns an SVG element. */
    custom(pts, draw, pad = 0) {
      add(pts, draw, pad);
    },

    render(width, maxHeight = 420) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const it of items)
        for (const [x, y] of it.pts) {
          x0 = Math.min(x0, x); x1 = Math.max(x1, x);
          y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
      if (!Number.isFinite(x0)) x0 = x1 = y0 = y1 = 0;
      const w = Math.max(x1 - x0, 1e-6), h = Math.max(y1 - y0, 1e-6);
      // Each side gets the room its own pixel-sized arrows and labels need:
      // an item's padding minus how far inside the drawing it sits. That
      // depends on the scale, so settle it in a few rounds. Capped, so a
      // narrow screen still has most of its width for the drawing.
      const capX = Math.min(130, width * 0.16), capY = Math.min(130, maxHeight * 0.24);
      const clamp = (v, cap) => Math.max(14, Math.min(cap, v));
      let m = { l: PAD, r: PAD, t: PAD, b: PAD };
      let ppm = 1;
      for (let round = 0; round < 4; round++) {
        ppm = Math.min((width - m.l - m.r) / w, (maxHeight - m.t - m.b) / h, 400);
        const need = { l: 0, r: 0, t: 0, b: 0 };
        for (const it of items) {
          if (!it.pad) continue;
          // `pad`: px needed around the item's points, one number or per side.
          const pd = typeof it.pad === "number" ? { l: it.pad, r: it.pad, t: it.pad, b: it.pad } : it.pad;
          for (const [x, y] of it.pts) {
            need.l = Math.max(need.l, pd.l - (x - x0) * ppm);
            need.r = Math.max(need.r, pd.r - (x1 - x) * ppm);
            need.t = Math.max(need.t, pd.t - (y1 - y) * ppm);
            need.b = Math.max(need.b, pd.b - (y - y0) * ppm);
          }
        }
        m = { l: clamp(need.l, capX), r: clamp(need.r, capX), t: clamp(need.t, capY), b: clamp(need.b, capY) };
      }
      ppm = Math.max(1e-3, Math.min((width - m.l - m.r) / w, (maxHeight - m.t - m.b) / h, 400));
      const height = Math.min(maxHeight, h * ppm + m.t + m.b);
      const ox = m.l + (width - m.l - m.r - w * ppm) / 2, oy = m.t + (height - m.t - m.b - h * ppm) / 2;
      const T = { ppm, X: (x) => ox + (x - x0) * ppm, Y: (y) => oy + (y1 - y) * ppm };
      const svg = s("svg.fig-svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img" });
      for (const it of items) svg.append(it.draw(T));
      return svg;
    },
  };

  function support(T, p, angle, roller) {
    // Triangle with its tip at p, base towards the ground (opposite `angle`).
    const [dx, dy] = dirPx(angle); // ground → pin, on screen
    const nx = -dy, ny = dx;
    const x = T.X(p[0]), y = T.Y(p[1]);
    const hgt = 16, half = 10;
    const bx = x - dx * hgt, by = y - dy * hgt;
    const g = s("g.fig-support", {}, s("polygon", { points: `${x},${y} ${bx + nx * half},${by + ny * half} ${bx - nx * half},${by - ny * half}` }));
    let gx = bx, gy = by;
    if (roller) {
      for (const k of [-5, 5]) g.append(s("circle", { cx: bx + nx * k - dx * 3.5, cy: by + ny * k - dy * 3.5, r: 3.2 }));
      gx = bx - dx * 7;
      gy = by - dy * 7;
    }
    g.append(s("line", { x1: gx + nx * 15, y1: gy + ny * 15, x2: gx - nx * 15, y2: gy - ny * 15, class: "fig-wall" }));
    for (let d = -13; d <= 13; d += 6.5) {
      const px = gx + nx * d, py = gy + ny * d;
      g.append(s("line.fig-hatch", { x1: px, y1: py, x2: px - dx * 7 + nx * 5, y2: py - dy * 7 + ny * 5 }));
    }
    return g;
  }

  return api;
}

/**
 * Oblique projection for 3D sketches (the exams' boxes): y to the right,
 * z up, x towards the viewer drawn down-left at 210°, shortened by half.
 */
export function iso([x, y, z]) {
  const k = 0.5;
  return [y - x * k * Math.cos(rad(30)), z - x * k * Math.sin(rad(30))];
}
