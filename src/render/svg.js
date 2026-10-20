// SVG element helper, the counterpart of ui/dom.js's h():
//   s("path.load", { d: "M0 0 L10 10", fill: "none" }, …children)

const NS = "http://www.w3.org/2000/svg";

export function s(tag, attrs = {}, ...children) {
  const [name, ...classes] = tag.split(".");
  const el = document.createElementNS(NS, name);
  if (classes.length) el.setAttribute("class", classes.join(" "));
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "text") el.textContent = v;
    else if (k === "dataset") for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
    else el.setAttribute(k, v);
  }
  el.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

/** A filled arrowhead with its tip at (x, y), pointing along (dx, dy). */
export function arrowHead(x, y, dx, dy, size = 9, attrs = {}) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = x - ux * size;
  const by = y - uy * size;
  const w = size * 0.5;
  return s("path", {
    d: `M${x} ${y} L${bx - uy * w} ${by + ux * w} L${bx + uy * w} ${by - ux * w} Z`,
    ...attrs,
  });
}

/** Arrow from (x1, y1) to the tip (x2, y2). */
export function arrow(x1, y1, x2, y2, { cls = "", size = 9, dashed = false } = {}) {
  return s(
    `g${cls ? "." + cls : ""}`,
    {},
    s("line", {
      x1,
      y1,
      x2: x2 - ((x2 - x1) / (Math.hypot(x2 - x1, y2 - y1) || 1)) * size * 0.6,
      y2: y2 - ((y2 - y1) / (Math.hypot(x2 - x1, y2 - y1) || 1)) * size * 0.6,
      "stroke-dasharray": dashed ? "5 4" : null,
    }),
    arrowHead(x2, y2, x2 - x1, y2 - y1, size),
  );
}

/**
 * A ¾-circle moment arrow around (cx, cy). `ccw` in the usual maths sense
 * (on screen, y down, that's the visually counterclockwise way round).
 */
export function momentArc(cx, cy, r, ccw, { cls = "", dashed = false } = {}) {
  // A 260° sweep over the top, gap at the bottom; the arrowhead sits at
  // the end of the sweep. Angles in maths convention (ccw = increasing).
  const a0 = ((ccw ? -60 : 240) * Math.PI) / 180;
  const a1 = ((ccw ? 200 : -20) * Math.PI) / 180;
  // Screen angles: y down, so a visually counterclockwise sweep runs to
  // decreasing screen angle.
  const p = (a) => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const sweep = ccw ? 0 : 1;
  const tangent = ccw ? [-Math.sin(a1), -Math.cos(a1)] : [Math.sin(a1), Math.cos(a1)];
  return s(
    `g${cls ? "." + cls : ""}`,
    {},
    s("path", {
      d: `M${x0} ${y0} A${r} ${r} 0 1 ${sweep} ${x1} ${y1}`,
      fill: "none",
      "stroke-dasharray": dashed ? "5 4" : null,
    }),
    arrowHead(x1 + tangent[0] * 4, y1 + tangent[1] * 4, tangent[0], tangent[1], 9),
  );
}
