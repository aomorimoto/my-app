import { describe, it, expect } from "vitest";
import { parseRule, buildRule, recurrenceLabel } from "./recurrence";

describe("recurrence (client)", () => {
  it("parseRule はルール文字列を状態に分解する", () => {
    expect(parseRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE")).toEqual({
      freq: "WEEKLY",
      interval: 2,
      byday: [1, 3],
    });
    expect(parseRule("")).toEqual({ freq: "", interval: 1, byday: [] });
    expect(parseRule(null)).toEqual({ freq: "", interval: 1, byday: [] });
    // 不正は「なし」に落とす
    expect(parseRule("FREQ=HOURLY").freq).toBe("");
  });

  it("buildRule は状態をルール文字列にする（なしは null）", () => {
    expect(buildRule({ freq: "", interval: 1, byday: [] })).toBeNull();
    expect(buildRule({ freq: "DAILY", interval: 1, byday: [] })).toBe("FREQ=DAILY;INTERVAL=1");
    expect(buildRule({ freq: "WEEKLY", interval: 2, byday: [3, 1] })).toBe(
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE"
    );
    // 曜日は WEEKLY 以外では出力しない
    expect(buildRule({ freq: "MONTHLY", interval: 1, byday: [1] })).toBe("FREQ=MONTHLY;INTERVAL=1");
  });

  it("parse → build は往復する", () => {
    const rule = "FREQ=WEEKLY;INTERVAL=3;BYDAY=MO,FR";
    expect(buildRule(parseRule(rule))).toBe(rule);
  });

  it("recurrenceLabel は人間向けの表示にする", () => {
    expect(recurrenceLabel(null)).toBe("繰り返しなし");
    expect(recurrenceLabel("FREQ=WEEKLY;INTERVAL=1")).toBe("毎週");
    expect(recurrenceLabel("FREQ=WEEKLY;INTERVAL=2")).toBe("2週間ごと");
    expect(recurrenceLabel("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE")).toBe("毎週 月・水");
    expect(recurrenceLabel("FREQ=MONTHLY;INTERVAL=1")).toBe("毎月");
  });
});
