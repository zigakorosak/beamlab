// A solver for plane, statically determinate frames (okvirji, nosilci z
// lomljeno osjo): straight members between nodes, joined rigidly or by
// internal hinges, with pin / roller / clamped supports.
//
// Model (units: m, kN, kNm; angles in degrees from +x, counterclockwise):
//   nodes:    { A: [x, y], … }
//   members:  [{ id, a, b, dashed: "right" | "left" }]
//             a member runs from node a to node b; its local coordinate s
//             goes from a (s = 0) to b (s = L). `dashed` says on which side
//             of a→b the dashed fibre (črtkano vlakno) lies.
//   supports: [{ node, type: "pin" | "roller" | "clamp", angle?, names? }]
//             pin: Rx, Ry; clamp: Rx, Ry, M; roller: one reaction along
//             `angle` (positive in that direction). A two-force bar or
//             rope is a roller whose angle points from the node along the
//             bar to its far end, so its reaction is the bar's tension.
//   hinges:   [{ node, member }]  the end of `member` at `node` carries no
//             moment (M = 0 there).
//   loads:    { type: "force", node | member + at, F, angle }
//             { type: "moment", node | member + at, M }       (ccw +)
//             { type: "dist", member, q, q1?, from?, to?, angle | "perp",
//               per: "length" | "projection" }
//             A distributed load is q per metre (linear from q at s = from
//             to q1 at s = to). "length": per metre of the member;
//             "projection": per metre of the member's projection on a line
//             perpendicular to the load (a vertical load per horizontal
//             metre, as the exams load inclined roofs and stairs), so the
//             force on a piece ds is q·|sin(angle between member and load)|·ds.
//             angle "perp" = perpendicular to the member, towards the
//             dashed side.
// The structure must be a tree (no closed loops); the supports make it
// determinate: #reactions = 3 + #hinges, and the equations must not be
// singular (that is checked: a degenerate support system throws).
//
// Sign convention for internal forces (as in the course: look at each
// member like a beam with its dashed fibre at the bottom and s to the right):
//   e  unit vector a→b,  n  unit normal towards the dashed side.
//   At a section s, the part s…b ("the right part", with everything beyond
//   b) acts on the part a…s with the resultant (F_R, M_R) of all external
//   loads and reactions on the right part, reduced to the section. Then
//     N = F_R·e                        tension positive
//     T = F_R·n                        "down" on the right face
//     M = −(e×n)·M_R                   positive when the dashed fibre is in tension
//   so that dM/ds = T and dT/ds = −q⊥ (q⊥: load per metre towards n).

const EPS = 1e-9;
const rad = (d) => (d * Math.PI) / 180;
const cross = (u, v) => u[0] * v[1] - u[1] * v[0];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1];

