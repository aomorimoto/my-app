import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, signupAgent, closeDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

describe("authorization", () => {
  it("他ワークスペースのタスクは参照できない（404）", async () => {
    const a = await signupAgent({ email: "owner-a@example.com" });
    const b = await signupAgent({ email: "owner-b@example.com" });

    const created = await a.agent.post("/api/tasks").send({ title: "A のタスク" });
    const id = created.body.task.id;

    // B は自分のワークスペースにスコープされるため、A のタスクは見つからない（404）
    const res = await b.agent.get(`/api/tasks/${id}`);
    expect(res.status).toBe(404);
  });

  it("他ワークスペースのカテゴリは削除できない（404）", async () => {
    const a = await signupAgent({ email: "cat-a@example.com" });
    const b = await signupAgent({ email: "cat-b@example.com" });

    // A の既定カテゴリの 1 つを取得
    const cats = await a.agent.get("/api/categories");
    const catId = cats.body.categories[0].id;

    // B は自分の WS にスコープされるため、A のカテゴリは対象外（404）
    const res = await b.agent.delete(`/api/categories/${catId}`);
    expect(res.status).toBe(404);
  });

  it("他ワークスペースのタグは削除できない（404）", async () => {
    const a = await signupAgent({ email: "tag-a@example.com" });
    const b = await signupAgent({ email: "tag-b@example.com" });

    const created = await a.agent.post("/api/tags").send({ name: "重要" });
    expect(created.status).toBe(201);
    const tagId = created.body.tag.id;

    // B は自分の WS にスコープされるため、A のタグは対象外（404）
    const res = await b.agent.delete(`/api/tags/${tagId}`);
    expect(res.status).toBe(404);
  });

  it("MEMBER はカテゴリを作成できない（403）", async () => {
    const owner = await signupAgent({ email: "team-owner@example.com" });
    const member = await signupAgent({ email: "team-member@example.com" });

    // owner のアクティブ WS の id を取得
    const me = await owner.agent.get("/api/auth/me");
    const wsId = me.body.activeWorkspace.id;

    // owner が member をメールで追加（既定ロール MEMBER）
    const add = await owner.agent
      .post(`/api/workspaces/${wsId}/members`)
      .send({ email: "team-member@example.com" });
    expect(add.status).toBe(201);
    expect(add.body.member.role).toBe("MEMBER");

    // member 側で対象 WS をアクティブ化
    const activate = await member.agent.post(`/api/workspaces/${wsId}/activate`);
    expect(activate.status).toBe(200);

    // MEMBER はカテゴリ作成不可（OWNER / ADMIN のみ）
    const res = await member.agent.post("/api/categories").send({ name: "新カテゴリ" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});
