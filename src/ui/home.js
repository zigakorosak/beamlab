// Main hub: Practice / Build / How to play / Settings (GeoQuiz: Games /
// Map / Settings).

import { choiceScreen } from "./screenKit.js";

export function renderHome(root, navigate) {
  choiceScreen(root, {
    title: "Beam Lab",
    subtitle: "Reactions, shear force and bending moment diagrams",
    options: [
      { label: "Practice", desc: "Solve beams and draw the diagrams yourself", onSelect: () => navigate("wizard") },
      { label: "Build", desc: "Drag supports and loads onto a beam, see the diagrams", onSelect: () => navigate("build") },
      { label: "How to play", onSelect: () => navigate("help") },
      { label: "Settings", onSelect: () => navigate("settings") },
    ],
  });
}
