import { test } from "node:test";
import assert from "node:assert/strict";
import { closeEnough, isExact } from "../src/core/grading.js";

test("approximate answers count: within 5 % of the value", () => {
  assert.ok(closeEnough(15.6, 15.625, 20));
  assert.ok(closeEnough(16, 15.625, 15.625));
  assert.ok(closeEnough(-14.9, -15.625, 15.625));
  assert.ok(!closeEnough(17, 15.625, 15.625));
  assert.ok(!closeEnough(15.6, -15.625, 15.625), "the sign must be right");
});

test("small values are judged against the problem's scale", () => {
  assert.ok(closeEnough(0, 1, 40)); // 3 % of 40 = 1.2
  assert.ok(!closeEnough(0, 2, 40));
  assert.ok(closeEnough(0.04, 0, 0)); // absolute floor
});

test("a minimum tolerance (one snap step) is honoured", () => {
  assert.ok(closeEnough(10, 12, 12, 2.5));
});

test("exact means right to the printed two decimals", () => {
  assert.ok(isExact(15.63, 15.625));
  assert.ok(!isExact(15.6, 15.625));
});
