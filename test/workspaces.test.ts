import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, signupAgent, closeDb } from "./helpers";
import { prisma } from "../src/db";

beforeEach(resetDb);
afterAll(closeDb);

type Signed = Awaited<ReturnType<typeof signupAgent>>;

// 対象ユーザーの2つ目のワークスペースを作成し、その id を返す。
// （個人ワークスペースだけだと「最後の1つ」ガードに阻まれるため）
async function createSecondWorkspace(a: Signed, name: string) {
  const created = await a.agent.post("/api/workspaces").send({ name });
  expect(created.status).toBe(201);
  return created.body.workspace.id as number;
}

describe("workspace delete API", () => {
  it("OWNER は確認名が一致すれば削除できる（204）", async () => {
    const a = await signupAgent({ email: "ws-del@example.com" });
    const wsId = await createSecondWorkspace(a, "削除対象WS");

    const res = await a.agent.delete(`/api/workspaces/${wsId}`).send({ name: "削除対象WS" });
    expect(res.status).toBe(204);

    // 一覧から消えている
    const list = await a.agent.get("/api/workspaces");
    expect(list.body.workspaces.map((w: { id: number }) => w.id)).not.toContain(wsId);
    // DB からも消えている
    expect(await prisma.workspace.count({ where: { id: wsId } })).toBe(0);
  });

  it("確認名が一致しないと削除できない（400 NAME_MISMATCH）", async () => {
    const a = await signupAgent({ email: "ws-mismatch@example.com" });
    const wsId = await createSecondWorkspace(a, "本番用WS");

    const res = await a.agent.delete(`/api/workspaces/${wsId}`).send({ name: "ちがう名前" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("NAME_MISMATCH");
    // 残っている
    expect(await prisma.workspace.count({ where: { id: wsId } })).toBe(1);
  });

  it("確認名が空だと 400（バリデーション）", async () => {
    const a = await signupAgent({ email: "ws-empty@example.com" });
    const wsId = await createSecondWorkspace(a, "空確認WS");

    const res = await a.agent.delete(`/api/workspaces/${wsId}`).send({ name: "" });
    expect(res.status).toBe(400);
    expect(await prisma.workspace.count({ where: { id: wsId } })).toBe(1);
  });

  it("配下のタスク・タグも連鎖削除される", async () => {
    const a = await signupAgent({ email: "ws-cascade@example.com" });
    const wsId = await createSecondWorkspace(a, "カスケードWS");

    // 対象WSをアクティブ化してからタスク/タグを作成する
    await a.agent.post(`/api/workspaces/${wsId}/activate`);
    const task = await a.agent.post("/api/tasks").send({ title: "消えるタスク" });
    expect(task.status).toBe(201);
    const tag = await a.agent.post("/api/tags").send({ name: "消えるタグ" });
    expect(tag.status).toBe(201);

    const res = await a.agent.delete(`/api/workspaces/${wsId}`).send({ name: "カスケードWS" });
    expect(res.status).toBe(204);

    expect(await prisma.task.count({ where: { workspaceId: wsId } })).toBe(0);
    expect(await prisma.tag.count({ where: { workspaceId: wsId } })).toBe(0);
    expect(await prisma.membership.count({ where: { workspaceId: wsId } })).toBe(0);
  });

  it("最後のワークスペースは削除できない（409 LAST_WORKSPACE）", async () => {
    const a = await signupAgent({ email: "ws-last@example.com" });
    const me = await a.agent.get("/api/auth/me");
    const wsId = me.body.activeWorkspace.id as number;
    const name = me.body.activeWorkspace.name as string;

    const res = await a.agent.delete(`/api/workspaces/${wsId}`).send({ name });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LAST_WORKSPACE");
    expect(await prisma.workspace.count({ where: { id: wsId } })).toBe(1);
  });

  it("ADMIN は削除できない（403 FORBIDDEN）", async () => {
    const owner = await signupAgent({ email: "ws-adm-owner@example.com" });
    const member = await signupAgent({ email: "ws-adm-member@example.com" });

    const created = await owner.agent.post("/api/workspaces").send({ name: "共有WS" });
    const wsId = created.body.workspace.id as number;

    // ADMIN としてメンバー追加
    const add = await owner.agent
      .post(`/api/workspaces/${wsId}/members`)
      .send({ email: "ws-adm-member@example.com", role: "ADMIN" });
    expect(add.status).toBe(201);
    expect(add.body.member.role).toBe("ADMIN");

    await member.agent.post(`/api/workspaces/${wsId}/activate`);
    const res = await member.agent.delete(`/api/workspaces/${wsId}`).send({ name: "共有WS" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(await prisma.workspace.count({ where: { id: wsId } })).toBe(1);
  });

  it("非メンバーは他人のワークスペースを削除できない（403）", async () => {
    const a = await signupAgent({ email: "ws-a@example.com" });
    const b = await signupAgent({ email: "ws-b@example.com" });

    const meA = await a.agent.get("/api/auth/me");
    const wsId = meA.body.activeWorkspace.id as number;
    const name = meA.body.activeWorkspace.name as string;

    const res = await b.agent.delete(`/api/workspaces/${wsId}`).send({ name });
    expect(res.status).toBe(403);
    expect(await prisma.workspace.count({ where: { id: wsId } })).toBe(1);
  });
});
