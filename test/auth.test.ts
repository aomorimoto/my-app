import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetDb, signupAgent, closeDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

describe("auth API", () => {
  it("signup すると 201 で、/me が本人と OWNER ワークスペースを返す", async () => {
    const { agent } = await signupAgent({ email: "alice@example.com", name: "アリス" });

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("alice@example.com");
    expect(me.body.activeWorkspace).toMatchObject({ role: "OWNER" });
  });

  it("重複メールでの signup は 409", async () => {
    await signupAgent({ email: "dup@example.com" });
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "dup@example.com", password: "password123" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("正しい資格情報での login は 200 でユーザーを返す", async () => {
    const { email, password } = await signupAgent({ email: "bob@example.com" });
    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("bob@example.com");
  });

  it("誤ったパスワードでの login は 401", async () => {
    const { email } = await signupAgent({ email: "carol@example.com" });
    const res = await request(app).post("/api/auth/login").send({ email, password: "wrongpass" });
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
