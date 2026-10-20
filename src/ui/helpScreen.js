// How to play: short sections on how the app works and the sign
// conventions it uses. It describes behaviour, so keep it in step with
// features.

import { h } from "./dom.js";

const SECTIONS = [
  [
    "The idea",
    [
      "A beam on supports, with loads on it. Find what the supports push back with (the reactions), then how the beam carries the load inside: the axial force N, the shear force V and the bending moment M along its length.",
      "Practice gives you beams to solve and grades your answers. Build lets you make your own and shows the answers straight away.",
    ],
  ],
  [
    "Practice",
    [
      "Pick what to practise (reactions, the shear diagram, the moment diagram, or all of it), the kind of beam, the loads, and how many beams.",
      "Reactions: type each one in kN or kNm. Positive is the way the dashed arrow points (→, ↑, ↺); a negative value means the other way.",
      "Diagrams: every key point (a support, a load, a hinge, the start or end of a distributed load) has a dot just left and just right of it, because the diagram can jump there. Drag the dots up or down, or tap one and type its value. Under a distributed load a middle dot bends the curve.",
      "Confirm with the button or Enter. Right values turn green, wrong ones red, and the exact diagram is drawn over yours. After the reactions you also get the equilibrium equations.",
      "Keys: ← → pick a dot, ↑ ↓ move it, Enter confirms and goes on.",
    ],
  ],
  [
    "Build",
    [
      "Drag a beam from the palette onto the grid, then supports and loads onto the beam. Tapping a palette item adds it to the middle of the beam.",
      "Drag things along the beam to move them. Drag the beam's round end handles to change its length, and a distributed load's square corners to change where it starts and ends (sideways) and how strong it is there (up and down).",
      "Tap anything to edit its exact numbers, or to delete it (Delete key works too). Undo and redo: the arrows, or Ctrl+Z and Ctrl+Y.",
      "The reactions and diagrams update as you go. Hover over the diagrams to read N, V and M at any point. Practice this turns your beam into a question.",
      "Examples has the classic textbook cases. Your beam is kept when you leave.",
    ],
  ],
  [
    "Sign conventions",
    [
      "Units: metres, kN, kN/m and kNm.",
      "N: tension positive.",
      "V: positive when the forces left of the cut add up to an upward push (equivalently, it turns a small piece of beam clockwise).",
      "M: sagging positive (bottom in tension, the beam smiles). Settings decides whether positive M is drawn up or on the tension side (down).",
      "Applied moments are counterclockwise positive in the equations; a clockwise moment makes M jump up.",
    ],
  ],
  [
    "Handy rules",
    [
      "dV/dx = −q: under a uniform load V is a straight sloped line; with no load it's flat.",
      "dM/dx = V: M peaks where V crosses zero, and the change in M between two points is the area under V.",
      "A point load makes V jump by its size; a moment makes M jump.",
      "M is zero at a hinge, and at a free end or an end on a pin or roller (unless a moment is applied there).",
    ],
  ],
];

export function renderHelp(root, navigate) {
  root.append(
    h(
      "div.menu-screen.wizard-screen.help-screen",
      {},
      h("button.wizard-back", { type: "button", onclick: () => navigate("home") }, "← Back"),
      h("h1", {}, "How to play"),
      SECTIONS.map(([title, items]) => h("section.help-section", {}, h("h2", {}, title), h("ul", {}, items.map((t) => h("li", {}, t))))),
    ),
  );
}
