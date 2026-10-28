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

// Advance widths (em) of the app's sans-serif, by kind of character (a
// little generous: a label that is drawn wider than it was planned lands
// on its neighbour). Digits, + − = are 0.57 em; Greek letters are wide.
const NARROW = /[,.:;·ilj'()[\]\s]/, SEMI = /[-ftr\/°Ir²³]/, WIDE = /[mwMW⊕⊖≈√]/, ROUND = /[DGHNOQUΔαβδθμρφσ]/, BROAD = /[A-HK-Zabdghnopqu|]/;
const charEm = (c) => (NARROW.test(c) ? 0.3 : SEMI.test(c) ? 0.44 : WIDE.test(c) ? 0.95 : ROUND.test(c) ? 0.82 : BROAD.test(c) ? 0.68 : 0.6);

/** Width (px) of a label at `size` px (sub- and superscripts at 75 %). */
export function textWidth(text, size = 13) {
  let w = 0;
  for (const [part, kind] of richParts(String(text).replace(/\u200b/g, ""))) for (const c of part) w += charEm(c) * size * (kind ? 0.75 : 1);
  return w;
}

/** Font size (px) of a text by its class, as style.css sets it. */
export function fontSize(el) {
  for (let e = el; e && e.getAttribute; e = e.parentNode ?? e.parent) {
    const c = e.getAttribute("class") || "";
    if (/fig-value/.test(c)) return 11;
    if (/fig-dim-label|fig-angle-label|fig-axis/.test(c)) return 12;
    if (/fig-(force-label|name|label)/.test(c)) return 13;
  }
  return 13;
}

/** Room (px per side) a text at offset (dx, dy) needs (a 13 px label). */
function textPad(text, dx, dy, anchor) {
  const w = textWidth(text);

  const left = anchor === "end" ? w - dx : anchor === "middle" ? w / 2 - dx : -dx;
  const right = anchor === "start" ? w + dx : anchor === "middle" ? w / 2 + dx : dx;
  return { l: Math.max(8, left + 4), r: Math.max(8, right + 4), t: Math.max(16, 16 - dy), b: Math.max(8, dy + 6) };
}

/** Box (px, relative to (x, y) = its baseline anchor) of a 12–13 px text. */
function textBox(text, x, y, anchor) {
  const w = textWidth(text);
  const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
  return { x0, x1: x0 + w, y0: y - 12, y1: y + 4 };
}
const boxUnion = (...bs) => bs.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1) }));
/**
 * Per-side pad for things drawn within `box` (px, relative to an item
 * point). Safe for an item with several points as long as the box is
 * relative to one of them or to a point between them.
 */
const boxPad = (b) => ({ l: Math.max(8, -b.x0 + 4), r: Math.max(8, b.x1 + 4), t: Math.max(8, -b.y0 + 4), b: Math.max(8, b.y1 + 4) });

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

/** Room (px, relative to a and to b) a dimension a→b needs. */
function dimBox(a, b, text, off, shift) {
  // Its direction on screen is the same at any scale.
  const wl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const vx = (b[0] - a[0]) / wl, vy = -(b[1] - a[1]) / wl;
  const ox = vy * -off, oy = -vx * -off;
  const sgn = Math.sign(off || -1);
  const lw = textWidth(text, 12);
  const cx = ox + vy * (9 + shift) * -sgn, cy = oy - vx * (9 + shift) * -sgn;
  const hx = (Math.abs(vx) * lw) / 2 + Math.abs(vy) * 8, hy = (Math.abs(vy) * lw) / 2 + Math.abs(vx) * 8;
  return boxUnion(
    { x0: Math.min(0, ox * 1.2) - 7, x1: Math.max(0, ox * 1.2) + 7, y0: Math.min(0, oy * 1.2) - 7, y1: Math.max(0, oy * 1.2) + 7 },
    { x0: cx - hx, x1: cx + hx, y0: cy - hy, y1: cy + hy },
  );
}

/** A dimension line a→b offset by `off` px, its label `shift` px further out. */
function dimDraw(T, a, b, text, off, shift, beside = false) {
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
  if (beside && textWidth(text, 12) + 8 > len) {
    // Too short for its label: the label past the b end, level with the line.
    const flipped = Math.abs((Math.atan2(uy, ux) * 180) / Math.PI - ang) > 90;
    const ex = bx + ux * 5, ey = by + uy * 5;
    g.append(svgText(ex, ey + 4, text, { class: "fig-dim-label", "text-anchor": flipped ? "end" : "start", transform: `rotate(${ang} ${ex} ${ey})` }));
    return g;
  }
  const tx = mx + nx * (9 + shift) * -sx, ty = my + ny * (9 + shift) * -sx;
  const t = svgText(tx, ty + 4, text, { class: "fig-dim-label", "text-anchor": "middle", transform: `rotate(${ang} ${tx} ${ty})` });
  // An arrow or a line across the middle: the label slides along the dimension
  // (still between its arrows), whichever place is clearest (see placeLabels).
  const room = (len - textWidth(text, 12) - 12) / 2 / len;
  if (room > 0.08) {
    t.alts = [0, -0.6, 0.6, -1, 1].map((k) => {
      const f = 0.5 + k * room, px = tx + (bx - ax) * (f - 0.5), py = ty + (by - ay) * (f - 0.5);
      return [px, py + 4, "middle", [ang, px, py]];
    });
  }
  g.append(t);
  return g;
}

