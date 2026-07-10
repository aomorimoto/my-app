import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetDb, signupAgent, createToken, closeDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

// Bearer（OAuth アクセストークン）認証のテスト。
// Cookie/CSRF を持たない リモート MCP クライアント想定で、Authorization: Bearer <token> だけで
// API が通ること、不正/欠落トークンは 401 になることを確認する。
describe("Bearer トークン認証（OAuth アクセストークン）", () => {
  it("Bearer で GET /api/tasks が通る（Cookie/CSRF なし）", async () => {
    const { userId } = await signupAgent();
    const token = await createToken(userId);

    const res = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tasks)).toBe(true);
  });

  it("Bearer で POST /api/tasks が CSRF トークンなしでも通る（CSRF 免除）", async () => {
    const { userId } = await signupAgent();
    const token = await createToken(userId);

    const created = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "MCP から作成", priority: "HIGH" });

    expect(created.status).toBe(201);
    expect(created.body.task.title).toBe("MCP から作成");
  });

  it("Bearer で作成したタスクは本人のワークスペースにスコープされる", async () => {
    const { agent, userId } = await signupAgent();
    const token = await createToken(userId);

    await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Bearer 作成タスク" });

    // 同じユーザーの Cookie セッションからも同じタスクが見える
    const list = await agent.get("/api/tasks");
    expect(list.status).toBe(200);
    expect(list.body.tasks).toHaveLength(1);
    expect(list.body.tasks[0].title).toBe("Bearer 作成タスク");
    expect(list.body.tasks[0].creator?.id ?? list.body.tasks[0].creatorId).toBe(userId);
  });

  it("別ユーザーのトークンでは他人のタスクは見えない（スコープ分離）", async () => {
    const a = await signupAgent({ email: "a@example.com" });
    const b = await signupAgent({ email: "b@example.com" });
    await a.agent.post("/api/tasks").send({ title: "Aのタスク" });

    const tokenB = await createToken(b.userId);
    const res = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(0);
  });

  it("不正なトークンは 401 UNAUTHENTICATED", async () => {
    const res = await request(app)
      .get("/api/tasks")
      .set("Authorization", "Bearer mcp_at_invalid_xxx");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
