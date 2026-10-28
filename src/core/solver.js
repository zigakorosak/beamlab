// Beam solver.
//
// 1. Reactions from a small finite-element model (Euler–Bernoulli beam
//    elements with an axial bar, EI = EA = 1). Nodes sit at every key point,
//    so with consistent nodal loads the nodal results are exact — for
//    statically determinate and indeterminate beams alike (a uniform EI
//    doesn't change the reactions). A singular stiffness matrix means a
//    mechanism, which is reported instead of solved.
// 2. Internal forces N, V, M by the method of sections: everything left of
//    the cut, reactions included, in closed form — no numerical noise in
//    the diagrams.
// 3. The deflected shape (shape only, EI = 1) from the FEM nodal values,
//    integrating the exact M inside each element.
//
// Sign conventions (DESIGN.md "Sign conventions"): x to the right, y up,
// moments counterclockwise positive for loads and reactions. Internal
// forces: N > 0 in tension; V > 0 when the forces left of the cut push up;
// M > 0 sagging (bottom fibres in tension).

import {
  EPS_X,
  keyPoints,
  near,
  pointComponents,
  supportNames,
} from "./model.js";

export function solve(model) {
  const fail = (error) => ({ ok: false, error });
  if (!model.beam) return fail("Drag a beam onto the grid to start.");
  const L = model.beam.length;
  if (!(L > 0)) return fail("The beam needs a length.");
  if (!model.supports.length) return fail("Add supports — a beam with none just falls.");

  const xs = keyPoints(model);
  for (let i = 0; i < model.supports.length; i++)
    for (let j = i + 1; j < model.supports.length; j++)
      if (near(model.supports[i].x, model.supports[j].x)) return fail("Two supports at the same point — remove one.");
  for (const g of model.hinges)
    if (model.supports.some((s) => s.type === "fixed" && near(s.x, g.x)))
      return fail("A hinge can't sit on a fixed support.");

  // ---- DOF numbering: u, v per node; θ per node, two at a hinge (left/right).
  let ndof = 0;
  const nodes = xs.map((x, i) => {
    const interior = i > 0 && i < xs.length - 1;
    const hinge = interior && model.hinges.some((g) => near(g.x, x));
    const n = { x, u: ndof++, v: ndof++ };
    n.thL = ndof++;
    n.thR = hinge ? ndof++ : n.thL;
    return n;
  });
  const nodeAt = (x) => nodes.find((n) => near(n.x, x));

  const K = Array.from({ length: ndof }, () => new Float64Array(ndof));
  const F = new Float64Array(ndof);

  // ---- Elements
  const elems = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const l = b.x - a.x;
    const dofs = [a.u, a.v, a.thR, b.u, b.v, b.thL];
    const k = elementStiffness(l);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) K[dofs[r]][dofs[c]] += k[r][c];
    elems.push({ a, b, l, dofs });
  }

  // ---- Loads
  for (const load of model.loads) {
    if (load.type === "point") {
      const n = nodeAt(load.x);
      const { fx, fy } = pointComponents(load);
      F[n.u] += fx;
      F[n.v] += fy;
    } else if (load.type === "moment") {
      F[nodeAt(load.x).thR] += load.value;
    } else if (load.type === "dist") {
      for (const e of elems) {
        if (e.a.x < load.x1 - EPS_X || e.b.x > load.x2 + EPS_X) continue;
        const q = (x) => load.q1 + ((load.q2 - load.q1) * (x - load.x1)) / (load.x2 - load.x1);
        const f = consistentLoads(e.l, -q(e.a.x), -q(e.b.x)); // y up, q down
        F[e.dofs[1]] += f[0];
        F[e.dofs[2]] += f[1];
        F[e.dofs[4]] += f[2];
        F[e.dofs[5]] += f[3];
      }
    }
  }

  // ---- Restraints
  const fixed = new Set();
  const restraintOf = []; // { support, comp, dof }
  for (const s of model.supports) {
    const n = nodeAt(s.x);
    const add = (comp, dof) => {
      fixed.add(dof);
      restraintOf.push({ support: s, comp, dof });
    };
    if (s.type === "pin" || s.type === "fixed") add("x", n.u);
    add("y", n.v);
    if (s.type === "fixed") add("m", n.thL);
  }

  // Axial and bending don't couple in a straight beam: solving them apart
  // tells the student *which* way the beam is unstable.
  const isU = new Set(nodes.map((n) => n.u));
  const freeAxial = [];
  const freeBending = [];
  for (let d = 0; d < ndof; d++) if (!fixed.has(d)) (isU.has(d) ? freeAxial : freeBending).push(d);

  const disp = new Float64Array(ndof);
  if (!solveSubsystem(K, F, freeAxial, disp))
    return fail("Unstable: nothing stops the beam sliding sideways. Use a pinned or fixed support somewhere.");
  if (!solveSubsystem(K, F, freeBending, disp))
    return fail(
      model.hinges.length
        ? "Unstable: the beam is a mechanism — it can move or turn. Add a support or remove a hinge."
        : "Unstable: the beam can move or turn freely. Add another support.",
    );

  // ---- Reactions R = K·u − F at the restrained DOFs.
  const names = supportNames(model);
  const reactions = model.supports
    .map((s) => ({ id: s.id, name: names.get(s.id), type: s.type, x: s.x, Rx: 0, Ry: 0, M: 0 }))
    .sort((a, b) => a.x - b.x);
  const byId = new Map(reactions.map((r) => [r.id, r]));
  for (const { support, comp, dof } of restraintOf) {
    let r = -F[dof];
    for (let c = 0; c < ndof; c++) r += K[dof][c] * disp[c];
    r = clean(r);
    const target = byId.get(support.id);
    if (comp === "x") target.Rx = r;
    else if (comp === "y") target.Ry = r;
    else target.M = r;
  }

  // ---- Everything acting on the beam, for the method of sections.
  const points = []; // { x, fx, fy }
  const couples = []; // { x, c } counterclockwise
  const dists = model.loads.filter((l) => l.type === "dist");
  for (const l of model.loads) {
    if (l.type === "point") points.push({ x: l.x, ...pointComponents(l) });
    else if (l.type === "moment") couples.push({ x: l.x, c: l.value });
  }
  for (const r of reactions) {
    points.push({ x: r.x, fx: r.Rx, fy: r.Ry });
    if (r.M) couples.push({ x: r.x, c: r.M });
  }

  // side "-": the limit from the left (x⁻), "+": from the right (x⁺).
  const leftOf = (xi, x, side) => (side === "+" ? xi <= x + EPS_X : xi < x - EPS_X);
  const N = (x, side = "+") => {
    let s = 0;
    for (const p of points) if (leftOf(p.x, x, side)) s -= p.fx;
    return clean(s);
  };
  const V = (x, side = "+") => {
    let s = 0;
    for (const p of points) if (leftOf(p.x, x, side)) s += p.fy;
    for (const d of dists) s -= distIntegrals(d, x).F;
    return clean(s);
  };
  const M = (x, side = "+") => {
    let s = 0;
    for (const p of points) if (leftOf(p.x, x, side)) s += p.fy * (x - p.x);
    for (const c of couples) if (leftOf(c.x, x, side)) s -= c.c;
    for (const d of dists) s -= distIntegrals(d, x).M;
    return clean(s);
  };

  const result = {
    ok: true,
    L,
    xs,
    reactions,
    degree: indeterminacy(model),
    hasAxial: points.some((p) => Math.abs(p.fx) > 1e-9),
    N,
    V,
    M,
  };
  result.deflection = deflectionShape(result, nodes, disp);
  return result;
}

