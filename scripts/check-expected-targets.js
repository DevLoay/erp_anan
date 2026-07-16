const assert = require("node:assert/strict");

function monthEnd(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function inclusiveDays(from, to) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

function expected(monthlyTarget, month, from, to) {
  const totalDays = inclusiveDays(`${month}-01`, monthEnd(month));
  const selectedDays = inclusiveDays(from, to);
  return Math.ceil((monthlyTarget * selectedDays) / totalDays);
}

function status(actual, target) {
  const percentage = target <= 0 ? 100 : (actual / target) * 100;
  if (percentage >= 95) return "GREEN";
  if (percentage >= 80) return "YELLOW";
  return "RED";
}

const month = "2026-04";
assert.equal(expected(600, month, "2026-04-01", "2026-04-01"), 20, "day 1 target");
assert.equal(expected(600, month, "2026-04-01", "2026-04-10"), 200, "day 10 target");
assert.equal(expected(600, month, "2026-04-01", "2026-04-15"), 300, "mid-month target");
assert.equal(expected(600, month, "2026-04-01", "2026-04-07"), 140, "week target");
assert.equal(expected(600, month, "2026-04-01", "2026-04-30"), 600, "full-month target");
assert.equal(expected(180, month, "2026-04-01", "2026-04-01"), 6, "daily hours target");
assert.equal(status(95, 100), "GREEN", "green threshold");
assert.equal(status(80, 100), "YELLOW", "yellow threshold");
assert.equal(status(79, 100), "RED", "red threshold");

console.log("Expected target checks passed", {
  day1Orders: expected(600, month, "2026-04-01", "2026-04-01"),
  day10Orders: expected(600, month, "2026-04-01", "2026-04-10"),
  weekOrders: expected(600, month, "2026-04-01", "2026-04-07"),
  fullMonthOrders: expected(600, month, "2026-04-01", "2026-04-30"),
});
