// Figure layout: every exercise's figure and solution figure, drawn at a
// phone's and a desktop's width for many random tasks, must be readable:
//   (a) no text runs out of the picture,
//   (b) no two texts overlap (by more than OVERLAP px both ways),
//   (c) every value an N-T-M diagram should show is there,
//   (d) no text lies across a member, a rope or bar, a force's shaft, or the
//       outline of a circle (Mohr's circle, a pulley, a wheel, a round section).
// Text sizes follow style.css (font size per class) and the character
// widths Firefox measures for the app's font, a little generously.
//
//   LAYOUT_SEEDS=1000 npm test    a deeper run (default: SEEDS below; 1000 pass)

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { EXERCISES } from "../src/exercises/registry.js";
import { rng } from "../src/exercises/kit.js";

const SEEDS = Number(process.env.LAYOUT_SEEDS) || 200;
const WIDTHS = [326, 728];
const OVERLAP = 2; // px two texts may share both ways (anti-aliasing, generous boxes)
const CROSS = 2; // px a line's stroke may reach into a text's box

// Box heights the app gives figures (src/ui/exercises.js, drawFigure).
const taskHeight = (w) => Math.min(440, Math.max(300, Math.round(w * 0.62)));
const solutionHeight = (w) => Math.min(w < 600 ? 1000 : 720, Math.max(420, Math.round(w * (w < 600 ? 2.4 : 1.1))));

// --- A minimal DOM: draw.js only builds elements and reads attributes. ---
class El {
  constructor(tag) { this.tagName = tag; this.attrs = {}; this.children = []; this.text = ""; this.dataset = {}; this.parent = null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  append(...cs) {
    for (const c0 of cs) {
      const c = typeof c0 === "string" ? Object.assign(new El("#text"), { text: c0 }) : c0;
      c.parent = this;
      this.children.push(c);
    }
  }
  set textContent(v) { this.children = []; this.text = String(v); }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(""); }
  *walk() { for (const c of this.children) { yield c; yield* c.walk(); } }
  querySelectorAll(sel) { const tags = sel.split(",").map((t) => t.trim()); return [...this.walk()].filter((e) => tags.includes(e.tagName)); }
}
const classes = (el) => (el.getAttribute("class") || "").split(/\s+/).filter(Boolean);
const inClass = (el, cls) => { for (let e = el; e; e = e.parent) if (classes(e).includes(cls)) return true; return false; };

// --- Text size. Character advances (em) as Firefox measures the app's
// system-ui font, regular and bold; 3 % added. CSS font sizes beat the
// presentation attribute (".fig-value" is 11 px even with font-size="15px"). ---
const EM = {};
const put = (chars, reg, bold = reg) => { for (const c of chars) EM[c] = [reg, bold]; };
put("0123456789−+=Σ#", 0.572);
put(",.:;·", 0.268, 0.278);
put(" ", 0.27);
put("-", 0.322);
put("()", 0.3, 0.325);
put("[]", 0.33);
put("/", 0.372, 0.4);
put("|", 0.552);
put("°", 0.428);
put("'’", 0.25);
put("ilj", 0.258, 0.284);
put("ft", 0.362, 0.406);
put("r", 0.413, 0.435);
put("acesvxyzkγετ", 0.56, 0.587);
put("bdghnopqu", 0.618, 0.638);
put("w", 0.786, 0.83);
put("m", 0.935, 0.96);
put("IJ", 0.338, 0.37);
put("EFLPSTZYXV", 0.6, 0.64);
put("ABCKR", 0.65, 0.672);
put("DGHNOQUαβδθμρφσΔ", 0.78, 0.8);
put("MW", 0.93, 0.953);
put("⊕⊖≈√", 0.84);
put("²³", 0.35, 0.37);
const charEm = (c, bold) => (EM[c] ?? [0.7, 0.72])[bold ? 1 : 0];

const CSS_SIZE = [["fig-value", 11], ["fig-dim-label", 12], ["fig-angle-label", 12], ["fig-force-label", 13], ["fig-name", 13], ["fig-label", 13]];
function fontOf(t) {
  for (let e = t; e; e = e.parent) {
    const cs = classes(e);
    for (const [cls, px] of CSS_SIZE) if (cs.includes(cls)) return { size: px, bold: inClass(t, "fig-force-label") || t.getAttribute("font-weight") === "700" };
    if (cs.includes("fig-axis")) return { size: 12, bold: false };
  }
  const attr = parseFloat(t.getAttribute("font-size"));
  return { size: Number.isFinite(attr) ? attr : 16, bold: t.getAttribute("font-weight") === "700" };
}

