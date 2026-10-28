// Draws the beam model as SVG: beam, supports, hinges, loads, and
// optionally reactions (solved values, or named unknowns for a question),
// distributed-load resultants, a dimension line, and Build's drag handles.
//
// Every interactive part carries data-kind / data-id (and data-handle for
// handles), which Build's pointer code reads to know what was grabbed.

import { s, arrow, momentArc } from "./svg.js";
import { distPieces, keyPoints, supportNames } from "../core/model.js";
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
  const { X, top = 0, width = Infinity, selectedId = null, reactions = null, unknowns = false, resultants = false, handles = false } =
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
  // Texts are placed last (placeLabels), clear of each other, of what is
  // drawn and of the board's edges: label(parent, cls, text, places).
  const labels = [];
  const label = (parent, cls, text, places) => labels.push({ parent, cls, text, places });
  const segs = []; // [x1, y1, x2, y2]: shafts, arcs, edges a text must not cross
  const boxes = []; // { x0, y0, x1, y1 }: shapes a text must not cover
  const seg = (x1, y1, x2, y2) => segs.push([x1, y1, x2, y2]);
  const box = (x0, y0, x1, y1) => boxes.push({ x0, y0, x1, y1 });

  // ---- Distributed loads (behind everything else)
  const qMax = Math.max(1e-9, ...model.loads.filter((l) => l.type === "dist").flatMap((l) => [Math.abs(l.q1), Math.abs(l.q2)]));
  const qh = (q) => (Math.abs(q) < 1e-9 ? 0 : DIST_MIN + ((DIST_MAX - DIST_MIN) * Math.abs(q)) / qMax);
  for (const l of model.loads.filter((l) => l.type === "dist")) {
    const x1 = X(l.x1);
    const x2 = X(l.x2);
    const base = y - hb - 1;
    const h1 = qh(l.q1);
    const h2 = qh(l.q2);
    // q may change sign along the load (Build allows any q1, q2): the area
    // touches the beam where q = 0, and each arrow points the way its own q
    // acts (an upward part points away from the beam).
    const qAt = (t) => l.q1 + (l.q2 - l.q1) * t;
    const tZero = l.q1 * l.q2 < 0 ? l.q1 / (l.q1 - l.q2) : null;
    const grp = s(`g.dist${sel(l.id)}`, { dataset: { kind: "load", id: l.id } });
    const corners = [[x1, base - h1], ...(tZero === null ? [] : [[x1 + (x2 - x1) * tZero, base]]), [x2, base - h2]];
    grp.append(s("path.dist-area", { d: `M${x1} ${base} ${corners.map(([px, py]) => `L${px} ${py}`).join(" ")} L${x2} ${base} Z` }));
    const n = Math.max(2, Math.round((x2 - x1) / 22));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const hx = tZero === null ? h1 + (h2 - h1) * t : t < tZero ? (h1 * (tZero - t)) / tZero : (h2 * (t - tZero)) / (1 - tZero);
      if (hx < 6) continue;
      const ax = x1 + (x2 - x1) * t;
      seg(ax, base, ax, base - hx);
      grp.append(
        qAt(t) < 0
          ? arrow(ax, base, ax, base - hx, { cls: "dist-arrow", size: 7 })
          : arrow(ax, base - hx, ax, base, { cls: "dist-arrow", size: 7 }),
      );
    }
    // Signed only when the two ends act opposite ways; otherwise the arrows say it.
    const qText = tZero === null ? (v) => fmt(Math.abs(v)) : (v) => fmt(v);
    const qLabel = l.q1 === l.q2 ? `${qText(l.q1)} kN/m` : `${qText(l.q1)} → ${qText(l.q2)} kN/m`;
    for (let i = 1; i < corners.length; i++) seg(...corners[i - 1], ...corners[i]);
    // Over the middle of the load; else over another part of it, or past its ends.
    const ly = base - Math.max(h1, h2) - 6;
    label(grp, "load-label", qLabel, [
      ...[0.5, 0.3, 0.7, 0.15, 0.85].map((t) => [x1 + (x2 - x1) * t, ly, "middle"]),
      [x1 - 4, base - h1 - 2, "end"],
      [x2 + 4, base - h2 - 2, "start"],
      ...[0.5, 0.25, 0.75].map((t) => [x1 + (x2 - x1) * t, ly - 15, "middle"]),
    ]);
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
      // Per part where q changes sign, as in the equations (explain.js).
      for (const r of distPieces(l)) {
        const rx = X(r.x);
        const tipY = base - Math.max(h1, h2) - 22;
        seg(rx, tipY - 40, rx, tipY);
        grp.append(
          // An upward resultant (negative q) points up.
          r.F > 0
            ? arrow(rx, tipY - 40, rx, tipY, { cls: "resultant", dashed: true, size: 8 })
            : arrow(rx, tipY, rx, tipY - 40, { cls: "resultant", dashed: true, size: 8 }),
        );
        label(grp, "resultant-label", `${fmt(Math.abs(r.F))} kN`, [
          [rx + 6, tipY - 28, "start"],
          [rx - 6, tipY - 28, "end"],
          [rx + 6, tipY - 12, "start"],
          [rx - 6, tipY - 12, "end"],
          [rx, tipY - 44, "middle"],
        ]);
      }
    }
    g.append(grp);
  }

  // ---- Beam
  const bx1 = X(0);
  const bx2 = X(L);
  box(bx1, y - hb, bx2, y + hb);
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
      box(Math.min(wx, wx + dir * 10), y - 34, Math.max(wx, wx + dir * 10), y + 34);
      label(grp, "support-name", names.get(sp.id), [
        [wx + dir * 16, y - 40, "middle"],
        [wx + dir * 16, y + 50, "middle"],
        [wx + dir * 6, y - 40, "middle"],
      ]);
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
      box(sx - 19, y + hb, sx + 19, groundY + 7);
      label(grp, "support-name", names.get(sp.id), [
        [sx - 22, groundY - 3, "end"],
        [sx + 22, groundY - 3, "start"],
        [sx - 22, groundY - 17, "end"],
        [sx + 22, groundY - 17, "start"],
        [sx - 22, groundY + 11, "end"],
        [sx + 22, groundY + 11, "start"],
      ]);
    }
    g.append(grp);
  }

  // ---- Hinges
  for (const hg of model.hinges) {
    box(X(hg.x) - 7, y - 7, X(hg.x) + 7, y + 7);
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
      seg(tx, ty, tipX, tipY);
      const grp = s(
        `g.point-load${sel(l.id)}`,
        { dataset: { kind: "load", id: l.id } },
        arrow(tx, ty, tipX, tipY, { cls: "load-arrow", size: 11 }),
        s("line.hit", { x1: tx, y1: ty, x2: tipX, y2: tipY }),
      );
      const ang = inclination(l.angle, tipX, tipY, dx, dy);
      if (ang) {
        grp.append(ang.g);
        for (const sg of ang.segs) seg(...sg);
        label(grp, "load-angle-label", ang.text, ang.places);
      }
      // Past the tail (a row further out if need be); an inclined force's on
      // the side away from the angle's arc (between shaft and vertical), or
      // beside the tail.
      const out = dy >= 0 ? -1 : 1; // screen y away from the beam, on the tail's side
      const row = (k) => ty + (out < 0 ? -6 : 14) + out * 14 * k;
      const side = dx > 0.2 ? -1 : dx < -0.2 ? 1 : 0; // the side away from the arc
      const anchor = (sd) => (sd < 0 ? "end" : sd > 0 ? "start" : "middle");
      label(grp, "load-label", `${fmt(l.value)} kN`, [
        ...(side ? [0, 1].map((k) => [tx + side * 8, ty + (out < 0 ? -2 : 12) + out * 14 * k, anchor(side)]) : []),
        [tx, row(0), "middle"],
        [tx, row(1), "middle"],
        [tx + 4, row(0), "end"],
        [tx - 4, row(0), "start"],
        [tx - 6, ty - out * 10, "end"],
        [tx + 6, ty - out * 10, "start"],
        [tx, row(2), "middle"],
        [tx - 6, ty - out * 24, "end"],
        [tx + 6, ty - out * 24, "start"],
      ]);
      g.append(grp);
    } else if (l.type === "moment") {
      const px = X(l.x);
      box(px - 24, y - 26, px + 24, y + 20);
      const grp = s(
        `g.moment-load${sel(l.id)}`,
        { dataset: { kind: "load", id: l.id } },
        momentArc(px, y, 22, l.value > 0, { cls: "moment-arrow" }),
        s("circle.hit", { cx: px, cy: y, r: 26 }),
      );
      // Under the beam: above it is where distributed loads sit.
      label(grp, "load-label", `${fmt(Math.abs(l.value))} kNm`, [
        [px, y + 36, "middle"],
        [px, y + 50, "middle"],
        [px + 20, y + 32, "start"],
        [px - 20, y + 32, "end"],
        [px + 20, y + 50, "start"],
        [px - 20, y + 50, "end"],
        [px, y + 64, "middle"],
        [px + 20, y + 64, "start"],
        [px - 20, y + 64, "end"],
        [px, y - 30, "middle"],
        [px, y - 44, "middle"],
      ]);
      g.append(grp);
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
          seg(rx, y0, rx, y1);
          grp.append(
            upward
              ? arrow(rx, y0, rx, y1, { cls: "reaction-arrow", dashed: !reactions })
              : arrow(rx, y1, rx, y0, { cls: "reaction-arrow", dashed: !reactions }),
          );
          label(grp, "reaction-label", text, [
            [rx + 6, y0 - 2, "start"],
            [rx - 6, y0 - 2, "end"],
            [rx + 6, y0 - 16, "start"],
            [rx - 6, y0 - 16, "end"],
            [rx + 6, y0 + 12, "start"],
            [rx - 6, y0 + 12, "end"],
            [rx + 6, y0 - 30, "start"],
            [rx - 6, y0 - 30, "end"],
            [rx, y0 + 12, "middle"],
            [rx + 6, y0 + 26, "start"],
            [rx - 6, y0 + 26, "end"],
            [rx, y0 + 26, "middle"],
          ]);
        } else if (c === "x") {
          // Drawn outside the support; the positive direction is → in both
          // cases, the arrow flips with the sign.
          // Shorter where the board ends close by (a long beam on a phone).
          const xa = rx + outside * Math.max(36, Math.min(66, outside > 0 ? width - 2 - rx : rx - 2));
          const xb = rx + outside * 20;
          const ya = y + hb + 22;
          const toRight = val >= 0;
          const [from, to] = toRight ? [Math.min(xa, xb), Math.max(xa, xb)] : [Math.max(xa, xb), Math.min(xa, xb)];
          seg(xa, ya, xb, ya);
          grp.append(arrow(from, ya, to, ya, { cls: "reaction-arrow", dashed: !reactions }));
          label(grp, "reaction-label", text, [
            [(xa + xb) / 2, ya - 6, "middle"],
            [(xa + xb) / 2, ya + 14, "middle"],
            [xa, ya - 6, outside < 0 ? "start" : "end"],
            [xa, ya + 14, outside < 0 ? "start" : "end"],
            [(xa + xb) / 2, ya - 20, "middle"],
            [xa, ya - 20, outside < 0 ? "start" : "end"],
            [xb, ya + 28, outside < 0 ? "end" : "start"],
          ]);
        } else {
          const cx = rx + outside * 4;
          // The arc: 260° over the top, open at the bottom (svg.js): from
          // −60° to 200° counterclockwise, from −20° to 240° clockwise.
          const a0 = val >= 0 ? -60 : -20;
          for (let k = 0; k < 13; k++) {
            const a = ((a0 + k * 20) * Math.PI) / 180;
            const b = ((a0 + 20 + k * 20) * Math.PI) / 180;
            seg(cx + 40 * Math.cos(a), y - 40 * Math.sin(a), cx + 40 * Math.cos(b), y - 40 * Math.sin(b));
          }
          grp.append(momentArc(cx, y, 40, val >= 0, { cls: "reaction-arrow", dashed: !reactions }));
          // Below the arc, on the beam's side of the support: outside it
          // runs off the board, above it is where the loads are.
          const anchor = outside < 0 ? "start" : "end";
          label(grp, "reaction-label", text, [
            [cx - outside * 10, y + 52, anchor],
            [cx - outside * 10, y + 66, anchor],
            [cx - outside * 30, y + 38, anchor],
            [cx - outside * 46, y - 26, anchor],
          ]);
        }
      }
      g.append(grp);
    }
  }

  // ---- Dimension line: every key point, segment lengths between. Every
  // length is printed (it's given data): one too wide for its segment (a
  // phone) goes a row under the line, or over the row above it.
  const xs = keyPoints(model);
  const ry = y + MODEL_BAND.rulerDy;
  const ruler = s("g.ruler");
  ruler.append(s("line", { x1: X(0), y1: ry, x2: X(L), y2: ry }));
  const rows = [ry - 5, ry + 17, ry - 18];
  const fixed = [];
  const rowEnd = rows.map(() => -Infinity);
  for (let i = 0; i < xs.length; i++) {
    const px = X(xs[i]);
    ruler.append(s("line", { x1: px, y1: ry - 5, x2: px, y2: ry + 5 }));
    if (i > 0) {
      const text = fmt(xs[i] - xs[i - 1]);
      const tw = text.length * 6.5; // 11 px digits
      const cx = (px + X(xs[i - 1])) / 2;
      const fits = (r) => (r > 0 || px - X(xs[i - 1]) >= tw + 6) && cx - tw / 2 >= rowEnd[r] + 4;
      let r = [0, 1, 2].find(fits);
      if (r === undefined) r = rowEnd[1] <= rowEnd[2] ? 1 : 2;
      rowEnd[r] = cx + tw / 2;
      ruler.append(s("text", { x: cx, y: rows[r], "text-anchor": "middle", text }));
      fixed.push(textBox(text, 11, false, cx, rows[r], "middle"));
    }
  }
  ruler.append(s("text.ruler-unit", { x: X(L) + 8, y: ry + 4, text: "m" }));
  fixed.push(textBox("m", 11, false, X(L) + 8, ry + 4, "start"));
  seg(X(0), ry, X(L), ry);
  for (const x of xs) seg(X(x), ry - 5, X(x), ry + 5);
  placeLabels(labels, segs, boxes, fixed, { x0: 0, y0: top, x1: width, y1: top + MODEL_BAND.height });
  g.append(ruler, ...handleEls);
  return g;
}

