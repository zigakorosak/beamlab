// Exam exercises: each build() checked against a worked exam solution
// (numbers from the photographed exams), and every generator run many
// times for finite, sensible answers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EXERCISES } from "../src/exercises/registry.js";
import { rng, num, ans, nearZero } from "../src/exercises/kit.js";
import { answerOk } from "../src/core/grading.js";
import { sileF4, sileVozlisce } from "../src/exercises/statika/concurrent.js";

const near = (a, b, tol = 0.002) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const answer = (ex, key) => ex.answers.find((a) => a.key === key).value;

test("num(): decimal comma, four significant digits", () => {
  assert.equal(num(6.97412), "6,974");
  assert.equal(num(43393.2), "43393");
  assert.equal(num(0.058812), "0,05881");
  assert.equal(num(-2.5), "−2,5");
  assert.equal(num(1e-12), "0");
});

test("F4 for equilibrium (24.8.2016): 11.206 kN", () => {
  // Axes along F1 and F2 as in the solution; F3 at 30° from F2 → 120°.
  const ex = sileF4.build({ forces: [{ F: 8, a: 0 }, { F: 6, a: 90 }, { F: 4, a: 120 }] });
  near(answer(ex, "F4"), 11.206);
  near(answer(ex, "phi"), 180 + 57.626); // F4 points down-left
});

test("knot on two ropes: symmetric 45° gives G/√2 each", () => {
  const ex = sileVozlisce.build({ a1: 135, a2: 45, G: 10 });
  near(answer(ex, "S1"), 10 / Math.SQRT2);
  near(answer(ex, "S2"), 10 / Math.SQRT2);
});

test("every generator: 300 random tasks with finite answers and text", () => {
  for (const ex of EXERCISES) {
    const r = rng(12345);
    for (let i = 0; i < 300; i++) {
      const task = ex.build(ex.generate(r));
      assert.ok(task.text.length > 0 && task.solution.length > 0, ex.id);
      for (const a of task.answers) assert.ok(Number.isFinite(a.value), `${ex.id}: ${a.key} = ${a.value}`);
    }
  }
});

test("nearZero: a reaction that can be 0 is right within 1 % of the largest one", () => {
  const list = nearZero([ans("Ax", "A_x", "kN", 0), ans("Ay", "A_y", "kN", 2), ans("B", "B", "kN", 40)], ["Ax", "Ay"]);
  const [Ax, Ay, B] = list;
  assert.ok(answerOk(0.3, Ax) && !answerOk(0.5, Ax));
  assert.ok(answerOk(2.3, Ay) && !answerOk(2.5, Ay));
  assert.equal(B.scale, undefined);
  assert.ok(!answerOk(42.5, B));
});

test("every generator: the printed answer (4 digits, decimal comma) grades right", () => {
  for (const ex of EXERCISES) {
    const r = rng(777);
    for (let i = 0; i < 200; i++) {
      for (const a of ex.build(ex.generate(r)).answers) {
        const shown = Number(num(a.value).replace(",", ".").replace("−", "-"));
        assert.ok(answerOk(shown, a), `${ex.id}: ${a.key} = ${a.value}, printed ${num(a.value)}`);
      }
    }
  }
});

test("every generator: a nonzero answer is never passed by 0, the opposite sign or a value 20 % off", () => {
  for (const ex of EXERCISES) {
    const r = rng(4242);
    for (let i = 0; i < 1000; i++) {
      for (const a of ex.build(ex.generate(r)).answers) {
        if (a.value === 0 || a.tol !== undefined) continue;
        assert.ok(!answerOk(0, a) && !answerOk(-a.value, a) && !answerOk(a.value * 0.8, a) && !answerOk(a.value * 1.2, a), `${ex.id}: ${a.key} = ${a.value} (scale ${a.scale})`);
      }
    }
  }
});

test("every figure draws on a phone and a desktop: no crash, no NaN, within its height", async () => {
  // Just enough of the DOM for draw.js (it only builds and reads attributes).
  class El {
    constructor(tag) { this.tagName = tag; this.attrs = {}; this.children = []; this.text = ""; this.dataset = {}; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    append(...cs) { for (const c of cs) this.children.push(typeof c === "string" ? Object.assign(new El("#text"), { text: c }) : c); }
    set textContent(v) { this.children = []; this.text = String(v); }
    get textContent() { return this.text + this.children.map((c) => c.textContent).join(""); }
    *walk() { for (const c of this.children) { yield c; yield* c.walk(); } }
    querySelectorAll(sel) { const tags = sel.split(",").map((t) => t.trim()); return [...this.walk()].filter((e) => tags.includes(e.tagName)); }
  }
  const saved = globalThis.document;
  globalThis.document = { createElementNS: (ns, tag) => new El(tag) };
  try {
    const { figure } = await import("../src/exercises/draw.js");
    for (const ex of EXERCISES) {
      const r = rng(31);
      for (let i = 0; i < 15; i++) {
        const task = ex.build(ex.generate(r));
        for (const width of [326, 728]) {
          for (const draw of [task.figure, task.solutionFigure]) {
            if (!draw) continue;
            const f = figure();
            draw(f);
            const svg = f.render(width, 440);
            const H = Number(svg.getAttribute("height"));
            assert.ok(H > 0 && H <= 440 + 1e-9, `${ex.id}: height ${H}`);
            for (const el of [svg, ...svg.walk()])
              for (const [k, v] of Object.entries(el.attrs)) assert.ok(!/NaN|Infinity|undefined/.test(v), `${ex.id} (${width} px): ${el.tagName} ${k}="${v}"`);
          }
        }
      }
    }
  } finally {
    globalThis.document = saved;
  }
});