/** Is `el` or one of its ancestors of a class matching `re`? */
function inClass(el, re) {
  for (let e = el; e && e.getAttribute; e = e.parentNode ?? e.parent) if (re.test(e.getAttribute("class") || "")) return true;
  return false;
}

/** Box (px) of the text element `t` were it at (x, y) with `anchor`; a px or so generous. */
function elBox(t, x, y, anchor) {
  const fs = fontSize(t);
  let w = 0, sub = false, sup = false;
  const parts = t.children?.length ? [...t.children] : [t];
  for (const p of parts) {
    const str = (p.textContent || "").replace(/\u200b/g, "");
    const small = p !== t && p.getAttribute("font-size") === "75%";
    if (small && str) (p.getAttribute("baseline-shift") === "40%" ? (sup = true) : (sub = true));
    w += textWidth(str, fs * (small ? 0.75 : 1));
  }
  w += 2;
  const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
  return { x0, x1: x0 + w, y0: y - 0.74 * fs - 1 - (sup ? 0.3 * fs : 0), y1: y + 0.2 * fs + 1 + (sub ? 0.25 * fs : 0) };
}

/** Points along an SVG arc command (a circle's, radius r) from p to q, q included. */
function arcPoints([x1, y1], r, large, sweep, [x2, y2]) {
  const mx = (x1 - x2) / 2, my = (y1 - y2) / 2, d2 = mx * mx + my * my;
  if (d2 < 1e-12) return [[x2, y2]];
  r = Math.max(Math.abs(r), Math.sqrt(d2));
  // The centre, as the SVG spec finds it (both radii r, no rotation).
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (r * r - d2) / d2));
  const cx = k * my + (x1 + x2) / 2, cy = -k * mx + (y1 + y2) / 2;
  const t1 = Math.atan2(y1 - cy, x1 - cx);
  let dt = Math.atan2(y2 - cy, x2 - cx) - t1;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  const n = Math.max(2, Math.ceil(Math.abs(dt) / (Math.PI / 12)));
  const out = [];
  for (let i = 1; i < n; i++) out.push([cx + r * Math.cos(t1 + (dt * i) / n), cy + r * Math.sin(t1 + (dt * i) / n)]);
  out.push([x2, y2]);
  return out;
}

/**
 * Labels drawn with alternatives (`el.alts`: [[x, y, anchor], …], the first
 * being where they were drawn) take the one that is clearest in the
 * finished picture: inside it above all, then off every other text (one
 * text on another is much worse than a crossed line), then crossing the
 * fewest lines (a member, rope or force's shaft counting three times a thin
 * line). Labels with fewer places to go choose first; then each chooses
 * again, knowing where all the others went.
 */
const TEXT_ON_TEXT = 40; // cost of a label on another text (a crossed line: 1–3)

