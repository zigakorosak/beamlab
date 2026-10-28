// Number boxes that are quick to fill: focusing (or hovering with the
// mouse) selects the text so typing replaces it, and the wheel steps the
// value. Shared by Practice (game.js) and the exam exercises.

import { fmt, parseNumber } from "../core/format.js";

/** The text in a number box, as typed: plain "-", no "−". */
export const boxText = (v) => fmt(v).replace("−", "-");

/** Focusing a box selects its text, so typing replaces it. A click would
 *  put the caret back on mouseup, so the mouseup right after focus is eaten.
 *  Hovering a box with the mouse focuses it too, no click needed. */
export function selectOnFocus(input) {
  let justFocused = false;
  input.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse" || input.readOnly || document.activeElement === input) return;
    input.focus({ preventScroll: true });
  });
  input.addEventListener("focus", () => {
    input.select();
    justFocused = true;
  });
  input.addEventListener("mouseup", (e) => {
    if (justFocused) e.preventDefault();
    justFocused = false;
  });
  input.addEventListener("blur", () => (justFocused = false));
}

/** Scrolling over a box steps its value: `onStep(+1 | −1, e)`. */
export function wheelSteps(input, onStep) {
  input.addEventListener(
    "wheel",
    (e) => {
      if (input.readOnly) return;
      // Firefox turns Shift+wheel into a sideways scroll, so look at both.
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!d) return;
      e.preventDefault();
      onStep(d < 0 ? 1 : -1, e);
    },
    { passive: false },
  );
}

/** A box that steps by `step` (Shift: a tenth of it) on the wheel. */
export function wheelNumber(input, step = 1, canEdit = () => true) {
  wheelSteps(input, (dir, e) => {
    if (!canEdit()) return;
    const d = e.shiftKey ? step / 10 : step;
    const v = (parseNumber(input.value) ?? 0) + dir * d;
    input.value = boxText(Math.round(v * 1e6) / 1e6);
    input.dispatchEvent(new Event("input"));
    input.focus({ preventScroll: true });
    input.select();
  });
}