/** Degree of static indeterminacy: reactions − 3 − internal hinges. */
export function indeterminacy(model) {
  const r = model.supports.reduce((n, s) => n + { pin: 2, roller: 1, fixed: 3 }[s.type], 0);
  return r - 3 - model.hinges.length;
}

// Snap tiny round-off to 0 and to the nearest 1e-9, so a hand-checkable
// value prints as 12.5, not 12.499999999999998.
function clean(v) {
  const r = Math.round(v * 1e9) / 1e9;
  return Math.abs(r) < 1e-9 ? 0 : r;
}

/** Frame element (EA = EI = 1), DOFs [u1 v1 θ1 u2 v2 θ2]. */
function elementStiffness(l) {
  const a = 1 / l;
  const b1 = 12 / l ** 3;
  const b2 = 6 / l ** 2;
  const b3 = 4 / l;
  const b4 = 2 / l;
  return [
    [a, 0, 0, -a, 0, 0],
    [0, b1, b2, 0, -b1, b2],
    [0, b2, b3, 0, -b2, b4],
    [-a, 0, 0, a, 0, 0],
    [0, -b1, -b2, 0, b1, -b2],
    [0, b2, b4, 0, -b2, b3],
  ];
}

// 3-point Gauss on [0, 1]: exact up to degree 5 (cubic shape × linear load).
const GAUSS = [
  [0.5 - Math.sqrt(15) / 10, 5 / 18],
  [0.5, 8 / 18],
  [0.5 + Math.sqrt(15) / 10, 5 / 18],
];

/** Consistent nodal loads [v1 θ1 v2 θ2] for a linear transverse load p1 → p2 (y up). */
function consistentLoads(l, p1, p2) {
  const f = [0, 0, 0, 0];
  for (const [xi, w] of GAUSS) {
    const p = p1 + (p2 - p1) * xi;
    const Nf = [1 - 3 * xi ** 2 + 2 * xi ** 3, l * (xi - 2 * xi ** 2 + xi ** 3), 3 * xi ** 2 - 2 * xi ** 3, l * (-(xi ** 2) + xi ** 3)];
    for (let i = 0; i < 4; i++) f[i] += Nf[i] * p * w * l;
  }
  return f;
}

