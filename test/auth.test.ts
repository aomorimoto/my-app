import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetDb, signupAgent, closeDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

describe("auth API", () => {
  it("signup すると 201 で、/me が本人を返し OWNER の個人ワークスペースが作られる", async () => {
    const { agent } = await signupAgent({ username: "alice", name: "アリス" });

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe("alice");
    // Phase 16: /me は activeWorkspace を返さない。所属WSは /api/workspaces から引く。
    expect(me.body.activeWorkspace).toBeUndefined();

    const ws = await agent.get("/api/workspaces");
    expect(ws.body.workspaces).toHaveLength(1);
    expect(ws.body.workspaces[0].role).toBe("OWNER");
    expect(typeof ws.body.workspaces[0].publicId).toBe("string");
  });

  it("重複ユーザーIDでの signup は 409", async () => {
    await signupAgent({ username: "dupuser" });
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "dupuser", password: "password123" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("USERNAME_TAKEN");
  });

  it("不正な形式のユーザーIDは 400", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "bad user!", password: "password123" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("正しい資格情報での login は 200 でユーザーを返す", async () => {
    const { username, password } = await signupAgent({ username: "bob" });
    const res = await request(app).post("/api/auth/login").send({ username, password });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("bob");
  });

  it("誤ったパスワードでの login は 401", async () => {
    const { username } = await signupAgent({ username: "carol" });
    const res = await request(app).post("/api/auth/login").send({ username, password: "wrongpass" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("未ログインの /me は user:null を返す", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it("logout は 204", async () => {
    const { agent } = await signupAgent();
    const res = await agent.post("/api/auth/logout");
    expect(res.status).toBe(204);
  });
});
