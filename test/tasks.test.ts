import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetDb, signupAgent, closeDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

describe("tasks API", () => {
  it("未ログインでは 401", async () => {
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("create -> list -> get -> patch -> toggle -> delete の一連が通る", async () => {
    const { agent } = await signupAgent();

    const created = await agent.post("/api/tasks").send({ title: "牛乳を買う", priority: "HIGH" });
    expect(created.status).toBe(201);
    const id = created.body.task.id;
    expect(created.body.task.title).toBe("牛乳を買う");
    expect(created.body.task.status).toBe("TODO");
    expect(created.body.task.priority).toBe("HIGH");

    const list = await agent.get("/api/tasks");
    expect(list.status).toBe(200);
    expect(list.body.tasks).toHaveLength(1);

    const got = await agent.get(`/api/tasks/${id}`);
    expect(got.status).toBe(200);
    expect(got.body.task.id).toBe(id);

    const patched = await agent
      .patch(`/api/tasks/${id}`)
      .send({ title: "牛乳と卵を買う", status: "IN_PROGRESS" });
    expect(patched.status).toBe(200);
    expect(patched.body.task.title).toBe("牛乳と卵を買う");
    expect(patched.body.task.status).toBe("IN_PROGRESS");

    const toggled = await agent.post(`/api/tasks/${id}/toggle`);
    expect(toggled.status).toBe(200);
    expect(toggled.body.task.status).toBe("DONE");

    const del = await agent.delete(`/api/tasks/${id}`);
    expect(del.status).toBe(204);

    const after = await agent.get("/api/tasks");
    expect(after.body.tasks).toHaveLength(0);
  });

  it("タイトルが空だと 400（zod バリデーション）", async () => {
    const { agent } = await signupAgent();
    const res = await agent.post("/api/tasks").send({ title: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("存在しないタスクの取得は 404", async () => {
    const { agent } = await signupAgent();
    const res = await agent.get("/api/tasks/999999");
    expect(res.status).toBe(404);
  });

  it("サブタスクは親の状態/優先度/期限/担当者/タグを継承する", async () => {
    const { agent, userId } = await signupAgent();
    const tag = await agent.post("/api/tags").send({ name: "重要" });
    const tagId = tag.body.tag.id;

    const parent = await agent.post("/api/tasks").send({
      title: "親",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: "2026-08-01",
      assigneeId: userId,
      tagIds: [tagId],
    });
    const parentId = parent.body.task.id;

    // タイトルのみでサブタスクを作成 → 親の設定を継承する
    const sub = await agent.post("/api/tasks").send({ title: "子", parentId });
    expect(sub.status).toBe(201);
    expect(sub.body.task.status).toBe("IN_PROGRESS");
    expect(sub.body.task.priority).toBe("HIGH");
    expect(sub.body.task.dueDate).not.toBeNull();
    expect(sub.body.task.assigneeId).toBe(userId);
    expect(sub.body.task.tags.map((t: any) => t.id)).toEqual([tagId]);
  });

  it("サブタスク作成時に明示指定した項目は継承より優先される", async () => {
    const { agent } = await signupAgent();
    const parent = await agent.post("/api/tasks").send({ title: "親", priority: "HIGH" });
    const sub = await agent
      .post("/api/tasks")
      .send({ title: "子", parentId: parent.body.task.id, priority: "LOW" });
    expect(sub.body.task.priority).toBe("LOW");
  });

  it("サブタスクのサブタスク（多階層）を作成できる", async () => {
    const { agent } = await signupAgent();
    const a = await agent.post("/api/tasks").send({ title: "A" });
    const b = await agent.post("/api/tasks").send({ title: "B", parentId: a.body.task.id });
    expect(b.status).toBe(201);
    const c = await agent.post("/api/tasks").send({ title: "C", parentId: b.body.task.id });
    expect(c.status).toBe(201);
    expect(c.body.task.parentId).toBe(b.body.task.id);
  });

  it("自分の子孫を親にすると 400（循環防止）", async () => {
    const { agent } = await signupAgent();
    const a = await agent.post("/api/tasks").send({ title: "A" });
    const b = await agent.post("/api/tasks").send({ title: "B", parentId: a.body.task.id });
    // A の親を、その子孫である B にしようとする → 循環
    const res = await agent
      .patch(`/api/tasks/${a.body.task.id}`)
      .send({ parentId: b.body.task.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_PARENT");
  });

  it("reorder でトップレベルの並び順を変更できる", async () => {
    const { agent } = await signupAgent();
    const t1 = await agent.post("/api/tasks").send({ title: "1" });
    const t2 = await agent.post("/api/tasks").send({ title: "2" });
    const t3 = await agent.post("/api/tasks").send({ title: "3" });
    const ids = [t3.body.task.id, t1.body.task.id, t2.body.task.id];

    const r = await agent.post("/api/tasks/reorder").send({ parentId: null, order: ids });
    expect(r.status).toBe(204);

    const list = await agent.get("/api/tasks");
    expect(list.body.tasks.map((t: any) => t.id)).toEqual(ids);
  });
});