/** The text's box: 4 corners on screen (rotation included) and its local frame. */
function textGeom(t) {
  const { size, bold } = fontOf(t);
  const parts = t.children.length ? t.children : [t];
  let w = 0, sub = false, sup = false;
  for (const p of parts) {
    const str = (p.tagName === "#text" || p === t ? p.text : p.textContent).replace(/​/g, "");
    const k = p.getAttribute?.("font-size") === "75%" ? 0.75 : 1;
    const bs = p.getAttribute?.("baseline-shift");
    if (str && bs === "-25%") sub = true;
    if (str && bs === "40%") sup = true;
    for (const c of str) w += charEm(c, bold) * size * k;
  }
  w *= 1.03;
  const x = Number(t.getAttribute("x")), y = Number(t.getAttribute("y"));
  const anchor = t.getAttribute("text-anchor") || "start";
  const x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
  const box = { x0, x1: x0 + w, y0: y - 0.74 * size - (sup ? 0.3 * size : 0), y1: y + 0.2 * size + (sub ? 0.25 * size : 0) };
  const m = /rotate\(([-\d.e]+)[ ,]+([-\d.e]+)[ ,]+([-\d.e]+)\)/.exec(t.getAttribute("transform") || "");
  const [ang, cx, cy] = m ? m.slice(1).map(Number) : [0, x, y];
  const c = Math.cos((ang * Math.PI) / 180), sn = Math.sin((ang * Math.PI) / 180);
  const toScreen = ([px, py]) => [cx + (px - cx) * c - (py - cy) * sn, cy + (px - cx) * sn + (py - cy) * c];
  const toLocal = ([px, py]) => [cx + (px - cx) * c + (py - cy) * sn, cy - (px - cx) * sn + (py - cy) * c];
  const corners = [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1]].map(toScreen);
  return { t, text: t.textContent.replace(/​/g, ""), box, corners, toLocal, axes: [[c, sn], [-sn, c]] };
}

/** How far two boxes overlap along the axis that separates them best (SAT). */
function penetration(A, B) {
  let least = Infinity;
  for (const [ax, ay] of [...A.axes, ...B.axes]) {
    const pa = A.corners.map(([x, y]) => x * ax + y * ay), pb = B.corners.map(([x, y]) => x * ax + y * ay);
    least = Math.min(least, Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)));
  }
  return least;
}

