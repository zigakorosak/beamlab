// Solver checks against the textbook beam formulas (the "Beam formulas with
// shear and moment diagrams" table in reference/3), plus equilibrium and
// stability cases. Run with `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { solve, momentExtrema, indeterminacy } from "../src/core/solver.js";

const close = (actual, expected, msg, tol = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)), `${msg}: ${actual} ≠ ${expected}`);

let n = 0;
const id = () => `t${n++}`;
const beam = (L, supports, loads = [], hinges = []) => ({
  beam: { x0: 0, length: L },
  supports: supports.map(([type, x]) => ({ id: id(), type, x })),
  hinges: hinges.map((x) => ({ id: id(), x })),
  loads: loads.map((l) => ({ id: id(), ...l })),
});
const P = (x, value, angle = 0) => ({ type: "point", x, value, angle });
const udl = (x1, x2, q1, q2 = q1) => ({ type: "dist", x1, x2, q1, q2 });
const couple = (x, value) => ({ type: "moment", x, value });
const R = (sol, name) => sol.reactions.find((r) => r.name === name);

// Global equilibrium and closure: past the right end nothing is left over.
function checkClosure(sol) {
  close(sol.V(sol.L, "+"), 0, "V(L+)", 1e-6);
  close(sol.M(sol.L, "+"), 0, "M(L+)", 1e-6);
  close(sol.N(sol.L, "+"), 0, "N(L+)", 1e-6);
}

test("simply supported, centre point load", () => {
  const s = solve(beam(6, [["pin", 0], ["roller", 6]], [P(3, 30)]));
  assert.ok(s.ok);
  close(R(s, "A").Ry, 15, "Ay");
  close(R(s, "B").Ry, 15, "By");
  close(s.M(3), 45, "Mmax = PL/4");
  close(s.V(3, "-"), 15, "V left");
  close(s.V(3, "+"), -15, "V right");
  assert.equal(s.degree, 0);
  checkClosure(s);
});

test("simply supported, point load at any point", () => {
  // R1 = Pb/L, R2 = Pa/L, Mmax = Pab/L
  const s = solve(beam(8, [["pin", 0], ["roller", 8]], [P(2, 12)]));
  close(R(s, "A").Ry, 9, "R1");
  close(R(s, "B").Ry, 3, "R2");
  close(s.M(2), 18, "Mmax");
  checkClosure(s);
});

test("simply supported, UDL", () => {
  const s = solve(beam(6, [["pin", 0], ["roller", 6]], [udl(0, 6, 10)]));
  close(R(s, "A").Ry, 30, "wL/2");
  close(s.M(3), 45, "wL²/8");
  const ex = momentExtrema(s);
  assert.equal(ex.length, 1);
  close(ex[0].x, 3, "extremum at midspan", 1e-6);
  checkClosure(s);
});

test("simply supported, load increasing uniformly to one end", () => {
  // W total = wL/2: R1 = W/3, R2 = 2W/3, Mmax = 0.1283 W L at x = L/√3
  const L = 6;
  const w = 12;
  const W = (w * L) / 2;
  const s = solve(beam(L, [["pin", 0], ["roller", L]], [udl(0, L, 0, w)]));
  close(R(s, "A").Ry, W / 3, "R1");
  close(R(s, "B").Ry, (2 * W) / 3, "R2");
  const ex = momentExtrema(s);
  close(ex[0].x, L / Math.sqrt(3), "x of Mmax", 1e-6);
  close(ex[0].value, (2 * W * L) / (9 * Math.sqrt(3)), "Mmax", 1e-6);
  checkClosure(s);
});

test("cantilever, point load at the free end", () => {
  const s = solve(beam(3, [["fixed", 0]], [P(3, 10)]));
  const A = R(s, "A");
  close(A.Ry, 10, "R");
  close(A.M, 30, "fixed-end moment (ccw)");
  close(s.M(0, "+"), -30, "M at wall = −PL (hogging)");
  checkClosure(s);
});

test("cantilever fixed on the right, UDL", () => {
  const s = solve(beam(4, [["fixed", 4]], [udl(0, 4, 5)]));
  const A = R(s, "A");
  close(A.Ry, 20, "R = wL");
  close(A.M, -40, "M = wL²/2 (clockwise)");
  close(s.M(4, "-"), -40, "M at wall");
  checkClosure(s);
});

test("propped cantilever (fixed one end, supported other), UDL", () => {
  // R1 = 3wL/8 at the prop, R2 = 5wL/8 at the wall, M wall = wL²/8
  const L = 8;
  const w = 10;
  const s = solve(beam(L, [["fixed", 0], ["roller", L]], [udl(0, L, w)]));
  close(R(s, "B").Ry, (3 * w * L) / 8, "prop");
  close(R(s, "A").Ry, (5 * w * L) / 8, "wall");
  close(s.M(0, "+"), -(w * L * L) / 8, "M wall");
  close(momentExtrema(s)[0].value, (9 / 128) * w * L * L, "max positive M");
  assert.equal(s.degree, 1);
  checkClosure(s);
});

test("propped cantilever, centre point load", () => {
  // R1 = 5P/16 (prop), R2 = 11P/16, M wall = 3PL/16
  const L = 4;
  const p = 16;
  const s = solve(beam(L, [["fixed", 0], ["roller", L]], [P(L / 2, p)]));
  close(R(s, "B").Ry, (5 * p) / 16, "prop");
  close(R(s, "A").Ry, (11 * p) / 16, "wall");
  close(s.M(0, "+"), -(3 * p * L) / 16, "M wall");
  checkClosure(s);
});

