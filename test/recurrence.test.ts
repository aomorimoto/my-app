import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetDb, signupAgent, closeDb } from "./helpers";
import {
  parseRecurrenceRule,
  isValidRecurrenceRule,
  nextOccurrence,
} from "../src/domain/recurrence";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("recurrence ドメイン（parse / nextOccurrence）", () => {
  it("有効なルールをパースできる", () => {
    expect(parseRecurrenceRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE")).toEqual({
      freq: "WEEKLY",
      interval: 2,
      byday: [1, 3],
    });
    expect(parseRecurrenceRule("FREQ=DAILY")).toEqual({
      freq: "DAILY",
      interval: 1,
      byday: [],
    });
  });

  it("不正なルールは null（検証も false）", () => {
    for (const bad of ["", "FREQ=HOURLY", "FREQ=WEEKLY;INTERVAL=0", "FREQ=WEEKLY;BYDAY=XX", "FOO=BAR", "INTERVAL=2"]) {
      expect(parseRecurrenceRule(bad)).toBeNull();
      expect(isValidRecurrenceRule(bad)).toBe(false);
    }
  });

  it("DAILY: interval 日後", () => {
    expect(ymd(nextOccurrence(utc("2026-07-06"), "FREQ=DAILY;INTERVAL=3")!)).toBe("2026-07-09");
  });

  it("WEEKLY（曜日指定なし）: 7*interval 日後", () => {
    expect(ymd(nextOccurrence(utc("2026-07-06"), "FREQ=WEEKLY;INTERVAL=2")!)).toBe("2026-07-20");
  });

  it("WEEKLY（曜日指定あり）: 次の該当曜日", () => {
    // 2026-07-06 は月曜。BYDAY=MO,WE → 同じ週の水曜 07-08。
    expect(ymd(nextOccurrence(utc("2026-07-06"), "FREQ=WEEKLY;BYDAY=MO,WE")!)).toBe("2026-07-08");
    // INTERVAL=2 の月曜 → 1週飛ばして 07-20。
    expect(ymd(nextOccurrence(utc("2026-07-06"), "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO")!)).toBe(
      "2026-07-20"
    );
  });

  it("MONTHLY: 月末をクランプ（1/31 → 2/28）", () => {
    expect(ymd(nextOccurrence(utc("2026-01-31"), "FREQ=MONTHLY;INTERVAL=1")!)).toBe("2026-02-28");
  });

  it("YEARLY: 閏日を非閏年でクランプ（2024-02-29 → 2025-02-28）", () => {
    expect(ymd(nextOccurrence(utc("2024-02-29"), "FREQ=YEARLY;INTERVAL=1")!)).toBe("2025-02-28");
  });
});

describe("recurrence API（完了トグルで次回分を生成）", () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it("繰り返しタスクを完了にすると、次回期限の TODO が1件生成される", async () => {
    const { agent } = await signupAgent();
    const created = await agent.post("/api/tasks").send({
      title: "週次レポート",
      dueDate: "2026-07-06", // 月曜
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=1",
    });
    expect(created.status).toBe(201);
    const id = created.body.task.id;
    expect(created.body.task.recurrenceRule).toBe("FREQ=WEEKLY;INTERVAL=1");

    const toggled = await agent.post(`/api/tasks/${id}/toggle`);
    expect(toggled.status).toBe(200);
    expect(toggled.body.task.status).toBe("DONE");

    const list = await agent.get("/api/tasks");
    expect(list.body.tasks).toHaveLength(2);
    const next = list.body.tasks.find((t: any) => t.status === "TODO");
    expect(next).toBeTruthy();
    expect(next.dueDate.slice(0, 10)).toBe("2026-07-13");
    expect(next.recurrenceRule).toBe("FREQ=WEEKLY;INTERVAL=1");
    expect(next.recurrenceParentId).toBe(id);
  });

  it("繰り返しなしのタスクを完了にしても複製されない", async () => {
    const { agent } = await signupAgent();
    const created = await agent.post("/api/tasks").send({ title: "単発", dueDate: "2026-07-06" });
    await agent.post(`/api/tasks/${created.body.task.id}/toggle`);
    const list = await agent.get("/api/tasks");
    expect(list.body.tasks).toHaveLength(1);
  });

  it("期限のない繰り返しタスクは生成基準がないため複製されない", async () => {
    const { agent } = await signupAgent();
    const created = await agent
      .post("/api/tasks")
      .send({ title: "期限なし繰り返し", recurrenceRule: "FREQ=DAILY" });
    await agent.post(`/api/tasks/${created.body.task.id}/toggle`);
    const list = await agent.get("/api/tasks");
    expect(list.body.tasks).toHaveLength(1);
  });

  it("不正な繰り返しルールは 400", async () => {
    const { agent } = await signupAgent();
    const res = await agent
      .post("/api/tasks")
      .send({ title: "x", recurrenceRule: "FREQ=HOURLY" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });
});