/** Does segment p→q enter box B (Liang–Barsky)? */
function segHitsBox(B, p, q) {
  let t0 = 0, t1 = 1;
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const P = [-dx, dx, -dy, dy], Q = [p[0] - B.x0, B.x1 - p[0], p[1] - B.y0, B.y1 - p[1]];
  for (let i = 0; i < 4; i++) {
    if (P[i] === 0) { if (Q[i] < 0) return false; }
    else {
      const r = Q[i] / P[i];
      if (P[i] < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/** Points along an SVG circular arc from p to q (the spec's centre construction). */
function arcPts([x1, y1], r, large, sweep, [x2, y2]) {
  const mx = (x1 - x2) / 2, my = (y1 - y2) / 2, d2 = mx * mx + my * my;
  if (d2 < 1e-12) return [[x2, y2]];
  r = Math.max(Math.abs(r), Math.sqrt(d2));
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (r * r - d2) / d2));
  const cx = k * my + (x1 + x2) / 2, cy = -k * mx + (y1 + y2) / 2;
  const t1 = Math.atan2(y1 - cy, x1 - cx);
  let dt = Math.atan2(y2 - cy, x2 - cx) - t1;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  const out = [];
  for (let i = 1; i <= 24; i++) out.push([cx + r * Math.cos(t1 + (dt * i) / 24), cy + r * Math.sin(t1 + (dt * i) / 24)]);
  return out;
}

/** Lines a text must not lie on: members, ropes and bars, forces' shafts, circles' outlines (half their stroke width). */
function blockingLines(svg) {
  const out = [];
  for (const el of svg.walk()) {
    if (el.tagName === "path" && classes(el).includes("fig-rope")) {
      // A rope round a pulley: M … A …, the arc sampled.
      const n = (el.getAttribute("d").match(/-?[\d.]+(?:e-?\d+)?/g) || []).map(Number);
      let cur = [n[0], n[1]];
      for (let i = 2; i + 6 < n.length; i += 7) {
        const ps = arcPts(cur, n[i], n[i + 3], n[i + 4], [n[i + 5], n[i + 6]]);
        for (const q of ps) { out.push({ p: cur, q, half: 0.8, what: "fig-rope" }); cur = q; }
      }
      continue;
    }
    if (el.tagName === "circle") {
      // A circle's outline (Mohr's circle, a pulley, a wheel, a round section):
      // text fully inside or outside is fine, text across the stroke is not.
      // (Hinges, dots and a roller's wheels are too small to matter.)
      const cls = ["fig-rope", "fig-body", "fig-hole"].find((c) => classes(el).includes(c));
      if (!cls) continue;
      const cx = +el.getAttribute("cx"), cy = +el.getAttribute("cy"), r = +el.getAttribute("r");
      const N = 72, at = (k) => [cx + r * Math.cos((2 * Math.PI * k) / N), cy + r * Math.sin((2 * Math.PI * k) / N)];
      for (let k = 0; k < N; k++) out.push({ p: at(k), q: at(k + 1), half: 0.8, what: `${cls} circle` });
      continue;
    }
    if (el.tagName !== "line" && el.tagName !== "polyline") continue;
    const cs = classes(el);
    let half = 0;
    if (cs.includes("fig-member")) half = 2.5;
    else if (cs.includes("fig-rope")) half = 0.8;
    else if (!cs.length && el.tagName === "line" && (inClass(el, "fig-force") || inClass(el, "fig-load")) && !inClass(el, "fig-axis")) half = 0.9;
    if (!half) continue;
    const pts = el.tagName === "line"
      ? [[+el.getAttribute("x1"), +el.getAttribute("y1")], [+el.getAttribute("x2"), +el.getAttribute("y2")]]
      : (el.getAttribute("points") || "").trim().split(/\s+/).map((p) => p.split(",").map(Number));
    for (let i = 1; i < pts.length; i++) out.push({ p: pts[i - 1], q: pts[i], half, what: cs[0] ?? "shaft" });
  }
  return out;
}

/** Everything wrong with one rendered figure, as short messages. */
function layoutProblems(svg) {
  const W = Number(svg.getAttribute("width")), H = Number(svg.getAttribute("height"));
  const texts = [...svg.walk()].filter((e) => e.tagName === "text" && e.textContent.replace(/[​\s]/g, "")).map(textGeom);
  const out = [];
  const q = (g) => `"${g.text}"`;
  for (const g of texts) {
    const xs = g.corners.map((c) => c[0]), ys = g.corners.map((c) => c[1]);
    const over = Math.max(-Math.min(...xs), Math.max(...xs) - W, -Math.min(...ys), Math.max(...ys) - H);
    if (over > 0.5) out.push(`${q(g)} cut off by ${over.toFixed(1)} px`);
  }
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++) {
      const d = penetration(texts[i], texts[j]);
      if (d > OVERLAP) out.push(`${q(texts[i])} overlaps ${q(texts[j])} by ${d.toFixed(1)} px`);
    }
  const lines = blockingLines(svg);
  for (const g of texts) {
    const b = g.box;
    for (const ln of lines) {
      const e = ln.half - CROSS;
      const B = { x0: b.x0 - e, x1: b.x1 + e, y0: b.y0 - e, y1: b.y1 + e };
      if (B.x1 <= B.x0 || B.y1 <= B.y0) continue;
      if (segHitsBox(B, g.toLocal(ln.p), g.toLocal(ln.q))) {
        out.push(`${q(g)} lies on a ${ln.what} line`);
        break;
      }
    }
  }
  // N-T-M diagrams list the values they must show (data-values on their group).
  for (const el of [svg, ...svg.walk()]) {
    const want = el.getAttribute?.("data-values");
    if (!want) continue;
    const shown = [...el.walk()].filter((e) => e.tagName === "text" && classes(e).includes("fig-value")).map((e) => e.textContent);
    for (const v of JSON.parse(want)) {
      const k = shown.indexOf(v);
      if (k < 0) out.push(`value ${v} not drawn`);
      else shown.splice(k, 1);
    }
  }
  return out;
}

const saved = globalThis.document;
globalThis.document = { createElementNS: (ns, tag) => new El(tag) };
const { figure } = await import("../src/exercises/draw.js");

for (const ex of EXERCISES) {
  test(`figure layout: ${ex.id} (${SEEDS} tasks × ${WIDTHS.join(" / ")} px)`, () => {
    const fails = [];
    let count = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const task = ex.build(ex.generate(rng(seed * 7919)));
      for (const width of WIDTHS)
        for (const [kind, draw, h] of [["task", task.figure, taskHeight], ["solution", task.solutionFigure, solutionHeight]]) {
          if (!draw) continue;
          const f = figure();
          draw(f);
          const probs = layoutProblems(f.render(width, h(width)));
          if (probs.length) count++;
          for (const p of probs) fails.push(`seed ${seed * 7919}, ${kind}, ${width} px: ${p}`);
        }
    }
    assert.equal(fails.length, 0, `${ex.id}: ${count} figures with problems\n  ${fails.slice(0, 12).join("\n  ")}${fails.length > 12 ? `\n  … ${fails.length - 12} more` : ""}`);
  });
}

test("placeLabels sees a couple's arc where it is drawn, not as its chord", () => {
  for (const ccw of [true, false]) {
    const f = figure();
    f.member([0, 0], [4, 0]);
    f.moment([2, 0], ccw, "M");
    // A label with two places: on top of the arc, or clear below the beam.
    f.custom([[2, 0]], (T) => {
      const t = new El("text");
      t.setAttribute("class", "fig-label");
      t.textContent = "XX";
      t.alts = [[T.X(2), T.Y(0) - 12, "middle"], [T.X(2), T.Y(0) + 40, "middle"]];
      return t;
    });
    const svg = f.render(400, 300);
    const t = [...svg.walk()].find((e) => e.tagName === "text" && e.textContent === "XX");
    const beamY = Number([...svg.walk()].find((e) => classes(e).includes("fig-member")).getAttribute("y1"));
    assert.ok(Number(t.getAttribute("y")) > beamY, `ccw ${ccw}: the label stayed on the arc`);
  }
});

after(() => { globalThis.document = saved; });
