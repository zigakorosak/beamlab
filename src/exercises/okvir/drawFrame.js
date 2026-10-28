// Drawing helpers for frames (okvirji), built on the figure kit:
//   dashedFibre   the dashed fibre (črtkano vlakno) beside a member
//   bar           a two-force bar / rope from a node to a wall pin
//   drawDiagrams  the N, T and M diagrams of a solved frame, three small
//                 copies of the frame side by side (or stacked), drawn as
//                 on the exam's solution sheets: N and T positive on the
//                 side away from the dashed fibre, M on the tension side
//                 (positive M towards the dashed fibre), ⊕ / ⊖ in each
//                 field, values at the ends, jumps and extremes.

import { s } from "../../render/svg.js";
import { svgText } from "../draw.js";
import { num } from "../kit.js";
import { keyValues } from "./frame.js";

/** Dashed line `px` pixels beside a→b, on the side of the world normal n. */
export function dashedFibre(f, a, b, n, px = 7) {
  f.custom([a, b], (T) => {
    const x1 = T.X(a[0]), y1 = T.Y(a[1]), x2 = T.X(b[0]), y2 = T.Y(b[1]);
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const nx = n[0] * px, ny = -n[1] * px; // screen y is down
    const cut = Math.min(8, len / 4);
    return s("line.fig-dashed", { x1: x1 + ux * cut + nx, y1: y1 + uy * cut + ny, x2: x2 - ux * cut + nx, y2: y2 - uy * cut + ny });
  });
}

/** A two-force bar from node p to a pin on a wall at q (hinges at both ends). */
export function bar(f, p, q, wallAngle) {
  f.line(p, q, "fig-rope");
  f.custom([p, q], (T) => {
    const x1 = T.X(p[0]), y1 = T.Y(p[1]), x2 = T.X(q[0]), y2 = T.Y(q[1]);
    // A thin double line, so it reads as a bar, not a rope.
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = (-(y2 - y1) / len) * 2.2, ny = ((x2 - x1) / len) * 2.2;
    return s("g", {}, s("line.fig-rope", { x1: x1 + nx, y1: y1 + ny, x2: x2 + nx, y2: y2 + ny }), s("line.fig-rope", { x1: x1 - nx, y1: y1 - ny, x2: x2 - nx, y2: y2 - ny }));
  });
  f.pin(q, wallAngle);
  f.hinge(q);
  f.hinge(p);
}

const KINDS = [
  { key: "N", unit: "kN", cls: "diag-n", toward: -1 },
  { key: "T", unit: "kN", cls: "diag-t", toward: -1 },
  { key: "M", unit: "kNm", cls: "diag-m", toward: 1 },
];

/**
 * The three diagrams. `names`: { node: label } to print at the nodes;
 * `units`: override, e.g. { N: "N", T: "N", M: "Nm" }.
 */
