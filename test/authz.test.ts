import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, signupAgent, closeDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

describe("authorization", () => {
  it("存在しないワークスペースへのアクセスは 404", async () => {
    const a = await signupAgent({ username: "who" });
    const res = await a.agent.get("/api/w/nonexistent-public-id/tasks");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("非メンバーは他ワークスペースのタスクを参照できない（403）", async () => {
    const a = await signupAgent({ username: "owner-a" });
    const b = await signupAgent({ username: "owner-b" });

    await a.agent.post(`/api/w/${a.wsPublicId}/tasks`).send({ title: "A のタスク" });

    // B は A の WS のメンバーではないため、スコープ解決の時点で 403（タスク番号にも到達しない）。
    const res = await b.agent.get(`/api/w/${a.wsPublicId}/tasks`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("非メンバーは他ワークスペースにエージェントを作成できない（403）", async () => {
    const a = await signupAgent({ username: "agent-a" });
    const b = await signupAgent({ username: "agent-b" });

    const res = await b.agent.post(`/api/w/${a.wsPublicId}/agents`).send({ name: "越境エージェント" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("非メンバーは他ワークスペースのタグを削除できない（403）", async () => {
    const a = await signupAgent({ username: "tag-a" });
    const b = await signupAgent({ username: "tag-b" });

    const created = await a.agent.post(`/api/w/${a.wsPublicId}/tags`).send({ name: "重要" });
    expect(created.status).toBe(201);
    const tagId = created.body.tag.id;

    // B は A の WS のメンバーではないため、スコープ解決の時点で 403。
    const res = await b.agent.delete(`/api/w/${a.wsPublicId}/tags/${tagId}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("MEMBER はタグを作成できない（403）", async () => {
    const owner = await signupAgent({ username: "team-owner" });
    const member = await signupAgent({ username: "team-member" });

    // owner が member をユーザーIDで追加（既定ロール MEMBER）
    const add = await owner.agent
      .post(`/api/w/${owner.wsPublicId}/members`)
      .send({ username: "team-member" });
    expect(add.status).toBe(201);
    expect(add.body.member.role).toBe("MEMBER");

    // member は owner の WS へ publicId で直接アクセスできる（アクティブ化は不要）。
    // ただし MEMBER はタグ作成不可（OWNER / ADMIN のみ）。
    const res = await member.agent
      .post(`/api/w/${owner.wsPublicId}/tags`)
      .send({ name: "新タグ" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});
