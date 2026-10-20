// Ready-made beams for Build's Examples menu — the classic cases from the
// beam-formula tables, so the diagrams can be checked against a textbook.

import { newId } from "./model.js";

const make = (L, supports, loads = [], hinges = []) => ({
  beam: { x0: 1, length: L },
  supports: supports.map(([type, x]) => ({ id: newId("s"), type, x })),
  hinges: hinges.map((x) => ({ id: newId("g"), x })),
  loads: loads.map((l) => ({ id: newId("l"), ...l })),
});
const P = (x, value, angle = 0) => ({ type: "point", x, value, angle });
const q = (x1, x2, q1, q2 = q1) => ({ type: "dist", x1, x2, q1, q2 });
const C = (x, value) => ({ type: "moment", x, value });

export const EXAMPLES = [
  {
    label: "Simply supported, centre load",
    desc: "6 m, 30 kN at midspan",
    build: () => make(6, [["pin", 0], ["roller", 6]], [P(3, 30)]),
  },
  {
    label: "Simply supported, uniform load",
    desc: "6 m, 10 kN/m: parabolic moment",
    build: () => make(6, [["pin", 0], ["roller", 6]], [q(0, 6, 10)]),
  },
  {
    label: "Triangular load",
    desc: "Peak moment at L/√3",
    build: () => make(6, [["pin", 0], ["roller", 6]], [q(0, 6, 0, 12)]),
  },
  {
    label: "Cantilever, tip load",
    desc: "3 m, 10 kN at the free end",
    build: () => make(3, [["fixed", 0]], [P(3, 10)]),
  },
  {
    label: "Overhang, loaded tip",
    desc: "6 m span + 2 m overhang",
    build: () => make(8, [["pin", 0], ["roller", 6]], [q(0, 6, 5), P(8, 10)]),
  },
  {
    label: "Applied moment",
    desc: "A couple makes the moment jump",
    build: () => make(6, [["pin", 0], ["roller", 6]], [C(2, -12)]),
  },
  {
    label: "Inclined force",
    desc: "Adds an axial force N",
    build: () => make(6, [["pin", 0], ["roller", 6]], [P(2, 20, 45)]),
  },
  {
    label: "Gerber beam",
    desc: "Fixed, hinge, roller: still determinate",
    build: () => make(8, [["fixed", 0], ["roller", 8]], [q(0, 8, 6)], [3]),
  },
  {
    label: "Fixed both ends",
    desc: "Indeterminate: fixed-end moments",
    build: () => make(6, [["fixed", 0], ["fixed", 6]], [q(0, 6, 10)]),
  },
  {
    label: "Two-span continuous",
    desc: "Negative moment over the middle support",
    build: () => make(10, [["pin", 0], ["roller", 5], ["roller", 10]], [q(0, 10, 8)]),
  },
];
