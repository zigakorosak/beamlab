// Draws the beam model as SVG: beam, supports, hinges, loads, and
// optionally reactions (solved values, or named unknowns for a question),
// distributed-load resultants, a dimension line, and Build's drag handles.
//
// Every interactive part carries data-kind / data-id (and data-handle for
// handles), which Build's pointer code reads to know what was grabbed.

import { s, arrow, arrowHead, momentArc } from "./svg.js";
import { distResultant, keyPoints, supportNames } from "../core/model.js";
import { fmt } from "../core/format.js";

// Vertical layout of the model band, relative to the beam's axis.
export const MODEL_BAND = {
  height: 250,
  beamY: 118, // axis, from the band's top
  half: 5, // half the beam's drawn thickness
  rulerDy: 108, // dimension line, below the axis
};

const LOAD_ARROW = 58;
const DIST_MIN = 14;
const DIST_MAX = 46;

export function drawModel(model, opts) {
  const { X, top = 0, selectedId = null, reactions = null, unknowns = false, resultants = false, handles = false } =
    opts;
  const g = s("g.model");
  if (!model.beam) return g;
  const y = top + MODEL_BAND.beamY;
  const hb = MODEL_BAND.half;
  const L = model.beam.length;
  const names = supportNames(model);
  const sel = (id) => (id === selectedId ? ".is-selected" : "");
  // Drag handles go on top of everything, so no hit area can cover them.
  const handleEls = [];

  // ---- Distributed loads (behind everything else)
  const qMax = Math.max(1e-9, ...model.loads.filter((l) => l.type === "dist").flatMap((l) => [Math.abs(l.q1), Math.abs(l.q2)]));
  const qh = (q) => (Math.abs(q) < 1e-9 ? 0 : DIST_MIN + ((DIST_MAX - DIST_MIN) * Math.abs(q)) / qMax);
  for (const l of model.loads.filter((l) => l.type === "dist")) {
    const x1 = X(l.x1);
    const x2 = X(l.x2);
    const base = y - hb - 1;
    const h1 = qh(l.q1);
    const h2 = qh(l.q2);
    const up = l.q1 + l.q2 < 0; // an upward load: arrows point away from the beam
    const grp = s(`g.dist${sel(l.id)}`, { dataset: { kind: "load", id: l.id } });
    grp.append(
      s("path.dist-area", { d: `M${x1} ${base} L${x1} ${base - h1} L${x2} ${base - h2} L${x2} ${base} Z` }),
    );
    const n = Math.max(2, Math.round((x2 - x1) / 22));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const hx = h1 + (h2 - h1) * t;
      if (hx < 6) continue;
      const ax = x1 + (x2 - x1) * t;
      grp.append(
        up
          ? arrow(ax, base, ax, base - hx, { cls: "dist-arrow", size: 7 })
          : arrow(ax, base - hx, ax, base, { cls: "dist-arrow", size: 7 }),
      );
    }
    const label = l.q1 === l.q2 ? `${fmt(Math.abs(l.q1))} kN/m` : `${fmt(Math.abs(l.q1))} → ${fmt(Math.abs(l.q2))} kN/m`;
    grp.append(s("text.load-label", { x: (x1 + x2) / 2, y: base - Math.max(h1, h2) - 6, "text-anchor": "middle", text: label }));
    if (handles) {
      for (const [end, xx, hh] of [["1", x1, h1], ["2", x2, h2]]) {
        handleEls.push(
          s("rect.handle.dist-handle", {
            x: xx - 6,
            y: base - hh - 6,
            width: 12,
            height: 12,
            rx: 2,
            dataset: { kind: "load", id: l.id, handle: `end${end}` },
          }),
        );
      }
    }
    if (resultants) {
      const r = distResultant(l);
      if (Math.abs(r.F) > 1e-9) {
        const rx = X(r.x);
        const tipY = base - Math.max(h1, h2) - 22;
        grp.append(
          arrow(rx, tipY - 40, rx, tipY, { cls: "resultant", dashed: true, size: 8 }),
          s("text.resultant-label", { x: rx + 6, y: tipY - 28, text: `${fmt(Math.abs(r.F))} kN` }),
        );
      }
    }
    g.append(grp);
  }

  // ---- Beam
  const bx1 = X(0);
  const bx2 = X(L);
  g.append(
    s("rect.beam" + sel("beam"), {
      x: bx1,
      y: y - hb,
      width: bx2 - bx1,
      height: 2 * hb,
      rx: 2,
      dataset: { kind: "beam", id: "beam" },
    }),
  );
  if (handles) {
    for (const [end, xx] of [["start", bx1], ["end", bx2]])
      handleEls.push(s("circle.handle.beam-handle", { cx: xx, cy: y, r: 7, dataset: { kind: "beam", id: "beam", handle: end } }));
  }

  // ---- Supports
  for (const sp of model.supports) {
    const sx = X(sp.x);
    const grp = s(`g.support${sel(sp.id)}`, { dataset: { kind: "support", id: sp.id } });
    if (sp.type === "fixed") {
      const dir = sp.x < L / 2 ? -1 : 1; // wall on the outside of the end
      const wx = sx + dir * 1;
      grp.append(s("line.wall", { x1: wx, y1: y - 34, x2: wx, y2: y + 34 }));
      for (let k = -34; k < 34; k += 9) grp.append(s("line.hatch", { x1: wx, y1: k + y + 9, x2: wx + dir * 10, y2: k + y }));
      grp.append(s("rect.hit", { x: dir < 0 ? wx - 14 : wx - 4, y: y - 36, width: 18, height: 72 }));
      grp.append(s("text.support-name", { x: wx + dir * 16, y: y - 40, "text-anchor": "middle", text: names.get(sp.id) }));
    } else {
      const th = sp.type === "roller" ? 17 : 22;
      grp.append(s("path.support-tri", { d: `M${sx} ${y + hb} L${sx - 13} ${y + hb + th} L${sx + 13} ${y + hb + th} Z` }));
      let groundY = y + hb + th;
      if (sp.type === "roller") {
        grp.append(s("circle.roller", { cx: sx - 6, cy: groundY + 4, r: 3.6 }), s("circle.roller", { cx: sx + 6, cy: groundY + 4, r: 3.6 }));
        groundY += 8;
      }
      grp.append(s("line.ground", { x1: sx - 19, y1: groundY, x2: sx + 19, y2: groundY }));
      for (let k = -18; k < 18; k += 7) grp.append(s("line.hatch", { x1: sx + k, y1: groundY + 7, x2: sx + k + 7, y2: groundY }));
      grp.append(s("rect.hit", { x: sx - 20, y: y + hb, width: 40, height: th + 16 }));
      grp.append(s("text.support-name", { x: sx - 22, y: groundY - 3, "text-anchor": "end", text: names.get(sp.id) }));
    }
    g.append(grp);
  }

  // ---- Hinges
  for (const hg of model.hinges) {
    g.append(
      s(`g.hinge-g${sel(hg.id)}`, { dataset: { kind: "hinge", id: hg.id } }, s("circle.hinge", { cx: X(hg.x), cy: y, r: 6 }), s("circle.hit", { cx: X(hg.x), cy: y, r: 12 })),
    );
  }

  // ---- Point loads and moments
  for (const l of model.loads) {
    if (l.type === "point") {
      const a = (l.angle * Math.PI) / 180;
      const dx = Math.sin(a);
      const dy = Math.cos(a); // screen: down = +y
      const px = X(l.x);
      // Tip on the face the force pushes on.
      const tipY = dy > 1e-6 ? y - hb - 1 : dy < -1e-6 ? y + hb + 1 : y;
      const tipX = Math.abs(dy) < 1e-6 ? px - dx * 2 : px;
      const tx = tipX - dx * LOAD_ARROW;
      const ty = tipY - dy * LOAD_ARROW;
      g.append(
        s(
          `g.point-load${sel(l.id)}`,
          { dataset: { kind: "load", id: l.id } },
          arrow(tx, ty, tipX, tipY, { cls: "load-arrow", size: 11 }),
          s("line.hit", { x1: tx, y1: ty, x2: tipX, y2: tipY }),
          s("text.load-label", {
            x: tx + (dx < -0.2 ? -4 : 4),
            y: ty - (dy > 0 ? 6 : -14),
            "text-anchor": dx < -0.2 ? "end" : Math.abs(dx) < 0.2 ? "middle" : "start",
            text: `${fmt(l.value)} kN`,
          }),
        ),
      );
    } else if (l.type === "moment") {
      const px = X(l.x);
      g.append(
        s(
          `g.moment-load${sel(l.id)}`,
          { dataset: { kind: "load", id: l.id } },
          momentArc(px, y, 22, l.value > 0, { cls: "moment-arrow" }),
          s("circle.hit", { cx: px, cy: y, r: 26 }),
          // Under the beam: above it is where distributed loads sit.
          s("text.load-label", { x: px, y: y + 40, "text-anchor": "middle", text: `${fmt(Math.abs(l.value))} kNm` }),
        ),
      );
    }
  }

  // ---- Reactions
  if (reactions || unknowns) {
    const list = reactions ?? model.supports.map((sp) => ({ ...sp, name: names.get(sp.id) }));
    for (const r of list) {
      const rx = X(r.x);
      const grp = s("g.reaction");
      const comps = { pin: ["x", "y"], roller: ["y"], fixed: ["x", "y", "m"] }[r.type];
      const outside = r.x < L / 2 ? -1 : 1;
      for (const c of comps) {
        const val = reactions ? { x: r.Rx, y: r.Ry, m: r.M }[c] : 1;
        if (reactions && Math.abs(val) < 1e-9 && c !== "y") continue;
        const name = c === "m" ? `M${r.name}` : `${r.name}${c}`;
        const text = reactions ? `${name} = ${fmt(Math.abs(val))}${c === "m" ? " kNm" : " kN"}` : name;
        if (c === "y") {
          const y0 = y + hb + 72;
          const y1 = y + hb + 32;
          const upward = val >= 0;
          grp.append(
            upward
              ? arrow(rx, y0, rx, y1, { cls: "reaction-arrow", dashed: !reactions })
              : arrow(rx, y1, rx, y0, { cls: "reaction-arrow", dashed: !reactions }),
            s("text.reaction-label", { x: rx + 6, y: y0 - 2, text }),
          );
        } else if (c === "x") {
          // Drawn outside the support; the positive direction is → in both
          // cases, the arrow flips with the sign.
          const xa = rx + outside * 66;
          const xb = rx + outside * 20;
          const ya = y + hb + 22;
          const toRight = val >= 0;
          const [from, to] = toRight ? [Math.min(xa, xb), Math.max(xa, xb)] : [Math.max(xa, xb), Math.min(xa, xb)];
          grp.append(
            arrow(from, ya, to, ya, { cls: "reaction-arrow", dashed: !reactions }),
            s("text.reaction-label", { x: (xa + xb) / 2, y: ya - 6, "text-anchor": "middle", text }),
          );
        } else {
          const cx = rx + outside * 4;
          grp.append(
            momentArc(cx, y, 40, val >= 0, { cls: "reaction-arrow", dashed: !reactions }),
            // Below the arc, on the beam's side of the support: outside it
            // runs off the board, above it is where the loads are.
            s("text.reaction-label", { x: cx - outside * 10, y: y + 52, "text-anchor": outside < 0 ? "start" : "end", text }),
          );
        }
      }
      g.append(grp);
    }
  }

  // ---- Dimension line: every key point, segment lengths between.
  const xs = keyPoints(model);
  const ry = y + MODEL_BAND.rulerDy;
  const ruler = s("g.ruler");
  ruler.append(s("line", { x1: X(0), y1: ry, x2: X(L), y2: ry }));
  for (let i = 0; i < xs.length; i++) {
    const px = X(xs[i]);
    ruler.append(s("line", { x1: px, y1: ry - 5, x2: px, y2: ry + 5 }));
    if (i > 0) {
      const len = xs[i] - xs[i - 1];
      const w = px - X(xs[i - 1]);
      if (w > 22) ruler.append(s("text", { x: (px + X(xs[i - 1])) / 2, y: ry - 5, "text-anchor": "middle", text: fmt(len) }));
    }
  }
  ruler.append(s("text.ruler-unit", { x: X(L) + 8, y: ry + 4, text: "m" }));
  g.append(ruler, ...handleEls);
  return g;
}
