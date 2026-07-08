import { afterAll, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import { app, resetDb, closeDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

// signupAgent は CSRF を自動付与するため、ここでは生の agent を使って挙動を検証する。
async function rawSignup(email: string) {
  const agent = supertest.agent(app);
  const res = await agent
    .post("/api/auth/signup")
    .send({ email, password: "password123", name: "太郎" });
  expect(res.status).toBe(201);
  return agent;
}

describe("CSRF 保護", () => {
  it("トークン無しの状態変更は 403（code=CSRF）", async () => {
    const agent = await rawSignup("csrf-none@example.com");
    const res = await agent.post("/api/tasks").send({ title: "CSRF なし" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF");
  });

  it("トークン付きの状態変更は成功する", async () => {
    const agent = await rawSignup("csrf-ok@example.com");
    const csrf = await agent.get("/api/csrf");
    const token = csrf.body.csrfToken as string;
    expect(token).toBeTruthy();

    const res = await agent
      .post("/api/tasks")
      .set("X-CSRF-Token", token)
      .send({ title: "CSRF あり" });
    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe("CSRF あり");
  });

  it("GET（一覧取得）はトークン無しでも通る", async () => {
    const agent = await rawSignup("csrf-get@example.com");
    const res = await agent.get("/api/tasks");
    expect(res.status).toBe(200);
  });

  it("login / signup / logout は CSRF 免除（トークン無しで通る）", async () => {
    const agent = await rawSignup("csrf-exempt@example.com");
    // ログアウト → ログイン のいずれもトークン無しで成立する
    const out = await agent.post("/api/auth/logout");
    expect(out.status).toBe(204);
    const login = await agent
      .post("/api/auth/login")
      .send({ email: "csrf-exempt@example.com", password: "password123" });
    expect(login.status).toBe(200);
  });
});