function placeLabels(svg, width, height) {
  const auto = [...svg.querySelectorAll("text")].filter((t) => t.alts);
  if (!auto.length) return;
  const segs = [];
  const pts = (str) => (str.match(/-?[\d.]+(?:e-?\d+)?/g) || []).map(Number);
  const pairs = (nums) => {
    const out = [];
    for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
    return out;
  };
  // (Each segment knows its element's [cost, half stroke width] object: a
  // curve of many short segments costs once, like a straight line.)
  const chain = (ps, close, w) => {
    w = [...w];
    for (let i = 1; i < ps.length; i++) segs.push([ps[i - 1], ps[i], w]);
    if (close && ps.length > 2) segs.push([ps[ps.length - 1], ps[0], w]);
  };
  for (const el of svg.querySelectorAll("line, polyline, polygon, path, circle")) {
    const tag = el.tagName.toLowerCase();
    const a = (k) => Number(el.getAttribute(k));
    // [cost, half its stroke's width]
    // (A distributed load's line joining its tails counts as a thin line: a label across it still reads.)
    const tailsLine = tag === "polyline" && inClass(el, /fig-load/);
    // (A circle's outline — Mohr's circle, a pulley, a wheel, a round section — like a rope.)
    const outline = tag === "circle" && inClass(el, /fig-body|fig-hole/);
    const w = inClass(el, /fig-member/) ? [3, 2.5] : (inClass(el, /fig-rope|fig-force|fig-load/) || outline) && !inClass(el, /fig-axis/) && !tailsLine ? [3, 1] : [1, 0.5];
    if (tag === "line") chain([[a("x1"), a("y1")], [a("x2"), a("y2")]], false, w);
    else if (tag === "polyline" || tag === "polygon") chain(pairs(pts(el.getAttribute("points") || "")), tag === "polygon", w);
    else if (tag === "circle") {
      const cx = a("cx"), cy = a("cy"), r = a("r"), ps = [];
      const n = Math.max(12, Math.min(72, Math.ceil(r / 3)));
      for (let k = 0; k < n; k++) ps.push([cx + r * Math.cos((2 * k * Math.PI) / n), cy + r * Math.sin((2 * k * Math.PI) / n)]);
      chain(ps, true, w);
    } else {
      // M, L, Z and circular A (a moment's arc, a rope round a pulley), absolute; arcs sampled.
      let ps = [], cur = [0, 0];
      const flush = (close) => {
        if (ps.length > 1) chain(ps, close, w);
        ps = [];
      };
      for (const [, cmd, args] of (el.getAttribute("d") || "").matchAll(/([MLAZ])([^MLAZ]*)/gi)) {
        const c = cmd.toUpperCase(), n = pts(args);
        if (c === "Z") flush(true);
        else if (c === "A") for (let i = 0; i + 6 < n.length; i += 7) {
          ps.push(...arcPoints(cur, n[i], n[i + 3], n[i + 4], [n[i + 5], n[i + 6]]));
          cur = ps[ps.length - 1];
        } else for (const [k, p] of pairs(n).entries()) {
          if (c === "M" && k === 0) flush(false);
          ps.push(p);
          cur = p;
        }
      }
      flush(false);
    }
  }
  // Texts as boxes, turned as they are drawn (a dimension's label along its line).
  const rotOf = (t) => {
    const m = /rotate\(([-\d.e]+) ([-\d.e]+) ([-\d.e]+)\)/.exec(t.getAttribute("transform") || "");
    return m ? m.slice(1).map(Number) : null;
  };
  const rect = (b, rot) => {
    if (!rot || !rot[0]) return { b, rot: null, corners: [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]], axes: [[1, 0], [0, 1]] };
    const [ang, cx, cy] = rot;
    const c = Math.cos((ang * Math.PI) / 180), sn = Math.sin((ang * Math.PI) / 180);
    const corners = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(([x, y]) => [cx + (x - cx) * c - (y - cy) * sn, cy + (x - cx) * sn + (y - cy) * c]);
    return { b, rot, corners, axes: [[c, sn], [-sn, c]] };
  };
  // A point in the text's own (unturned) frame.
  const local = (R, [x, y]) => {
    if (!R.rot) return [x, y];
    const [ang, cx, cy] = R.rot;
    const c = Math.cos((ang * Math.PI) / 180), sn = Math.sin((ang * Math.PI) / 180);
    return [cx + (x - cx) * c + (y - cy) * sn, cy - (x - cx) * sn + (y - cy) * c];
  };
  const fixed = [];
  for (const t of svg.querySelectorAll("text")) {
    if (t.alts || !t.textContent.replace(/[\u200b\s]/g, "")) continue; // (an empty text is in no one's way)
    fixed.push(rect(elBox(t, Number(t.getAttribute("x")), Number(t.getAttribute("y")), t.getAttribute("text-anchor") || "start"), rotOf(t)));
  }
  const hits = (B, [p, q]) => {
    // Liang–Barsky: does segment p→q enter box B?
    let t0 = 0, t1 = 1;
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const P = [-dx, dx, -dy, dy], Q = [p[0] - B.x0, B.x1 - p[0], p[1] - B.y0, B.y1 - p[1]];
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
  // Two (turned) boxes overlap unless some axis of either separates them.
  const overlap = (A, B) => {
    for (const [ax, ay] of [...A.axes, ...B.axes]) {
      const pa = A.corners.map(([x, y]) => x * ax + y * ay), pb = B.corners.map(([x, y]) => x * ax + y * ay);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
    return true;
  };
  // Each alternative's own cost (lines it crosses, fixed texts it covers,
  // leaving the picture), then the overlaps between the movable labels.
  // An alternative: [x, y, anchor] or, for a turned label, [x, y, anchor, [angle, cx, cy]].
  const cands = auto.map((t) =>
    t.alts.map(([x, y, anchor, rot], i) => {
      const B = elBox(t, x, y, anchor);
      const R = rect(B, rot);
      let cost = i * 0.01;
      // (A line through the text costs in full, one just grazing its edge a little.)
      const crossed = new Map();
      for (const sg of segs) {
        const e = sg[2][1];
        if (crossed.get(sg[2]) === 1) continue;
        const ls = [local(R, sg[0]), local(R, sg[1])];
        if (!hits({ x0: B.x0 - e, x1: B.x1 + e, y0: B.y0 - e, y1: B.y1 + e }, ls)) continue;
        // (in full once its stroke reaches 2 px into the box)
        const c = 2 - e;
        crossed.set(sg[2], hits({ x0: B.x0 + c, x1: B.x1 - c, y0: B.y0 + c, y1: B.y1 - c }, ls) ? 1 : 0.4);
      }
      for (const [w, k] of crossed) cost += w[0] * k;
      for (const F of fixed) if (overlap(R, F)) cost += TEXT_ON_TEXT;
      const xs = R.corners.map((c) => c[0]), ys = R.corners.map((c) => c[1]);
      cost += 1000 * ((Math.min(...xs) < 0) + (Math.max(...xs) > width) + (Math.min(...ys) < 0) + (Math.max(...ys) > height)); // cut off: worst
      return { x, y, anchor, rot, R, cost };
    }),
  );
  const n = auto.length;
  const pick = new Array(n).fill(-1);
  const R = (j) => (pick[j] < 0 ? null : cands[j][pick[j]].R);
  // Cost of label k at alternative i, with the others where they are.
  const costAt = (k, i, skip = -1) => {
    let c = cands[k][i].cost;
    for (let j = 0; j < n; j++) if (j !== k && j !== skip && R(j) && overlap(cands[k][i].R, R(j))) c += TEXT_ON_TEXT;
    return c;
  };
  const bestFor = (k, skip) => {
    let bi = 0, bc = Infinity;
    for (let i = 0; i < cands[k].length; i++) {
      const c = costAt(k, i, skip);
      if (c < bc) [bi, bc] = [i, c];
    }
    return [bi, bc];
  };
  // Labels with fewer places to go choose first; then each again, knowing
  // where all the others went; then a label still on something may push
  // one neighbour aside, if the two together come out better.
  const order = auto.map((t, k) => k).sort((p, q) => cands[p].length - cands[q].length || p - q);
  for (const k of order) pick[k] = bestFor(k)[0];
  for (const k of order) pick[k] = bestFor(k)[0];
  for (const k of order) {
    const now = costAt(k, pick[k]);
    if (now < 1) continue;
    let gain = 0, move = null;
    for (let i = 0; i < cands[k].length; i++) {
      for (let j = 0; j < n; j++) {
        if (j === k || !R(j) || !overlap(cands[k][i].R, R(j))) continue;
        const old = [pick[k], pick[j]];
        const before = now + costAt(j, pick[j], k);
        pick[k] = i;
        const [bj] = bestFor(j);
        pick[j] = bj;
        const after = costAt(k, i) + costAt(j, bj, k);
        [pick[k], pick[j]] = old;
        if (before - after > gain + 1e-9) [gain, move] = [before - after, [i, j, bj]];
      }
    }
    if (move) [pick[k], pick[move[1]]] = [move[0], move[2]];
  }
  auto.forEach((t, k) => {
    const c = cands[k][pick[k]];
    t.setAttribute("x", c.x);
    t.setAttribute("y", c.y);
    t.setAttribute("text-anchor", c.anchor);
    if (c.rot) t.setAttribute("transform", `rotate(${c.rot.join(" ")})`);
  });
}

export function figure() {
  const all = [];
  let only = null; // while byWidth() runs a variant: the widths it is for
  const add = (pts, draw, pad = 0) => all.push({ pts, draw, pad, only });
  let items = all;

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
    point(p, name, { dx = 8, dy = -8, anchor = "start", dot = true, alts } = {}) {
      // `alts`: other places for the name, as for label().
      const cs = [[dx, dy, anchor], ...(alts ?? [])];
      add([p], (T) => {
        const t = svgText(T.X(p[0]) + dx, T.Y(p[1]) + dy, name, { class: "fig-name", "text-anchor": anchor });
        if (alts?.length && name) t.alts = cs.map(([ddx, ddy, an]) => [T.X(p[0]) + ddx, T.Y(p[1]) + ddy, an]);
        return s("g", {}, dot ? s("circle.fig-dot", { cx: T.X(p[0]), cy: T.Y(p[1]), r: 2.6 }) : null, t);
      }, textPad(name, dx, dy, anchor));
    },

    /** Free text at a world point, offset in px. */
    label(p, text, { dx = 0, dy = 0, anchor = "middle", cls = "fig-label", alts } = {}) {
      // `alts`: other places to try, [[dx, dy, anchor], …]; the clearest one wins (see placeLabels).
      // (Room is kept for the first place only: an alternative that would
      // leave the picture loses to the others.)
      const cs = [[dx, dy, anchor], ...(alts ?? [])];
      const pad = textPad(text, dx, dy, anchor);
      add([p], (T) => {
        const t = svgText(T.X(p[0]) + dx, T.Y(p[1]) + dy, text, { class: cls, "text-anchor": anchor });
        if (alts?.length) t.alts = cs.map(([ddx, ddy, an]) => [T.X(p[0]) + ddx, T.Y(p[1]) + ddy, an]);
        return t;
      }, pad);
    },
    /**
     * Force arrow pointing in direction `angle` (degrees, math sense).
     * By default the tip touches p; `tail: true` starts the arrow at p.
     */
    force(p, angle, { label, len: lenPx = 52, world, tail = false, cls = "fig-force", labelSide = 1, labelAt = "side", prefer = "end" } = {}) {
      // labelAt "auto": wherever the label is clearest, trying `prefer` ("end" or "side") first.
      // `world`: the arrow's length in world units instead of pixels.
      const pts = [p];
      if (world) pts.push([p[0] + (tail ? 1 : -1) * world * Math.cos(rad(angle)), p[1] + (tail ? 1 : -1) * world * Math.sin(rad(angle))]);
      const [ux, uy] = dirPx(angle);
      // Where the label goes, given the shaft's ends s → t on screen.
      const labelPos = (sx, sy, tx, ty, at = labelAt, side = labelSide, far = 0) => {
        if (at === "end") {
          // Past the far end of the arrow (the tip for `tail`, else the tail).
          const [ex, ey] = tail ? [tx + ux * 10, ty + uy * 10] : [sx - ux * 10, sy - uy * 10];
          const dir = tail ? 1 : -1;
          const anchor = ux * dir > 0.35 ? "start" : ux * dir < -0.35 ? "end" : "middle";
          return [ex, ey + (uy * dir > 0.35 ? 12 : uy * dir < -0.35 ? -4 : 4), anchor];
        }
        // Beside the middle of the shaft, on the left of its direction.
        const mx = (sx + tx) / 2 + uy * (12 + far) * side, my = (sy + ty) / 2 - ux * (12 + far) * side;
        const anchor = Math.abs(uy) > 0.5 ? (side * uy > 0 ? "start" : "end") : "middle";
        return [mx, my + (Math.abs(uy) > 0.5 ? 4 : uy * -2 + (ux * side > 0 ? -2 : 12)), anchor];
      };
      // "auto": past the end or on either side, whichever is clearest (see placeLabels).
      const choices = (sx, sy, tx, ty) =>
        labelAt === "auto"
          ? [
              ...(prefer === "side"
                ? [labelPos(sx, sy, tx, ty, "side", labelSide), labelPos(sx, sy, tx, ty, "end")]
                : [labelPos(sx, sy, tx, ty, "end"), labelPos(sx, sy, tx, ty, "side", labelSide)]),
              labelPos(sx, sy, tx, ty, "side", -labelSide),

              // Beside the far end, to either side (running away from the shaft).
              ...[labelSide, -labelSide].map((sd) => {
                const [ex, ey, an] = labelPos(sx, sy, tx, ty, "end");
                const ox = uy * sd, oy = -ux * sd;
                return [ex + ox * 14, ey + oy * 14, ox > 0.35 ? "start" : ox < -0.35 ? "end" : an];
              }),
              // Past the end, but running off to one side.
              ...(() => {
                const [ex, ey, an] = labelPos(sx, sy, tx, ty, "end");
                return an === "middle" ? [[ex + 4, ey, "start"], [ex - 4, ey, "end"]] : [];
              })(),
              // Further out: beside the shaft, past the end.
              labelPos(sx, sy, tx, ty, "side", labelSide, 10),
              labelPos(sx, sy, tx, ty, "side", -labelSide, 10),
              // Past the near end (the point it acts at), off the shaft's line, either side.
              ...(() => {
                const [nx0, ny0] = tail ? [sx, sy] : [tx, ty];
                const dir = tail ? -1 : 1, ex = nx0 + ux * 12 * dir, ey = ny0 + uy * 12 * dir;
                const an = ux * dir > 0.35 ? "start" : ux * dir < -0.35 ? "end" : "middle";
                return [[ex, ey + 4, an], [ex + uy * 12, ey - ux * 12 + 4, an], [ex - uy * 12, ey + ux * 12 + 4, an]];
              })(),
              // Beside the shaft nearer its far end (or its tip), either side.
              ...[0.6, -0.6].flatMap((k) => {
                const fx = tail ? tx : sx, fy = tail ? ty : sy;
                const nx = (fx - (sx + tx) / 2) * k, ny = (fy - (sy + ty) / 2) * k;
                return [labelSide, -labelSide].map((sd) => {
                  const [x, y, an] = labelPos(sx, sy, tx, ty, "side", sd);
                  return [x + nx, y + ny, an];
                });
              }),
              (() => {
                const [ex, ey, an] = labelPos(sx, sy, tx, ty, "end");
                return [ex + ux * (tail ? 10 : -10), ey + uy * (tail ? 10 : -10), an];
              })(),
            ]

          : [labelPos(sx, sy, tx, ty)];
      // Room needed on each side: the shaft (when its length is in px) and the label.
      let box;
      if (world) {
        // The shaft is covered by the two points; an end label sits by the
        // far one (pts[1]), a side label by the middle of the shaft.
        box = { x0: -6, x1: 6, y0: -6, y1: 6 };
        if (label) box = boxUnion(box, textBox(label, ...choices(0, 0, 0, 0)[0]));
      } else {
        const ex = ux * lenPx * (tail ? 1 : -1), ey = uy * lenPx * (tail ? 1 : -1);
        const [sx, sy, tx, ty] = tail ? [0, 0, ex, ey] : [ex, ey, 0, 0];
        box = { x0: Math.min(sx, tx) - 6, x1: Math.max(sx, tx) + 6, y0: Math.min(sy, ty) - 6, y1: Math.max(sy, ty) + 6 };
        if (label) box = boxUnion(box, textBox(label, ...choices(sx, sy, tx, ty)[0]));

      }
      add(pts, (T) => {
        const len = world ? world * T.ppm : lenPx;
        const x = T.X(p[0]), y = T.Y(p[1]);
        const [tx, ty] = tail ? [x + ux * len, y + uy * len] : [x, y];
        const [sx, sy] = tail ? [x, y] : [x - ux * len, y - uy * len];
        const g = s(`g.${cls}`, {}, s("line", { x1: sx, y1: sy, x2: tx - ux * 6, y2: ty - uy * 6 }), arrowHead(tx, ty, ux, uy, 10));
        if (label) {
          const cs = choices(sx, sy, tx, ty);
          const t = svgText(cs[0][0], cs[0][1], label, { class: "fig-force-label", "text-anchor": cs[0][2] });
          if (cs.length > 1) t.alts = cs;
          g.append(t);
        }
        return g;
      }, boxPad(box));
    },
    /** Point moment (couple) as a curved arrow around p. */
    moment(p, ccw, label) {
      add([p], (T) => {
        const x = T.X(p[0]), y = T.Y(p[1]), r = 16;
        const a0 = rad(ccw ? -50 : 230), a1 = rad(ccw ? 200 : -20);
        const P = (a) => [x + r * Math.cos(a), y - r * Math.sin(a)];
        const [x0, y0] = P(a0), [x1, y1] = P(a1);
        const tan = ccw ? [-Math.sin(a1), -Math.cos(a1)] : [Math.sin(a1), Math.cos(a1)];
        let t = null;
        if (label) {
          t = svgText(x + r + 5, y - r - 2, label, { class: "fig-force-label" });
          // Up right, or (if that's on a load's arrows) the other corners round the arc.
          t.alts = [[x + r + 5, y - r - 2, "start"], [x - r - 5, y - r - 2, "end"], [x + r + 5, y + r + 12, "start"], [x - r - 5, y + r + 12, "end"]];
          // (Further out, or level with the arc's side: a force's arrow at the same point.)
          t.alts.push([x + r + 5, y - r - 16, "start"], [x - r - 5, y - r - 16, "end"], [x + r + 8, y + 4, "start"], [x - r - 8, y + 4, "end"], [x, y - r - 8, "middle"]);
        }
        return s("g.fig-force", {}, s("path", { d: `M${x0} ${y0} A${r} ${r} 0 1 ${ccw ? 0 : 1} ${x1} ${y1}`, fill: "none" }), arrowHead(x1 + tan[0] * 4, y1 + tan[1] * 4, tan[0], tan[1], 9), t);

      }, label ? { l: 44, r: 44 + textWidth(label), t: 44, b: 44 } : 44);
    },
    /**
     * Distributed load on the segment a→b: arrows in direction `angle`
     * (default straight down) ending on the segment, their tails joined.
     * `h0`, `h1`: arrow lengths (px) at a and b, for a triangular load.
     */
    dist(a, b, { label, angle = -90, h0 = 26, h1 = h0 } = {}) {
      const [ux, uy] = dirPx(angle);
      // Arrows reach −u·h from each end; the label sits past the middle tail.
      const hm = Math.max(h0, h1);
      let box = { x0: Math.min(0, -ux * hm) - 6, x1: Math.max(0, -ux * hm) + 6, y0: Math.min(0, -uy * hm) - 6, y1: Math.max(0, -uy * hm) + 6 };
      if (label) box = boxUnion(box, textBox(label, -ux * (hm + 26), -uy * (hm + 26) + 4, "middle"));
      add([a, b], (T) => {
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
          const t = svgText(m[0] - ux * 12, m[1] - uy * 12 + 4, label, { class: "fig-force-label", "text-anchor": "middle" });
          // If that's on something (a rope, a force's arrow), try a quarter
          // along either way, or a row further out (see placeLabels).
          const at = (k, extra) => [tails[k][0] - ux * (12 + extra), tails[k][1] - uy * (12 + extra) + 4, "middle"];
          const k = Math.floor(tails.length / 2);
          t.alts = [at(k, 0), at(Math.round(tails.length / 4), 0), at(Math.round((3 * tails.length) / 4) - 1, 0), at(k, 14), at(k, 28), at(Math.round(tails.length / 4), 14), at(Math.round((3 * tails.length) / 4) - 1, 14)];
          if (Math.abs(uy) > 0.5 && Math.abs(x2 - x1) > 1) {
            // Or level with the tails, before the first or past the last (no room is
            // reserved for these: placeLabels drops them if they leave the picture).
            const sg = Math.sign(x2 - x1), [n0, n1] = [tails[0], tails[tails.length - 1]];
            t.alts.push([n1[0] + sg * 6, n1[1] + 4, sg > 0 ? "start" : "end"], [n0[0] - sg * 6, n0[1] + 4, sg > 0 ? "end" : "start"]);
            // (or lower, beside its arrows: a flat rope just over the tails)
            t.alts.push([n1[0] + sg * 6, n1[1] + uy * 14 + 4, sg > 0 ? "start" : "end"], [n0[0] - sg * 6, n0[1] + uy * 14 + 4, sg > 0 ? "end" : "start"]);
            // Or over one end of it, running inwards (a force's arrow through its middle).
            const row = (p) => p[1] - uy * 12 + 4;
            t.alts.push([n0[0], row(n0), sg > 0 ? "start" : "end"], [n1[0], row(n1), sg > 0 ? "end" : "start"]);
            // … or outwards (a short load).
            t.alts.push([n1[0], row(n1), sg > 0 ? "start" : "end"], [n0[0], row(n0), sg > 0 ? "end" : "start"]);
            // Or anywhere along it: over any of its arrows (a gap between a rope and a force).
            for (const p of tails) t.alts.push([p[0], row(p), "middle"]);
            // Over a sloping load: ending at a tail, on the side where the tails are lower.
            const rises = (n1[1] - n0[1]) * sg < -4; // (screen y down: the tails climb to the right)
            if (Math.abs(n1[1] - n0[1]) > 4) for (const p of tails) t.alts.push([p[0] + (rises ? -2 : 2), p[1] - 7, rises ? "end" : "start"]);
          }


          g.append(t);

        }
        return g;
      }, boxPad(box));
    },
    /** Dimension line between a and b, offset sideways by `off` px: positive = right of a→b on screen (below a left-to-right one), negative = above it. */
    dim(a, b, text, off = -26, { shift = 0, beside = false } = {}) {
      // `shift`: the label this many px further out (to clear a neighbour's).
      // `beside`: when the dimension is too short for it, the label goes past b.
      let box = dimBox(a, b, text, off, shift);
      if (beside) {
        const wl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const ux = (b[0] - a[0]) / wl, uy = -(b[1] - a[1]) / wl, lw = textWidth(text, 12) + 10;
        // Relative to b (and so, safely, to a): along the line past b, offset as the line is.
        const ox = uy * -off, oy = -ux * -off;
        box = boxUnion(box, { x0: ox + Math.min(0, ux * lw) - 8, x1: ox + Math.max(0, ux * lw) + 8, y0: oy + Math.min(0, uy * lw) - 8, y1: oy + Math.max(0, uy * lw) + 8 });
      }
      add([a, b], (T) => dimDraw(T, a, b, text, off, shift, beside), boxPad(box));
    },

    /**
     * A chain of dimensions between consecutive points of `pts` (on one
     * line), `texts[i]` for pts[i]→pts[i+1]. A label that doesn't fit beside
     * its neighbour (short segments on a narrow screen) moves one row out.
     */
    dimChain(pts, texts, off = -26) {
      // The rows at a scale (px per unit): a label that fits between its
      // arrows stays on the line; one that doesn't goes a row out (or
      // further, past a neighbour already there).
      const cache = new Map();
      const rowsAt = (ppm) => {
        if (cache.has(ppm)) return cache.get(ppm);
        const at = (k) => Math.hypot(pts[k][0] - pts[0][0], pts[k][1] - pts[0][1]) * ppm;
        const last = [-Infinity, -Infinity, -Infinity, -Infinity], out = [];
        for (let k = 0; k + 1 < pts.length; k++) {
          const w = textWidth(texts[k], 12), c = (at(k) + at(k + 1)) / 2;
          const fits = w + 10 <= at(k + 1) - at(k);
          let row = [0, 1, 2, 3].find((r) => (r > 0 || fits) && c - w / 2 >= last[r] + 4);
          if (row === undefined) row = [1, 2, 3].reduce((m, r) => (last[r] < last[m] ? r : m), 1);
          last[row] = c + w / 2;
          out.push(row);
        }
        cache.set(ppm, out);
        return out;
      };
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = pts[k], b = pts[k + 1];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-9) continue;
        add([a, b], (T) => dimDraw(T, a, b, texts[k], off, rowsAt(T.ppm)[k] * 13), (ppm) => boxPad(dimBox(a, b, texts[k], off, Math.max(2, rowsAt(ppm)[k]) * 13)));
      }
    },
    /** Angle arc at p from direction a0 to a1 (degrees, ccw), with a label. */
    angle(p, a0, a1, text, r = 30) {
      // The label sits on the bisector, far enough out to clear both arms
      // of a narrow angle (it would lie on them at r + 13).
      const half = Math.abs(a1 - a0) / 2;
      const lw = text ? textWidth(text, 12) : 0;
      let D = r + 13;
      if (text && half < 75 && half > 0.5) {
        for (const a of [a0, a1]) {
          const e = (lw / 2) * Math.abs(Math.sin(rad(a))) + 6 * Math.abs(Math.cos(rad(a)));
          D = Math.max(D, (e + 3) / Math.sin(rad(half)));
        }
        D = Math.min(D, r + 60);
      }
      // The arc follows the label out, so the two stay together.
      const ra = Math.max(r, D - 13);
      const am = rad((a0 + a1) / 2);
      const lx = D * Math.cos(am), ly = -D * Math.sin(am);
      let box = { x0: -6, x1: 6, y0: -6, y1: 6 };
      for (let i = 0; i <= 8; i++) {
        const a = rad(a0 + ((a1 - a0) * i) / 8);
        box = boxUnion(box, { x0: ra * Math.cos(a), x1: ra * Math.cos(a), y0: -ra * Math.sin(a), y1: -ra * Math.sin(a) });
      }
      if (text) box = boxUnion(box, { x0: lx - lw / 2, x1: lx + lw / 2, y0: ly - 8, y1: ly + 8 });
      add([p], (T) => {
        const x = T.X(p[0]), y = T.Y(p[1]);
        const n = 16;
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const a = rad(a0 + ((a1 - a0) * i) / n);
          pts.push(`${x + ra * Math.cos(a)},${y - ra * Math.sin(a)}`);
        }
        let t = null;
        if (text) {
          t = svgText(x + lx, y + ly + 4, text, { class: "fig-angle-label", "text-anchor": "middle" });
          // On something after all (a small drawing on a phone): further out,
          // or past either end of the arc (see placeLabels).
          const out = (k) => [x + k * Math.cos(am), y - k * Math.sin(am) + 4, "middle"];
          const past = (a, turn) => {
            const ca = Math.cos(rad(a)), sa = Math.sin(rad(a)), b = rad(a + turn * 12);
            return [x + (ra + 4) * Math.cos(b), y - (ra + 4) * Math.sin(b) + 4 + (sa > 0.5 ? -4 : sa < -0.5 ? 8 : 0), ca > 0.3 ? "start" : ca < -0.3 ? "end" : "middle"];
          };
          const dir = Math.sign(a1 - a0) || 1;
          // (Last, within the arc, on its arms if need be: thin lines there,
          // a circle round the vertex further out, as Mohr's on a phone.)
          t.alts = [out(D), out(D + 16), out(r + 13), past(a1, dir), past(a0, -dir), out(D + 32), out(D + 48), out(Math.max(14, ra - 12))];
        }
        return s("g.fig-angle", {}, s("polyline", { points: pts.join(" "), fill: "none" }), t);
      }, boxPad(box));

    },
    /** Coordinate axes at o (2D): x right, y up, with names. */
    axes(o, { x = "x", y = "y", len = 40 } = {}) {
      api.force(o, 0, { len, tail: true, cls: "fig-axis" });
      api.force(o, 90, { len, tail: true, cls: "fig-axis" });
      add([o], (T) => s("g.fig-axis", {}, svgText(T.X(o[0]) + len + 6, T.Y(o[1]) + 4, x), svgText(T.X(o[0]) - 4, T.Y(o[1]) - len - 6, y, { "text-anchor": "end" })), { l: 14, r: len + 22, t: len + 22, b: 14 });
    },
    /** Make sure these world points are inside the picture. */
    bounds(pts) {
      add(pts, () => s("g"));
    },
    /** Raw access: draw(T) gets { X, Y, ppm } and returns an SVG element. */
    custom(pts, draw, pad = 0) {
      add(pts, draw, pad);
    },
    /**
     * Two layouts: `narrow` drawn on screens up to `breakpoint` px wide (a
     * phone), `wide` on the others; each a function of the figure.
     */
    byWidth(breakpoint, narrow, wide) {
      only = (w) => w <= breakpoint;
      narrow(api);
      only = (w) => w > breakpoint;
      wide(api);
      only = null;
    },

    render(width, maxHeight = 420) {
      items = all.filter((it) => !it.only || it.only(width));

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
      // narrow screen still has most of its width for the drawing; the cap
      // only bites when a side really needs that much (a phone's 330 px
      // still fits a label like "M_0 = 8 kNm" beside the frame).
      // A side may take up to 45 % of a phone's width (a long label on one
      // side clipped at 34 %), but both together at most 62 %.
      const capX = Math.min(170, width * 0.45), capY = Math.min(130, maxHeight * 0.28);
      const clamp = (v, cap) => Math.max(14, Math.min(cap, v));
      let m = { l: PAD, r: PAD, t: PAD, b: PAD };
      let ppm = 1;
      let needLast = { l: 0, r: 0, t: 0, b: 0 };
      for (let round = 0; round < 4; round++) {
        ppm = Math.min((width - m.l - m.r) / w, (maxHeight - m.t - m.b) / h, 400);
        const need = { l: 0, r: 0, t: 0, b: 0 };
        for (const it of items) {
          if (!it.pad) continue;
          // `pad`: px needed around the item's points, one number or per side
          // (or a function of the scale returning either).
          const p0 = typeof it.pad === "function" ? it.pad(ppm) : it.pad;
          const pd = typeof p0 === "number" ? { l: p0, r: p0, t: p0, b: p0 } : p0;

          for (const [x, y] of it.pts) {
            need.l = Math.max(need.l, pd.l - (x - x0) * ppm);
            need.r = Math.max(need.r, pd.r - (x1 - x) * ppm);
            need.t = Math.max(need.t, pd.t - (y1 - y) * ppm);
            need.b = Math.max(need.b, pd.b - (y - y0) * ppm);
          }
        }
        m = { l: clamp(need.l, capX), r: clamp(need.r, capX), t: clamp(need.t, capY), b: clamp(need.b, capY) };
        const sideMax = width * 0.62;
        if (m.l + m.r > sideMax) {
          const k = sideMax / (m.l + m.r);
          m.l *= k;
          m.r *= k;
        }
        needLast = need;
      }
      ppm = Math.max(1e-3, Math.min((width - m.l - m.r) / w, (maxHeight - m.t - m.b) / h, 400));
      // The height cap is there for a drawing that fills the height. One
      // that doesn't (a wide one on a phone) can have all the room it needs.
      if (h * ppm + Math.max(14, needLast.t) + Math.max(14, needLast.b) <= maxHeight) {
        m.t = Math.max(m.t, needLast.t);
        m.b = Math.max(m.b, needLast.b);
      }
      // Likewise across: a drawing that doesn't fill the width (it is as
      // tall as allowed) shifts so a capped side gets what it needs.
      const slack = width - m.l - m.r - w * ppm;
      const el = Math.max(0, needLast.l - m.l), er = Math.max(0, needLast.r - m.r);
      if (slack > 0 && el + er > 0) {
        const k = Math.min(1, slack / (el + er));
        m.l += el * k;
        m.r += er * k;
      }
      const height = Math.min(maxHeight, h * ppm + m.t + m.b);
      const ox = m.l + (width - m.l - m.r - w * ppm) / 2, oy = m.t + (height - m.t - m.b - h * ppm) / 2;
      const T = { ppm, width, height, X: (x) => ox + (x - x0) * ppm, Y: (y) => oy + (y1 - y) * ppm };
      const svg = s("svg.fig-svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img" });
      for (const it of items) svg.append(it.draw(T));
      placeLabels(svg, width, height);
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
