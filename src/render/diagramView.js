// Draws one internal-force diagram as a horizontal band under the beam,
// on the beam's x scale: axis, filled curve, value labels at key points
// and peaks, and a title on the left.

import { s } from "./svg.js";
import { fmt } from "../core/format.js";

export const DIAGRAMS = {
  N: { title: "N", unit: "kN", name: "Axial force", cls: "diag-n" },
  V: { title: "V", unit: "kN", name: "Shear force", cls: "diag-v" },
  M: { title: "M", unit: "kNm", name: "Bending moment", cls: "diag-m" },
  w: { title: "w", unit: "", name: "Deflected shape", cls: "diag-w" },
};

export const BAND_HEIGHT = 170;
const PAD = 22; // between the curve's peak and the band's edge

/**
 * band: { X, top, height?, kind: "N"|"V"|"M"|"w", points: [[x, v]…],
 *         labels: [{ x, value, side? }], flip: bool, scaleMax?, x0, x1 }
 * flip: draw positive values downward (moments on the tension side).
 * Returns { g, yOf } so callers can overlay things on the same scale.
 */
export function drawDiagram(band) {
  const { X, top, kind, points, labels = [], flip = false, x0, x1, faint = false } = band;
  const height = band.height ?? BAND_HEIGHT;
  const meta = DIAGRAMS[kind];
  const mid = top + height / 2;
  let max = band.scaleMax ?? Math.max(...points.map(([, v]) => Math.abs(v)), 0);
  if (!(max > 1e-9)) max = 1;
  const k = (height / 2 - PAD) / max;
  const yOf = (v) => mid + (flip ? 1 : -1) * v * k;

  const g = s(`g.diagram.${meta.cls}${faint ? ".is-faint" : ""}`);
  g.append(
    s("rect.band-bg", { x: X(x0) - 8, y: top + 4, width: X(x1) - X(x0) + 16, height: height - 8, rx: 6 }),
    s("line.axis", { x1: X(x0), y1: mid, x2: X(x1), y2: mid }),
  );
  // Title on the left: "V [kN]" and which way is positive.
  g.append(
    s("text.band-title", { x: X(x0) - 18, y: mid + 5, "text-anchor": "end", text: meta.title }),
    meta.unit ? s("text.band-unit", { x: X(x0) - 18, y: mid + 19, "text-anchor": "end", text: `[${meta.unit}]` }) : null,
    kind !== "w" ? s("text.band-sign", { x: X(x0) - 18, y: flip ? top + height - 12 : top + 20, "text-anchor": "end", text: "+" }) : null,
  );

  if (points.length) {
    const path = points.map(([x, v], i) => `${i ? "L" : "M"}${X(x).toFixed(2)} ${yOf(v).toFixed(2)}`).join(" ");
    const first = points[0];
    const last = points[points.length - 1];
    if (kind !== "w")
      g.append(
        s("path.diagram-fill", {
          d: `M${X(first[0])} ${mid} L${path.slice(1)} L${X(last[0])} ${mid} Z`,
        }),
      );
    g.append(s("path.diagram-line", { d: path }));
  }

  // Labels: skip zeros and anything colliding with a label already placed.
  const placed = [];
  for (const lb of labels) {
    if (Math.abs(lb.value) < 0.005) continue;
    const px = X(lb.x) + (lb.side === "-" ? -4 : lb.side === "+" ? 4 : 0);
    const above = (lb.value > 0) !== flip;
    const py = yOf(lb.value) + (above ? -6 : 15);
    const text = fmt(lb.value);
    const w = text.length * 7;
    const anchor = lb.side === "-" ? "end" : lb.side === "+" ? "start" : "middle";
    const left = anchor === "end" ? px - w : anchor === "start" ? px : px - w / 2;
    if (placed.some((p) => left < p.right + 4 && left + w > p.left - 4 && Math.abs(py - p.y) < 13)) continue;
    placed.push({ left, right: left + w, y: py });
    g.append(s(`text.value-label${lb.peak ? ".is-peak" : ""}`, { x: px, y: py, "text-anchor": anchor, text }));
    if (lb.peak) g.append(s("circle.peak-dot", { cx: X(lb.x), cy: yOf(lb.value), r: 3 }));
  }
  return { g, yOf, mid, k };
}

/**
 * Value labels for a solved diagram: both sides of each key point (one
 * label where they agree), plus `extra` (moment peaks).
 */
export function keyLabels(sol, fn, extra = []) {
  const out = [];
  for (const x of sol.xs) {
    const l = fn(x, "-");
    const r = fn(x, "+");
    const atStart = x === sol.xs[0];
    const atEnd = x === sol.xs[sol.xs.length - 1];
    if (atStart) out.push({ x, value: r, side: "+" });
    else if (atEnd) out.push({ x, value: l, side: "-" });
    else if (Math.abs(l - r) < 0.005) out.push({ x, value: l });
    else out.push({ x, value: l, side: "-" }, { x, value: r, side: "+" });
  }
  // Peaks first, so they win collisions.
  return [...extra.map((e) => ({ x: e.x, value: e.value, peak: true })), ...out];
}