// Text sizes as style.css draws them: .board text 12 px; the ruler and an
// angle 11 px; loads, reactions and support names bold.
const FONT = {
  "load-label": [12, true],
  "load-angle-label": [11, false],
  "resultant-label": [12, false],
  "reaction-label": [12, true],
  "support-name": [12, true],
};

/** A text's box (px), from the app font's character widths (a little generous). */
function textBox(text, size, bold, x, y, anchor) {
  let em = 0;
  for (const c of text)
    em += /[0-9−+=]/.test(c) ? 0.58 : /[ .,]/.test(c) ? 0.28 : /[°/]/.test(c) ? 0.43 : /[mMW]/.test(c) ? 0.96 : /[DNOQU→]/.test(c) ? 0.86 : /[A-Z]/.test(c) ? 0.68 : 0.62;
  const w = em * size * (bold ? 1.04 : 1);
  const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
  return { x0, x1: x0 + w, y0: y - 0.76 * size, y1: y + 0.22 * size };
}

const crosses = (b, [x1, y1, x2, y2]) => {
  // Liang–Barsky: does the segment enter the box?
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const P = [-dx, dx, -dy, dy];
  const Q = [x1 - b.x0, b.x1 - x1, y1 - b.y0, b.y1 - y1];
  for (let i = 0; i < 4; i++) {
    if (P[i] === 0) {
      if (Q[i] < 0) return false;
    } else {
      const r = Q[i] / P[i];
      if (P[i] < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
  }
  return true;
};
const overlap = (a, b, m = 0) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > m && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > m;

/**
 * Each label takes the first of its places that is inside the board and
 * clear of the other texts (`fixed` ones first), of the drawn lines and of
 * the shapes; when none is, the one that clashes least. Labels are placed
 * in the order given, then a label still in a clash may push the texts in
 * its way to their next best places, if that clashes less overall.
 */
function placeLabels(labels, segs, shapes, fixed, bounds) {
  const cand = labels.map((lb) => {
    const [size, bold] = FONT[lb.cls];
    return lb.places.map(([x, y, anchor], k) => {
      const b = { ...textBox(lb.text, size, bold, x, y, anchor), x, y, anchor };
      // What doesn't move: the board's edges, fixed texts, lines, shapes.
      let c = k;
      const out = Math.max(bounds.x0 - b.x0, b.x1 - bounds.x1, bounds.y0 - b.y0, b.y1 - bounds.y1);
      if (out > 0.5) c += 1e4 + out * 10;
      for (const f of fixed) if (overlap(b, f, 1)) c += 1000;
      for (const sg of segs) if (crosses(b, sg)) c += 200;
      for (const sh of shapes) if (overlap(b, sh)) c += 200;
      return { ...b, c };
    });
  });
  const at = labels.map(() => -1);
  const box = (i) => cand[i][at[i]];
  const cost = (i, k) => {
    let c = cand[i][k].c;
    for (let j = 0; j < labels.length; j++) if (j !== i && at[j] >= 0 && overlap(cand[i][k], box(j), 1)) c += 1000;
    return c;
  };
  const best = (i) => {
    let bk = 0;
    for (let k = 1; k < cand[i].length; k++) if (cost(i, k) < cost(i, bk)) bk = k;
    return bk;
  };
  const total = () => labels.reduce((sum, _, i) => sum + cost(i, at[i]), 0);
  for (let i = 0; i < labels.length; i++) at[i] = best(i);
  for (let round = 0; round < 2; round++)
    for (let i = 0; i < labels.length; i++) {
      if (cost(i, at[i]) < 200) continue;
      const saved = [...at];
      let bestAt = saved;
      let bestT = total();
      for (let k = 0; k < cand[i].length; k++) {
        at[i] = k;
        for (let j = 0; j < labels.length; j++) if (j !== i && overlap(cand[i][k], box(j), 1)) at[j] = best(j);
        const t = total();
        if (t < bestT) [bestT, bestAt] = [t, [...at]];
        at.splice(0, at.length, ...saved);
      }
      at.splice(0, at.length, ...bestAt);
    }
  for (const [i, lb] of labels.entries()) {
    const p = box(i);
    lb.parent.append(s(`text.${lb.cls}`, { x: p.x, y: p.y, "text-anchor": p.anchor, text: lb.text }));
  }
}

/**
 * An inclined force's angle (given data): a dashed vertical through its tip
 * and an arc from it to the shaft, labelled with the angle from the vertical.
 * Null for a vertical or horizontal force (the arrow says it all). Returns
 * the drawing, its lines and the label's text and places (by the arc's
 * middle, further out).
 */
function inclination(angle, tipX, tipY, dx, dy) {
  if (Math.abs(dx) < 1e-6 || Math.abs(dy) < 1e-6) return null;
  const a = Math.abs(((((angle + 180) % 360) + 360) % 360) - 180);
  const off = Math.min(a, 180 - a); // from the vertical, 0…90°
  const up = dy > 0 ? -1 : 1; // the vertical on the arrow's side of the beam (screen y)
  const r = 30;
  const a0 = Math.atan2(up, 0);
  const a1 = Math.atan2(-dy, -dx);
  let da = a1 - a0;
  if (da > Math.PI) da -= 2 * Math.PI;
  if (da < -Math.PI) da += 2 * Math.PI;
  const pts = [];
  for (let k = 0; k <= 12; k++) {
    const a = a0 + (da * k) / 12;
    pts.push([tipX + r * Math.cos(a), tipY + r * Math.sin(a)]);
  }
  const am = a0 + da / 2;
  const anchor = Math.cos(am) > 0.3 ? "start" : Math.cos(am) < -0.3 ? "end" : "middle";
  const segs = [[tipX, tipY, tipX, tipY + up * (r + 10)]];
  for (let k = 1; k < pts.length; k++) segs.push([...pts[k - 1], ...pts[k]]);
  return {
    g: s(
      "g.load-angle",
      {},
      s("line", { x1: tipX, y1: tipY, x2: tipX, y2: tipY + up * (r + 10), "stroke-dasharray": "3 3" }),
      s("polyline", { points: pts.map((p) => p.join(",")).join(" "), fill: "none" }),
    ),
    segs,
    text: `${fmt(off)}°`,
    places: [13, 24, 36, 48].map((d) => [tipX + (r + d) * Math.cos(am), tipY + (r + d) * Math.sin(am) + 4, anchor]),
  };
}
