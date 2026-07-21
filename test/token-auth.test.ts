import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetDb, signupAgent, createToken, closeDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

// Bearer（OAuth アクセストークン）認証のテスト。
// Cookie/CSRF を持たない リモート MCP クライアント想定で、Authorization: Bearer <token> だけで
// API が通ること、不正/欠落トークンは 401 になることを確認する。
// Phase 16: API は URL 駆動。対象WSは URL の publicId で示す（signupAgent が返す wsPublicId）。
describe("Bearer トークン認証（OAuth アクセストークン）", () => {
  it("Bearer で GET /api/w/:publicId/tasks が通る（Cookie/CSRF なし）", async () => {
    const { userId, wsPublicId } = await signupAgent();
    const token = await createToken(userId);

    const res = await request(app)
      .get(`/api/w/${wsPublicId}/tasks`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tasks)).toBe(true);
  });

  it("Bearer で POST タスクが CSRF トークンなしでも通る（CSRF 免除）", async () => {
    const { userId, wsPublicId } = await signupAgent();
    const token = await createToken(userId);

    const created = await request(app)
      .post(`/api/w/${wsPublicId}/tasks`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "MCP から作成", priority: "HIGH" });

    expect(created.status).toBe(201);
    expect(created.body.task.title).toBe("MCP から作成");
  });

  it("Bearer で作成したタスクは同じユーザーの Cookie セッションからも見える", async () => {
    const { agent, userId, wsPublicId } = await signupAgent();
    const token = await createToken(userId);

    await request(app)
      .post(`/api/w/${wsPublicId}/tasks`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Bearer 作成タスク" });

    const list = await agent.get(`/api/w/${wsPublicId}/tasks`);
    expect(list.status).toBe(200);
    expect(list.body.tasks).toHaveLength(1);
    expect(list.body.tasks[0].title).toBe("Bearer 作成タスク");
    expect(list.body.tasks[0].creator?.id ?? list.body.tasks[0].creatorId).toBe(userId);
  });

  it("別ユーザーのトークンでは他ワークスペースにアクセスできない（403）", async () => {
    const a = await signupAgent({ username: "user-a" });
    const b = await signupAgent({ username: "user-b" });
    await a.agent.post(`/api/w/${a.wsPublicId}/tasks`).send({ title: "Aのタスク" });

    const tokenB = await createToken(b.userId);
    // B のトークンで A の WS を叩く → 非メンバーなので 403
    const res = await request(app)
      .get(`/api/w/${a.wsPublicId}/tasks`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(403);

    // B 自身の WS にはタスクが無い（分離できている）
    const own = await request(app)
      .get(`/api/w/${b.wsPublicId}/tasks`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(own.status).toBe(200);
    expect(own.body.tasks).toHaveLength(0);
  });

  it("不正なトークンは 401 UNAUTHENTICATED", async () => {
    const res = await request(app)
      .get("/api/w/anything/tasks")
      .set("Authorization", "Bearer mcp_at_invalid_xxx");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
