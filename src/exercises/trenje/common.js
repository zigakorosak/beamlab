// Shared bits of the friction (trenje) exercises: little vector helpers
// and the drawings they all reuse (a wedge-shaped incline with a block on
// it, a pulley or drum at its top corner).

import { rad } from "../kit.js";

export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const mul = (v, k) => [v[0] * k, v[1] * k];
/** Unit vector of a math angle in degrees. */
export const dir = (a) => [Math.cos(rad(a)), Math.sin(rad(a))];

/** Grade every answer against its own size (F_min may be far below F_max). */
export const own = (a) => ({ ...a, scale: Math.abs(a.value) });

/**
 * A block resting on an incline that rises at `alpha` from the origin.
 * `s`: distance of the block's lower edge from the foot of the incline
 * along the slope; `w` × `h`: block size (along / across the slope).
 * Returns the corners and the handy points of its faces.
 */
export function slopeBlock(alpha, s, w, h) {
  const u = dir(alpha); // up the slope
  const n = dir(alpha + 90); // out of the slope
  const p0 = mul(u, s);
  const p1 = add(p0, mul(u, w));
  const p2 = add(p1, mul(n, h));
  const p3 = add(p0, mul(n, h));
  return {
    u,
    n,
    pts: [p0, p1, p2, p3],
    centre: add(add(p0, mul(u, w / 2)), mul(n, h / 2)),
    up: add(p1, mul(n, h / 2)), // middle of the up-slope face
    down: add(p0, mul(n, h / 2)), // middle of the down-slope face
    top: add(p3, mul(u, w / 2)), // middle of the top face
    bottom: add(p0, mul(u, w / 2)), // middle of the contact face
  };
}

/** The incline as a wedge (right angle at the bottom right) on a floor. */
export function drawWedge(f, alpha, L, { angleLabel } = {}) {
  const top = mul(dir(alpha), L);
  f.polygon([[0, 0], [top[0], 0], top], "fig-body");
  f.ground([-0.4, 0], [top[0] + 0.4, 0]);
  f.angle([0, 0], 0, alpha, angleLabel ?? `${alpha}°`, 26);
  return top;
}

/**
 * Pulley or drum at the top corner of the wedge: a rope that runs parallel
 * to the slope at height `hr` above it goes over the wheel (radius r) and
 * hangs down vertically on the far side. Returns the wheel centre and the
 * point where the rope leaves it downwards.
 */
export function cornerWheel(alpha, L, hr, r) {
  const u = dir(alpha);
  const n = dir(alpha + 90);
  // The rope line is tangent to the wheel's top: centre is r below it.
  const c = add(add(mul(u, L), mul(n, hr - r)), mul(u, 0.3));
  return { c, leave: [c[0] + r, c[1]], touch: add(c, mul(n, r)), u, n };
}
