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
});