export function solveFrame(model) {
  const nodes = model.nodes;
  const members = model.members.map((m) => {
    const A = nodes[m.a], B = nodes[m.b];
    if (!A || !B) throw new Error(`member ${m.id}: unknown node`);
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const e = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
    // Right of a→b is (ey, −ex); left is (−ey, ex).
    const n = m.dashed === "left" ? [-e[1], e[0]] : [e[1], -e[0]];
    return { ...m, A, B, L, e, n, c: cross(e, n) };
  });
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));

  // Tree check and, for each member, the nodes beyond its end b.
  const names = Object.keys(nodes);
  if (members.length !== names.length - 1) throw new Error("frame must be a tree (members = nodes − 1)");
  const adj = Object.fromEntries(names.map((k) => [k, []]));
  for (const m of members) {
    adj[m.a].push(m);
    adj[m.b].push(m);
  }
  for (const m of members) {
    const seen = new Set([m.b]);
    const stack = [m.b];
    while (stack.length) {
      const k = stack.pop();
      for (const o of adj[k]) {
        if (o === m) continue;
        const other = o.a === k ? o.b : o.a;
        if (!seen.has(other)) {
          seen.add(other);
          stack.push(other);
        }
      }
    }
    if (seen.has(m.a)) throw new Error("frame must be a tree (closed loop)");
    m.beyond = seen;
  }

  // Loads as items: point forces / moments owned by a node or a member
  // position, and distributed loads as global force densities per metre.
  const pointOf = (it) => {
    if (it.node) return nodes[it.node];
    const m = byId[it.member];
    return [m.A[0] + m.e[0] * it.at, m.A[1] + m.e[1] * it.at];
  };
  const loadItems = model.loads.map((l) => {
    if (l.type === "force") return { kind: "F", label: l.label, node: l.node, member: l.member, at: l.at, p: pointOf(l), F: [l.F * Math.cos(rad(l.angle)), l.F * Math.sin(rad(l.angle))] };
    if (l.type === "moment") return { kind: "M", label: l.label, node: l.node, member: l.member, at: l.at, M: l.M };
    const m = byId[l.member];
    let d, factor = 1;
    if (l.angle === "perp") d = m.n;
    else {
      d = [Math.cos(rad(l.angle)), Math.sin(rad(l.angle))];
      if (l.per === "projection") factor = Math.abs(cross(m.e, d));
    }
    const from = l.from ?? 0, to = l.to ?? m.L;
    return { kind: "D", label: l.label, member: l.member, from, to, q0: l.q * factor, q1: (l.q1 ?? l.q) * factor, d };
  });

  // Reaction unknowns: unit items.
  const unknowns = [];
  for (const sup of model.supports) {
    const p = nodes[sup.node];
    const nm = sup.names ?? (sup.type === "roller" ? [sup.node] : sup.type === "pin" ? [`${sup.node}_x`, `${sup.node}_y`] : [`${sup.node}_x`, `${sup.node}_y`, `M_${sup.node}`]);
    if (sup.type === "roller") unknowns.push({ name: nm[0], node: sup.node, kind: "F", p, dir: [Math.cos(rad(sup.angle)), Math.sin(rad(sup.angle))], angle: sup.angle });
    else {
      unknowns.push({ name: nm[0], node: sup.node, kind: "F", p, dir: [1, 0], angle: 0 });
      unknowns.push({ name: nm[1], node: sup.node, kind: "F", p, dir: [0, 1], angle: 90 });
      if (sup.type === "clamp") unknowns.push({ name: nm[2], node: sup.node, kind: "M" });
    }
  }
  const unitItem = (u, v = 1) => (u.kind === "F" ? { kind: "F", node: u.node, p: u.p, F: [u.dir[0] * v, u.dir[1] * v] } : { kind: "M", node: u.node, M: v });

  /** Resultant of `items` on the right part of section (m, s), about the section point. */
  function rightResultant(m, s, side, items) {
    const P = [m.A[0] + m.e[0] * s, m.A[1] + m.e[1] * s];
    let Fx = 0, Fy = 0, M = 0;
    const addF = (p, F) => {
      Fx += F[0];
      Fy += F[1];
      M += cross([p[0] - P[0], p[1] - P[1]], F);
    };
    const inRight = (it) => {
      if (it.node) return m.beyond.has(it.node);
      if (it.member !== m.id) {
        const k = byId[it.member];
        return m.beyond.has(k.a) && m.beyond.has(k.b);
      }
      return it.at > s + EPS || (Math.abs(it.at - s) <= EPS && side === "-");
    };
    for (const it of items) {
      if (it.kind === "D") {
        let u0 = it.from, u1 = it.to;
        const k = byId[it.member];
        if (it.member === m.id) u0 = Math.max(u0, s);
        else if (!(m.beyond.has(k.a) && m.beyond.has(k.b))) continue;
        if (u1 - u0 <= EPS) continue;
        // Simpson's rule is exact here: q is linear, q·u quadratic.
        const qAt = (u) => it.q0 + ((it.q1 - it.q0) * (u - it.from)) / (it.to - it.from);
        const um = (u0 + u1) / 2;
        const R = ((u1 - u0) / 6) * (qAt(u0) + 4 * qAt(um) + qAt(u1));
        const S1 = ((u1 - u0) / 6) * (qAt(u0) * u0 + 4 * qAt(um) * um + qAt(u1) * u1);
        if (Math.abs(R) < 1e-14) continue;
        const uc = S1 / R;
        addF([k.A[0] + k.e[0] * uc, k.A[1] + k.e[1] * uc], [it.d[0] * R, it.d[1] * R]);
      } else if (inRight(it)) {
        if (it.kind === "F") addF(it.p, it.F);
        else M += it.M;
      }
    }
    return { F: [Fx, Fy], M };
  }

  // Equations: ΣFx, ΣFy, ΣM about the origin, and M = 0 at every hinge.
  const all = (items) => {
    let Fx = 0, Fy = 0, M = 0;
    for (const it of items) {
      if (it.kind === "F") {
        Fx += it.F[0];
        Fy += it.F[1];
        M += cross(it.p, it.F);
      } else if (it.kind === "M") M += it.M;
      else {
        const k = byId[it.member];
        const R = ((it.to - it.from) * (it.q0 + it.q1)) / 2;
        if (Math.abs(R) < 1e-14) continue;
        const uc = it.from + ((it.to - it.from) * (it.q0 + 2 * it.q1)) / (3 * (it.q0 + it.q1));
        const F = [it.d[0] * R, it.d[1] * R];
        Fx += F[0];
        Fy += F[1];
        M += cross([k.A[0] + k.e[0] * uc, k.A[1] + k.e[1] * uc], F);
      }
    }
    return [Fx, Fy, M];
  };
  const hinges = model.hinges ?? [];
  const sectionM = (m, s, side, items) => -m.c * rightResultant(m, s, side, items).M;
  const hingeEq = (h, items) => {
    const m = byId[h.member];
    return h.node === m.b ? sectionM(m, m.L, "-", items) : sectionM(m, 0, "+", items);
  };
  const eqs = (items) => [...all(items), ...hinges.map((h) => hingeEq(h, items))];

  const nEq = 3 + hinges.length;
  if (unknowns.length !== nEq) throw new Error(`statically ${unknowns.length < nEq ? "under" : "over"}determinate: ${unknowns.length} reactions, ${nEq} equations`);
  const Amat = Array.from({ length: nEq }, () => new Array(nEq).fill(0));
  unknowns.forEach((u, j) => eqs([unitItem(u)]).forEach((v, i) => (Amat[i][j] = v)));
  const rhs = eqs(loadItems).map((v) => -v);
  const values = gauss(Amat, rhs);
  if (!values) throw new Error("degenerate supports: the frame is not stable");

  const reactions = unknowns.map((u, j) => ({ ...u, value: values[j] }));
  const items = [...loadItems, ...reactions.map((u) => unitItem(u, u.value))];

  // Internal forces of each member.
  const out = {};
  for (const m of members) {
    const at = (s, side = "+") => {
      const r = rightResultant(m, s, side, items);
      return { N: dot(r.F, m.e), T: dot(r.F, m.n), M: -m.c * r.M };
    };
    const bp = new Set([0, m.L]);
    for (const it of items) {
      if (it.member !== m.id) continue;
      if (it.kind === "D") {
        bp.add(it.from);
        bp.add(it.to);
      } else bp.add(it.at);
    }
    const breaks = [...bp].sort((x, y) => x - y).filter((v, i, arr) => i === 0 || v - arr[i - 1] > 1e-9);
    // Extremes of M inside a field, where T changes sign.
    const extremes = [];
    for (let i = 0; i + 1 < breaks.length; i++) {
      const s0 = breaks[i], s1 = breaks[i + 1];
      const N = 64;
      const Tat = (s) => at(s, "+").T;
      const ss = [], ts = [];
      for (let k = 0; k <= N; k++) {
        const sk = k === 0 ? s0 + (s1 - s0) * 1e-9 : k === N ? s1 - (s1 - s0) * 1e-9 : s0 + ((s1 - s0) * k) / N;
        ss.push(sk);
        ts.push(Tat(sk));
      }
      const tiny = 1e-10 * Math.max(1e-6, ...ts.map(Math.abs));
      // Sign changes between non-zero samples (zeros in between are skipped).
      let last = -1;
      for (let k = 0; k <= N; k++) {
        if (Math.abs(ts[k]) <= tiny) continue;
        if (last >= 0 && ts[last] * ts[k] < 0) {
          let lo = ss[last], hi = ss[k], flo = ts[last];
          for (let it = 0; it < 80; it++) {
            const mid = (lo + hi) / 2, fm = Tat(mid);
            if (fm * flo > 0) {
              lo = mid;
              flo = fm;
            } else hi = mid;
          }
          const sx = (lo + hi) / 2;
          if (sx > s0 + 1e-6 && sx < s1 - 1e-6) extremes.push({ s: sx, M: at(sx).M, field: i });
        }
        last = k;
      }
    }
    out[m.id] = {
      id: m.id, a: m.a, b: m.b, A: m.A, B: m.B, L: m.L, e: m.e, n: m.n, c: m.c, dashed: m.dashed,
      at,
      N: (s, side) => at(s, side).N,
      T: (s, side) => at(s, side).T,
      M: (s, side) => at(s, side).M,
      breaks,
      extremes,
      start: at(0, "+"),
      end: at(m.L, "-"),
    };
  }

  /**
   * Equilibrium of a node: forces and moments that the members' ends, the
   * node's loads and its reactions exert on it. `parts` lists each member
   * end's moment on the node (the exam's "kontrola momentov v vozlišču").
   */
  function nodeCheck(name) {
    let Fx = 0, Fy = 0, M = 0;
    const parts = [];
    for (const m of members) {
      const r = out[m.id];
      let F, Mn;
      if (m.b === name) {
        const v = r.end;
        F = [-(v.N * m.e[0] + v.T * m.n[0]), -(v.N * m.e[1] + v.T * m.n[1])];
        Mn = m.c * v.M;
      } else if (m.a === name) {
        const v = r.start;
        F = [v.N * m.e[0] + v.T * m.n[0], v.N * m.e[1] + v.T * m.n[1]];
        Mn = -m.c * v.M;
      } else continue;
      Fx += F[0];
      Fy += F[1];
      M += Mn;
      parts.push({ member: m.id, F, M: Mn });
    }
    for (const it of items) {
      if (it.node !== name) continue;
      if (it.kind === "F") {
        Fx += it.F[0];
        Fy += it.F[1];
      } else {
        M += it.M;
        parts.push({ load: true, M: it.M });
      }
    }
    return { Fx, Fy, M, parts };
  }

  const R = Object.fromEntries(reactions.map((u) => [u.name, u.value]));
  const residual = all(items);
  return { reactions, R, members: out, nodeCheck, residual, items, loadItems };
}

/** Solve A x = b by Gaussian elimination; null when (nearly) singular. */
function gauss(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  const scale = Math.max(1e-12, ...A.flat().map(Math.abs));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-9 * scale) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** All key values of a member: ends, both sides of every break, extremes. */
export function keyValues(mr) {
  const out = [];
  for (const s of mr.breaks) {
    if (s > 1e-9) out.push({ s, side: "-", ...mr.at(s, "-") });
    if (s < mr.L - 1e-9) out.push({ s, side: "+", ...mr.at(s, "+") });
  }
  for (const x of mr.extremes) out.push({ s: x.s, side: "+", extreme: true, ...mr.at(x.s) });
  return out.sort((p, q) => p.s - q.s);
}

/** Largest |M| in the whole frame, with where it is. */
export function maxAbsM(sol) {
  let best = { M: 0 };
  for (const mr of Object.values(sol.members)) for (const k of keyValues(mr)) if (Math.abs(k.M) > Math.abs(best.M) + 1e-9) best = { ...k, member: mr.id };
  return best;
}