export function drawDiagrams(f, sol, { names = {}, units = {}, nodes = {} } = {}) {
  const mrs = Object.values(sol.members);
  const pts = mrs.flatMap((m) => [m.A, m.B]);
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
  const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  const size = Math.max(x1 - x0, y1 - y0, 1);
  const D = 0.22 * size; // the largest ordinate, in world units
  const gap = 0.45 * size;

  // 1. Each diagram in the frame's own coordinates.
  const panels = KINDS.map((kind) => {
    const keyed = mrs.map((m) => ({ m, keys: keyValues(m) }));
    const maxAbs = Math.max(1e-9, ...keyed.flatMap(({ keys }) => keys.map((k) => Math.abs(k[kind.key]))));
    const k = maxAbs > 1e-6 ? D / maxAbs : 0;
    const polys = [], labels = [], signs = [];
    for (const { m, keys } of keyed) {
      const dir = [m.n[0] * kind.toward, m.n[1] * kind.toward];
      const at = (sv, v) => [m.A[0] + m.e[0] * sv + dir[0] * v * k, m.A[1] + m.e[1] * sv + dir[1] * v * k];
      const base = (sv) => [m.A[0] + m.e[0] * sv, m.A[1] + m.e[1] * sv];
      for (let j = 0; j + 1 < m.breaks.length; j++) {
        const s0 = m.breaks[j], s1 = m.breaks[j + 1];
        const N = 24;
        const curve = [];
        let peak = { v: 0, sv: (s0 + s1) / 2 };
        for (let q = 0; q <= N; q++) {
          const sv = s0 + ((s1 - s0) * q) / N;
          const v = m.at(sv, q === N ? "-" : "+")[kind.key];
          curve.push(at(sv, v));
          if (Math.abs(v) > Math.abs(peak.v)) peak = { v, sv };
        }
        polys.push([base(s0), ...curve, base(s1)]);
        if (Math.abs(peak.v) > 0.04 * maxAbs) signs.push({ p: at(peak.sv, peak.v / 2), sign: peak.v > 0 ? "+" : "−" });
      }
      for (const kv of keys) {
        const v = kv[kind.key];
        if (Math.abs(v) < 1e-6 * Math.max(1, maxAbs)) continue;
        labels.push({ p: at(kv.s, v), dir: [dir[0] * Math.sign(v), dir[1] * Math.sign(v)], text: num(v), along: m.e });
      }
    }
    const all = [...pts, ...polys.flat()];
    const bb = { x0: Math.min(...all.map((p) => p[0])), x1: Math.max(...all.map((p) => p[0])), y0: Math.min(...all.map((p) => p[1])), y1: Math.max(...all.map((p) => p[1])) };
    return { kind, polys, labels, signs, bb, unit: units[kind.key] ?? kind.unit };
  });

  // 2. Side by side or stacked: whichever gives the bigger drawing in a
  // roughly square box (the solution figure is about as tall as wide).
  const ws = panels.map((p) => p.bb.x1 - p.bb.x0 + gap / 2), hs = panels.map((p) => p.bb.y1 - p.bb.y0 + gap / 2);
  const scaleOf = (w, h) => Math.min(1 / w, 1.05 / h);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const stacked = scaleOf(Math.max(...ws), sum(hs) + 2 * gap) > scaleOf(sum(ws) + 2 * gap, Math.max(...hs));
  let cursor = 0;
  for (const pn of panels) {
    if (stacked) {
      pn.off = [0, cursor - pn.bb.y1];
      cursor -= pn.bb.y1 - pn.bb.y0 + gap;
    } else {
      pn.off = [cursor - pn.bb.x0, 0];
      cursor += pn.bb.x1 - pn.bb.x0 + gap;
    }
  }

  // 3. Draw.
  for (const pn of panels) {
    const P = (p) => [p[0] + pn.off[0], p[1] + pn.off[1]];
    for (const poly of pn.polys) f.polygon(poly.map(P), `fig-diagram.${pn.kind.cls}`);
    for (const m of mrs) f.line(P(m.A), P(m.B), "fig-rope");
    const corner = P([pn.bb.x0, pn.bb.y1]);
    const anchorPts = [P([pn.bb.x0, pn.bb.y0]), P([pn.bb.x1, pn.bb.y1])];
    // Names, title, signs and values in one draw call, so they can avoid each other.
    f.custom(anchorPts, (T) => {
      const g = s("g");
      const boxes = [];
      const hit = (b) => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
      const tx = T.X(corner[0]) - 14, ty = T.Y(corner[1]) - 12;
      const title = `${pn.kind.key} [${pn.unit}]`;
      g.append(svgText(tx, ty, title, { class: "fig-name", "font-weight": 700 }));
      boxes.push({ x0: tx, x1: tx + title.length * 8, y0: ty - 13, y1: ty + 3 });
      for (const [nm, label] of Object.entries(names)) {
        const p = nodes[nm];
        if (!p) continue;
        const x = T.X(P(p)[0]) - 12, y = T.Y(P(p)[1]) + 15;
        g.append(svgText(x, y, label, { class: "fig-name", "text-anchor": "middle" }));
        boxes.push({ x0: x - 5, x1: x + 5, y0: y - 11, y1: y + 2 });
      }
      for (const sg of pn.signs) {
        const x = T.X(P(sg.p)[0]), y = T.Y(P(sg.p)[1]);
        g.append(s("text.fig-value", { x, y: y + 5, "text-anchor": "middle", "font-size": "15px", text: sg.sign === "+" ? "⊕" : "⊖" }));
        boxes.push({ x0: x - 6, x1: x + 6, y0: y - 7, y1: y + 7 });
      }
      const shown = [];
      for (const lb of pn.labels) {
        const px = T.X(P(lb.p)[0]), py = T.Y(P(lb.p)[1]);
        // The same value at (nearly) the same place is written once.
        if (shown.some((o) => o.text === lb.text && Math.hypot(o.x - px, o.y - py) < 30)) continue;
        const sx = lb.dir[0], sy = -lb.dir[1];
        const w = lb.text.length * 6.4 + 2, h = 12;
        let placed = null;
        for (const shift of [0, 12, -12, 22, -22, 34, -34]) {
          const cx = px + sx * 9 + lb.along[0] * shift, cy = py + sy * 9 - lb.along[1] * shift;
          const bx = sx > 0.4 ? cx : sx < -0.4 ? cx - w : cx - w / 2;
          const by = sy > 0.4 ? cy : sy < -0.4 ? cy - h : cy - h / 2;
          const b = { x0: bx, x1: bx + w, y0: by, y1: by + h };
          if (!hit(b)) {
            placed = b;
            break;
          }
        }
        if (!placed) continue;
        boxes.push(placed);
        shown.push({ text: lb.text, x: px, y: py });
        g.append(s("text.fig-value", { x: placed.x0 + 1, y: placed.y1 - 2, text: lb.text }));
      }
      return g;
    }, 44);
  }
}
