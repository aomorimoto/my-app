import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetDb, signupAgent, closeDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

describe("tasks API", () => {
  it("未ログインでは 401", async () => {
    // スコープ付きパスも認証必須（scopeWorkspace より前に requireAuthApi が動く）。
    const res = await request(app).get("/api/w/anything/tasks");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("create -> list -> get -> patch -> toggle -> delete の一連が通る", async () => {
    const { agent, wsPublicId } = await signupAgent();
    const base = `/api/w/${wsPublicId}/tasks`;

    const created = await agent.post(base).send({ title: "牛乳を買う", priority: "HIGH" });
    expect(created.status).toBe(201);
    const number = created.body.task.number;
    expect(number).toBe(1); // WS 最初のタスクは #1
    expect(created.body.task.title).toBe("牛乳を買う");
    expect(created.body.task.status).toBe("TODO");
    expect(created.body.task.priority).toBe("HIGH");

    const list = await agent.get(base);
    expect(list.status).toBe(200);
    expect(list.body.tasks).toHaveLength(1);

    const got = await agent.get(`${base}/${number}`);
    expect(got.status).toBe(200);
    expect(got.body.task.number).toBe(number);

    const patched = await agent
      .patch(`${base}/${number}`)
      .send({ title: "牛乳と卵を買う", status: "IN_PROGRESS" });
    expect(patched.status).toBe(200);
    expect(patched.body.task.title).toBe("牛乳と卵を買う");
    expect(patched.body.task.status).toBe("IN_PROGRESS");

    const toggled = await agent.post(`${base}/${number}/toggle`);
    expect(toggled.status).toBe(200);
    expect(toggled.body.task.status).toBe("DONE");

    const del = await agent.delete(`${base}/${number}`);
    expect(del.status).toBe(204);

    const after = await agent.get(base);
    expect(after.body.tasks).toHaveLength(0);
  });

  it("タイトルが空だと 400（zod バリデーション）", async () => {
    const { agent, wsPublicId } = await signupAgent();
    const res = await agent.post(`/api/w/${wsPublicId}/tasks`).send({ title: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("存在しないタスクの取得は 404", async () => {
    const { agent, wsPublicId } = await signupAgent();
    const res = await agent.get(`/api/w/${wsPublicId}/tasks/999999`);
    expect(res.status).toBe(404);
  });

  it("サブタスクは親の状態/優先度/期限/担当者/タグを継承する", async () => {
    const { agent, userId, wsPublicId } = await signupAgent();
    const base = `/api/w/${wsPublicId}/tasks`;
    const tag = await agent.post(`/api/w/${wsPublicId}/tags`).send({ name: "重要" });
    const tagId = tag.body.tag.id;

    const parent = await agent.post(base).send({
      title: "親",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: "2026-08-01",
      assigneeId: userId,
      tagIds: [tagId],
    });
    const parentNumber = parent.body.task.number;

    // タイトルのみでサブタスクを作成 → 親の設定を継承する
    const sub = await agent.post(base).send({ title: "子", parentNumber });
    expect(sub.status).toBe(201);
    expect(sub.body.task.status).toBe("IN_PROGRESS");
    expect(sub.body.task.priority).toBe("HIGH");
    expect(sub.body.task.dueDate).not.toBeNull();
    expect(sub.body.task.assigneeId).toBe(userId);
    expect(sub.body.task.tags.map((t: any) => t.id)).toEqual([tagId]);
  });

  it("サブタスク作成時に明示指定した項目は継承より優先される", async () => {
    const { agent, wsPublicId } = await signupAgent();
    const base = `/api/w/${wsPublicId}/tasks`;
    const parent = await agent.post(base).send({ title: "親", priority: "HIGH" });
    const sub = await agent
      .post(base)
      .send({ title: "子", parentNumber: parent.body.task.number, priority: "LOW" });
    expect(sub.body.task.priority).toBe("LOW");
  });

  it("サブタスクのサブタスク（多階層）を作成できる", async () => {
    const { agent, wsPublicId } = await signupAgent();
    const base = `/api/w/${wsPublicId}/tasks`;
    const a = await agent.post(base).send({ title: "A" });
    const b = await agent.post(base).send({ title: "B", parentNumber: a.body.task.number });
    expect(b.status).toBe(201);
    const c = await agent.post(base).send({ title: "C", parentNumber: b.body.task.number });
    expect(c.status).toBe(201);
    expect(c.body.task.parentId).toBe(b.body.task.id);
  });

  it("自分の子孫を親にすると 400（循環防止）", async () => {
    const { agent, wsPublicId } = await signupAgent();
    const base = `/api/w/${wsPublicId}/tasks`;
    const a = await agent.post(base).send({ title: "A" });
    const b = await agent.post(base).send({ title: "B", parentNumber: a.body.task.number });
    // A の親を、その子孫である B にしようとする → 循環
    const res = await agent
      .patch(`${base}/${a.body.task.number}`)
      .send({ parentNumber: b.body.task.number });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_PARENT");
  });

  it("reorder でトップレベルの並び順を変更できる", async () => {
    const { agent, wsPublicId } = await signupAgent();
    const base = `/api/w/${wsPublicId}/tasks`;
    const t1 = await agent.post(base).send({ title: "1" });
    const t2 = await agent.post(base).send({ title: "2" });
    const t3 = await agent.post(base).send({ title: "3" });
    const order = [t3.body.task.number, t1.body.task.number, t2.body.task.number];

    const r = await agent.post(`${base}/reorder`).send({ parentNumber: null, order });
    expect(r.status).toBe(204);

    const list = await agent.get(base);
    expect(list.body.tasks.map((t: any) => t.number)).toEqual(order);
  });
});
