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
import { svgText, textWidth } from "../draw.js";
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

// Places tried for a value: [px out from the diagram's edge, px along the member].
const CANDIDATES = [
  ...[0, 12, -12, 22, -22, 34, -34].map((sh) => [9, sh]),
  ...[0, 12, -12, 22, -22, 34, -34].map((sh) => [24, sh]),
  ...[46, -46, 60, -60].flatMap((sh) => [[9, sh], [24, sh]]),
  ...[0, 12, -12, 24, -24, 46, -46].map((sh) => [40, sh]),
];
const NEAR = 14;

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
        const curve = [], samples = [];
        for (let q = 0; q <= N; q++) {
          const sv = s0 + ((s1 - s0) * q) / N;
          const v = m.at(sv, q === N ? "-" : "+")[kind.key];
          curve.push(at(sv, v));
          samples.push({ sv, v });
        }
        polys.push([base(s0), ...curve, base(s1)]);
        // One sign in each area: a field whose diagram crosses zero has a
        // positive and a negative area, each marked.
        const lobes = [];
        for (const smp of samples) {
          if (Math.abs(smp.v) <= 1e-9 * Math.max(1, maxAbs)) continue;
          const last = lobes[lobes.length - 1];
          if (last && Math.sign(last.peak.v) === Math.sign(smp.v)) {
            last.to = smp.sv;
            if (Math.abs(smp.v) > Math.abs(last.peak.v)) last.peak = smp;
          } else lobes.push({ from: smp.sv, to: smp.sv, peak: smp });
        }
        for (const { from, to, peak } of lobes) {
          if (Math.abs(peak.v) <= 0.04 * maxAbs) continue;
          // The sign inside the area: at the peak, but not right at a
          // segment's end (it would sit on the closing line, by a node's name).
          const a0 = lobes.length > 1 ? from : s0, a1 = lobes.length > 1 ? to : s1;
          const sIn = Math.min(a1 - 0.3 * (a1 - a0), Math.max(a0 + 0.3 * (a1 - a0), peak.sv));
          const vIn = m.at(sIn, "+")[kind.key];
          const use = Math.sign(vIn) === Math.sign(peak.v) && Math.abs(vIn) > 0.3 * Math.abs(peak.v) ? { v: vIn, sv: sIn } : peak;
          signs.push({ base: base(use.sv), tip: at(use.sv, use.v), sign: peak.v > 0 ? "+" : "−", along: m.e });
        }
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
  const scaleOf = (w, h, aspect = 1.05) => Math.min(1 / w, aspect / h);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const tallBetter = scaleOf(Math.max(...ws), sum(hs) + 2 * gap) > scaleOf(sum(ws) + 2 * gap, Math.max(...hs));
  // A phone's box is much taller than wide: there, stacked unless much smaller.
  // (Its box is about 2.4 times as tall as wide.)
  const tallOnPhone = scaleOf(Math.max(...ws), sum(hs) + 2 * gap, 2.2) > 0.75 * scaleOf(sum(ws) + 2 * gap, Math.max(...hs), 2.2);
  const layout = (stacked) => {
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
  };
  f.byWidth(
    500,
    (g) => {
      layout(tallOnPhone);
      drawPanels(g);
    },
    (g) => {
      layout(tallBetter);
      drawPanels(g);
    },
  );

  // 3. Draw (into either layout; the offsets are read when called).
  function drawPanels(f) {
    const offs = panels.map((pn) => [...pn.off]); // this layout's (pn.off changes with the other one)
    const Ps = offs.map((off) => (p) => [p[0] + off[0], p[1] + off[1]]);
    panels.forEach((pn, i) => {
      for (const poly of pn.polys) f.polygon(poly.map(Ps[i]), `fig-diagram.${pn.kind.cls}`);
      for (const m of mrs) f.line(Ps[i](m.A), Ps[i](m.B), "fig-rope");
    });
    const anchorPts = panels.flatMap((pn, i) => [Ps[i]([pn.bb.x0, pn.bb.y0]), Ps[i]([pn.bb.x1, pn.bb.y1])]);
    // Titles, signs, names and values of all three in one draw call, so they
    // avoid each other (also across panels: a value never strays into the
    // next diagram, where it would read as one of its values).
    f.custom(anchorPts, (T) => {
      const g = s("g");
      const boxes = [];
      const hits = (b) => boxes.filter((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0).length;
      const hit = (b) => hits(b) > 0;
      // The frame's lines in screen space: a text on one is hard to read (a minus sign vanishes).
      const segs = panels.flatMap((pn, i) => mrs.map((m) => [Ps[i](m.A), Ps[i](m.B)].map((p) => [T.X(p[0]), T.Y(p[1])])));
      const onLine = (b, m = 2) =>
        segs.some(([a, c]) => {
          const n = Math.max(2, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / 2));
          for (let k = 0; k <= n; k++) {
            const x = a[0] + ((c[0] - a[0]) * k) / n, y = a[1] + ((c[1] - a[1]) * k) / n;
            if (x > b.x0 - m && x < b.x1 + m && y > b.y0 - m && y < b.y1 + m) return true;
          }
          return false;
        });
      const fig = { x0: 1, x1: T.width - 1, y0: 1, y1: T.height - 1 };
      const within = (b, r) => b.x0 >= r.x0 && b.x1 <= r.x1 && b.y0 >= r.y0 && b.y1 <= r.y1;
      // Of `cands` (boxes, best first), the one with the least cost: on
      // another text worst (after leaving the picture), then on a line.
      const choose = (cands, extra = () => 0) => {
        let best = null;
        cands.forEach((b, k) => {
          const cost = k * 0.01 + (within(b, fig) ? 0 : 1000) + 100 * hits(b) + (onLine(b, -1) ? 10 : onLine(b) ? 2 : 0) + extra(b, k);
          if (!best || cost < best.cost) best = { b, cost };
        });
        boxes.push(best.b);
        return best.b;
      };
      const expected = [];
      panels.forEach((pn, i) => {
        const P = Ps[i];
        const S = (p) => [T.X(P(p)[0]), T.Y(P(p)[1])];
        // The panel's own region: its drawing and half the gap around it.
        const lo = P([pn.bb.x0 - gap / 2, pn.bb.y0 - gap / 2]), hi = P([pn.bb.x1 + gap / 2, pn.bb.y1 + gap / 2]);
        const region = { x0: T.X(lo[0]), x1: T.X(hi[0]), y0: T.Y(hi[1]), y1: T.Y(lo[1]) };
        // Signs inside their area, off the frame's line: halfway out, or
        // (a thin area) just past its outline; moved a little along the member off another sign.
        for (const sg of pn.signs) {
          const [bx, by] = S(sg.base), [tx, ty] = S(sg.tip);
          const len = Math.hypot(tx - bx, ty - by);
          if (len < 1e-6) continue;
          const ux = (tx - bx) / len, uy = (ty - by) / len;
          const ax = sg.along[0], ay = -sg.along[1];
          const outs = len >= 20 ? [len / 2, len / 2 + 4, len / 2 - 4] : [len / 2, len + 9, 10];
          const cands = [];
          for (const out of outs)
            for (const shift of [0, 8, -8, 16, -16]) {
              const x = bx + ux * out + ax * shift, y = by + uy * out + ay * shift;
              cands.push({ x0: x - 6, x1: x + 6, y0: y - 7, y1: y + 6, x, y });
            }
          const b = choose(cands);
          g.append(s("text.fig-value", { x: b.x, y: b.y + 4, "text-anchor": "middle", "font-size": "15px", text: sg.sign === "+" ? "⊕" : "⊖" }));
        }
        for (const [nm, label] of Object.entries(names)) {
          const p = nodes[nm];
          if (!p) continue;
          const [px, py] = S(p);
          const w = textWidth(label) / 2 + 1;
          const cands = [[-12, 15], [12, 15], [-12, -5], [12, -5], [-20, 5], [20, 5], [0, 19], [0, -9], [-16, 19], [16, 19], [-16, -9], [16, -9]]
            .map(([dx, dy]) => ({ x: px + dx, y: py + dy }))
            .map(({ x, y }) => ({ x0: x - w, x1: x + w, y0: y - 11, y1: y + 2, x, y }));
          const b = choose(cands);
          g.append(svgText(b.x, b.y, label, { class: "fig-name", "text-anchor": "middle" }));
        }
        const shown = [];
        for (const lb of pn.labels) {
          const [px, py] = S(lb.p);
          // The same value at (nearly) the same place is written once.
          if (shown.some((o) => o.text === lb.text && Math.hypot(o.x - px, o.y - py) < 30)) continue;
          shown.push({ text: lb.text, x: px, y: py });
          expected.push(lb.text);
          const sx = lb.dir[0], sy = -lb.dir[1];
          const w = textWidth(lb.text, 11) + 3, h = 12;
          // Always drawn, at the least bad place: in the picture, off the
          // other texts, off the lines, in its panel, near its point.
          const cands = CANDIDATES.map(([out, shift]) => {
            const cx = px + sx * out + lb.along[0] * shift, cy = py + sy * out - lb.along[1] * shift;
            const bx = sx > 0.4 ? cx : sx < -0.4 ? cx - w : cx - w / 2;
            const by = sy > 0.4 ? cy : sy < -0.4 ? cy - h : cy - h / 2;
            return { x0: bx, x1: bx + w, y0: by, y1: by + h };
          });
          const b = choose(cands, (b, k) => (within(b, region) ? 0 : 20) + (k >= NEAR ? 3 : 0));
          g.append(s("text.fig-value", { x: b.x0 + 1, y: b.y1 - 2, text: lb.text }));
        }
      });
      // The titles last, where the values left room: above the panel's
      // top left corner, or a row higher, or beside it (with a margin: a
      // value just beside a title would read as part of it).
      panels.forEach((pn, i) => {
        const [lx, ty] = [T.X(Ps[i]([pn.bb.x0, 0])[0]), T.Y(Ps[i]([0, pn.bb.y1])[1])];
        const rx = T.X(Ps[i]([pn.bb.x1, 0])[0]), by = T.Y(Ps[i]([0, pn.bb.y0])[1]);
        const title = `${pn.kind.key} [${pn.unit}]`;
        const w = textWidth(title) + 4;
        const at = [[lx - 14, ty - 12], [lx - 14, ty - 26], [lx - 22 - w, ty + 4], [(lx + rx) / 2 - w / 2, ty - 12], [rx + 14 - w, ty - 12], [lx - 14, by + 26], [lx - 22 - w, ty - 12], [rx + 22, ty + 4], [rx + 22, ty - 12], [lx - 14, ty - 40], [lx - 22 - w, (ty + by) / 2], [rx + 22, (ty + by) / 2], [lx - 22 - w, by], [rx + 22, by]];
        const b = choose(at.map(([x, y]) => ({ x0: x - 6, x1: x + w + 6, y0: y - 13, y1: y + 4, x, y })), (b) => {
          const r = { x0: T.X(Ps[i]([pn.bb.x0 - gap / 2, 0])[0]), x1: T.X(Ps[i]([pn.bb.x1 + gap / 2, 0])[0]), y0: T.Y(Ps[i]([0, pn.bb.y1 + gap / 2])[1]), y1: T.Y(Ps[i]([0, pn.bb.y0 - gap / 2])[1]) };
          return within(b, r) ? 0 : 20;
        });
        g.append(svgText(b.x, b.y, title, { class: "fig-name", "font-weight": 700 }));
      });
      // What must be there (checked by test/figures-layout.test.mjs).
      g.setAttribute("data-values", JSON.stringify(expected));
      return g;
    }, 54); // (the values reach a bit past the drawing's edge)
  }
}