/**
 * Of a distributed load, the part left of x: its resultant F = ∫q dξ and
 * its moment about the cut M = ∫q(ξ)(x − ξ) dξ, in closed form.
 */
function distIntegrals(d, x) {
  const a = d.x1;
  const c = Math.min(x, d.x2);
  if (c <= a) return { F: 0, M: 0 };
  // q(ξ) = α + βξ
  const beta = (d.q2 - d.q1) / (d.x2 - d.x1);
  const alpha = d.q1 - beta * a;
  const d1 = c - a;
  const d2 = (c * c - a * a) / 2;
  const d3 = (c ** 3 - a ** 3) / 3;
  return { F: alpha * d1 + beta * d2, M: alpha * x * d1 - alpha * d2 + beta * x * d2 - beta * d3 };
}

/**
 * Gaussian elimination with partial pivoting on the rows/columns `free`,
 * writing the solution into `out`. Returns false for a singular system
 * (a mechanism). Restrained DOFs have zero displacement, so no RHS terms
 * come from them.
 */
function solveSubsystem(K, F, free, out) {
  const n = free.length;
  if (!n) return true;
  const A = free.map((r) => free.map((c) => K[r][c]));
  const b = free.map((r) => F[r]);
  let scale = 0;
  for (let i = 0; i < n; i++) scale = Math.max(scale, Math.abs(A[i][i]));
  const tol = 1e-9 * (scale || 1);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < tol) return false;
    [A[col], A[piv]] = [A[piv], A[col]];
    [b[col], b[piv]] = [b[piv], b[col]];
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / A[col][col];
      if (!f) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < n; c++) s -= A[i][c] * out[free[c]];
    out[free[i]] = s / A[i][i];
  }
  return true;
}

/**
 * The deflected shape, w(x) with EI = 1 (only the shape is meaningful: the
 * section isn't modelled). Inside each element, start from the exact nodal
 * v and θ and integrate EI·w'' = M twice.
 */
function deflectionShape(sol, nodes, disp) {
  const pts = [];
  const steps = 40;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const l = b.x - a.x;
    const h = l / steps;
    let w = disp[a.v];
    let th = disp[a.thR];
    let kPrev = sol.M(a.x, "+");
    pts.push([a.x, w]);
    for (let s = 1; s <= steps; s++) {
      const x = a.x + s * h;
      const k = s === steps ? sol.M(b.x, "-") : sol.M(x);
      // Trapezoid on θ, and the matching exact-for-linear-κ step on w.
      w += th * h + (h * h * (2 * kPrev + k)) / 6;
      th += (h * (kPrev + k)) / 2;
      kPrev = k;
      pts.push([x, s === steps ? disp[b.v] : w]);
    }
  }
  return pts;
}

/**
 * The diagram as a polyline [[x, value], …], exact at every key point:
 * a jump shows as two points with the same x.
 */
export function sampleDiagram(sol, fn, perSegment = 48) {
  const out = [];
  const xs = sol.xs;
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    out.push([a, fn(a, "+")]);
    for (let s = 1; s < perSegment; s++) {
      const x = a + ((b - a) * s) / perSegment;
      out.push([x, fn(x)]);
    }
    out.push([b, fn(b, "-")]);
  }
  return out;
}

/**
 * Where the moment peaks between key points: the zeros of V inside each
 * segment (V is at most quadratic there), found by sampling + bisection.
 */
export function momentExtrema(sol) {
  const out = [];
  const xs = sol.xs;
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    const n = 64;
    let x0 = a;
    let v0 = sol.V(a, "+");
    for (let s = 1; s <= n; s++) {
      const x1 = a + ((b - a) * s) / n;
      const v1 = s === n ? sol.V(b, "-") : sol.V(x1);
      if (v1 === 0 && v0 !== 0 && s < n) {
        // Lands exactly on a sample (a symmetric beam's midspan).
        out.push({ x: x1, value: sol.M(x1) });
      } else if ((v0 > 0 && v1 < 0) || (v0 < 0 && v1 > 0)) {
        let lo = x0;
        let hi = x1;
        for (let k = 0; k < 60; k++) {
          const mid = (lo + hi) / 2;
          if (Math.sign(sol.V(mid)) === Math.sign(v0)) lo = mid;
          else hi = mid;
        }
        const x = (lo + hi) / 2;
        if (x - a > 1e-6 && b - x > 1e-6) out.push({ x, value: sol.M(x) });
      }
      x0 = x1;
      v0 = v1;
    }
  }
  return out;
}

/** Largest |value| on a diagram — for scaling and tolerances. */
export function maxAbs(sol, fn) {
  let m = 0;
  for (const [, v] of sampleDiagram(sol, fn, 24)) m = Math.max(m, Math.abs(v));
  if (fn === sol.M) for (const e of momentExtrema(sol)) m = Math.max(m, Math.abs(e.value));
  return m;
}
