import { afterAll, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import { app, resetDb, closeDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

// signupAgent は CSRF を自動付与するため、ここでは生の agent を使って挙動を検証する。
async function rawSignup(username: string) {
  const agent = supertest.agent(app);
  const res = await agent
    .post("/api/auth/signup")
    .send({ username, password: "password123", name: "太郎" });
  expect(res.status).toBe(201);
  return agent;
}

describe("CSRF 保護", () => {
  it("トークン無しの状態変更は 403（code=CSRF）", async () => {
    const agent = await rawSignup("csrf-none");
    const res = await agent.post("/api/tasks").send({ title: "CSRF なし" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF");
  });

  it("トークン付きの状態変更は成功する", async () => {
    const agent = await rawSignup("csrf-ok");
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
    const agent = await rawSignup("csrf-get");
    const res = await agent.get("/api/tasks");
    expect(res.status).toBe(200);
  });

  it("login / signup / logout は CSRF 免除（トークン無しで通る）", async () => {
    const agent = await rawSignup("csrf-exempt");
    // ログアウト → ログイン のいずれもトークン無しで成立する
    const out = await agent.post("/api/auth/logout");
    expect(out.status).toBe(204);
    const login = await agent
      .post("/api/auth/login")
      .send({ username: "csrf-exempt", password: "password123" });
    expect(login.status).toBe(200);
  });

  it("ログアウト→再ログイン後も /api/csrf は新しいトークンを発行し、変更系が通る", async () => {
    // 旧セッションの CSRF Cookie がブラウザに残ったまま再ログインする状況を再現する。
    // 以前は /api/csrf が「別セッション由来の無効な Cookie」を見て 403 を投げ、
    // 新しいトークンを取得できず、以後あらゆる変更系リクエストが復旧不能になっていた。
    const username = "csrf-relogin";
    const agent = await rawSignup(username);

    // 変更系を一度行い、x-csrf-token Cookie を確立する（旧セッションに束縛される）。
    const first = await agent.get("/api/csrf");
    await agent
      .post("/api/tasks")
      .set("X-CSRF-Token", first.body.csrfToken as string)
      .send({ title: "再ログイン前" });

    // ログアウト → 再ログイン（サーバ側のセッションIDが変わる）。旧 Cookie は agent に残る。
    expect((await agent.post("/api/auth/logout")).status).toBe(204);
    expect(
      (await agent.post("/api/auth/login").send({ username, password: "password123" })).status
    ).toBe(200);

    // 新セッションでもトークンを取得できること（旧 Cookie があっても 403 にならない）。
    const csrf = await agent.get("/api/csrf");
    expect(csrf.status).toBe(200);
    const token = csrf.body.csrfToken as string;
    expect(token).toBeTruthy();

    // 取得したトークンで変更系が成功すること（ワークスペースのアクティブ化＝画面遷移に相当）。
    const res = await agent
      .post("/api/tasks")
      .set("X-CSRF-Token", token)
      .send({ title: "再ログイン後" });
    expect(res.status).toBe(201);
  });
});