test("fixed both ends, UDL", () => {
  const L = 6;
  const w = 10;
  const s = solve(beam(L, [["fixed", 0], ["fixed", L]], [udl(0, L, w)]));
  close(R(s, "A").Ry, 30, "wL/2");
  close(s.M(0, "+"), -(w * L * L) / 12, "M ends");
  close(s.M(L / 2), (w * L * L) / 24, "M centre");
  assert.equal(s.degree, 3);
  checkClosure(s);
});

test("fixed both ends, point load at any point", () => {
  // M1 = Pab²/L², M2 = Pa²b/L², R1 = Pb²(3a+b)/L³
  const [a, b, p] = [2, 4, 9];
  const L = a + b;
  const s = solve(beam(L, [["fixed", 0], ["fixed", L]], [P(a, p)]));
  close(R(s, "A").Ry, (p * b * b * (3 * a + b)) / L ** 3, "R1");
  close(s.M(0, "+"), -(p * a * b * b) / L ** 2, "M1");
  close(s.M(L, "-"), -(p * a * a * b) / L ** 2, "M2");
  checkClosure(s);
});

test("continuous beam, two equal spans, UDL", () => {
  // R1 = R3 = 3wl/8, R2 = 10wl/8, M over the middle support = −wl²/8
  const l = 5;
  const w = 8;
  const s = solve(beam(2 * l, [["pin", 0], ["roller", l], ["roller", 2 * l]], [udl(0, 2 * l, w)]));
  close(R(s, "A").Ry, (3 * w * l) / 8, "R1");
  close(R(s, "B").Ry, (10 * w * l) / 8, "R2");
  close(s.M(l), -(w * l * l) / 8, "M middle");
  checkClosure(s);
});

test("continuous beam, two equal spans, UDL on one span", () => {
  // R1 = 7wl/16, R2 = 10wl/16, R3 = −wl/16
  const l = 4;
  const w = 16;
  const s = solve(beam(2 * l, [["pin", 0], ["roller", l], ["roller", 2 * l]], [udl(0, l, w)]));
  close(R(s, "A").Ry, (7 * w * l) / 16, "R1");
  close(R(s, "B").Ry, (10 * w * l) / 16, "R2");
  close(R(s, "C").Ry, -(w * l) / 16, "R3");
  checkClosure(s);
});

test("overhang, concentrated load at the end of the overhang", () => {
  // R1 = −Pa/l (down), R2 = P(l+a)/l, M at R2 = −Pa
  const [l, a, p] = [6, 2, 12];
  const s = solve(beam(l + a, [["pin", 0], ["roller", l]], [P(l + a, p)]));
  close(R(s, "A").Ry, (-p * a) / l, "R1");
  close(R(s, "B").Ry, (p * (l + a)) / l, "R2");
  close(s.M(l), -p * a, "M at support");
  checkClosure(s);
});

test("applied couple on a simply supported beam", () => {
  // Clockwise couple C (value −C) at a: R1 = −C/L... M jumps up by C
  const s = solve(beam(6, [["pin", 0], ["roller", 6]], [couple(2, -12)]));
  close(R(s, "A").Ry, -2, "Ay");
  close(R(s, "B").Ry, 2, "By");
  close(s.M(2, "-"), -4, "M before");
  close(s.M(2, "+"), 8, "M after: jumps up by a clockwise couple");
  checkClosure(s);
});

test("Gerber beam: fixed, hinge, roller", () => {
  // Part right of the hinge (hinge at 4, roller at 8) carries 10 kN/m:
  // hinge force 20 kN; wall: Ay = 20, M = 20·4 = 80 kNm (counterclockwise).
  const s = solve(beam(8, [["fixed", 0], ["roller", 8]], [udl(4, 8, 10)], [4]));
  assert.ok(s.ok);
  assert.equal(s.degree, 0);
  close(R(s, "B").Ry, 20, "By");
  close(R(s, "A").Ry, 20, "Ay");
  close(R(s, "A").M, 80, "MA (counterclockwise, resisting the load to its right)");
  close(s.M(4), 0, "M at hinge");
  checkClosure(s);
});

test("inclined load gives axial force", () => {
  // 10 kN at 90° (pointing +x) at midspan: pin takes Ax = −10. N = +10 left of the load.
  const s = solve(beam(4, [["pin", 0], ["roller", 4]], [P(2, 10, 90)]));
  assert.ok(s.hasAxial);
  close(R(s, "A").Rx, -10, "Ax");
  close(s.N(1), 10, "tension between A and the load");
  close(s.N(3), 0, "nothing beyond");
  checkClosure(s);
});

test("unstable configurations are reported, not solved", () => {
  assert.equal(solve(beam(6, [["roller", 0], ["roller", 6]], [P(3, 10)])).ok, false);
  assert.equal(solve(beam(6, [["pin", 0]], [P(3, 10)])).ok, false);
  assert.equal(solve(beam(6, [["pin", 0], ["roller", 6]], [P(2, 10)], [3])).ok, false);
  assert.equal(solve(beam(6, [], [])).ok, false);
  assert.equal(indeterminacy(beam(6, [["pin", 0], ["roller", 6]], [], [3])), -1);
});

test("deflection: simply supported UDL sags most at midspan, 5wL⁴/384", () => {
  const L = 6;
  const w = 10;
  const s = solve(beam(L, [["pin", 0], ["roller", L]], [udl(0, L, w)]));
  const mid = s.deflection.reduce((best, p) => (Math.abs(p[0] - L / 2) < Math.abs(best[0] - L / 2) ? p : best));
  close(mid[1], (-5 * w * L ** 4) / 384, "w(L/2)", 1e-3);
});
