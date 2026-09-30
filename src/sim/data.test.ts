import { describe, it, expect } from "vitest";
import {
  JOBS,
  TRAITS,
  ACTS,
  LEAVE_LINES,
  RETURN_LINES,
  SURNAMES,
  GIVEN_NAMES,
} from "@/sim/data";

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
}

describe("追加: 画面に出る文言に算用数字を使わない（A6 の前提）", () => {
  it("職業・だめなところ・行動・台詞・名前に 0-9 が無い", () => {
    const all = [
      ...strings(Object.values(JOBS).map((j) => [j.label, j.shifts.map((s) => s.label)])),
      ...strings(TRAITS),
      ...strings(Object.values(ACTS).map((a) => [a.label, a.lines])),
      ...LEAVE_LINES,
      ...RETURN_LINES,
      ...SURNAMES,
      ...GIVEN_NAMES,
    ];
    expect(all.filter((s) => /[0-9０-９]/.test(s))).toEqual([]);
  });
});
