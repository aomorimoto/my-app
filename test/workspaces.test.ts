import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, signupAgent, closeDb } from "./helpers";
import { prisma } from "../src/db";

beforeEach(resetDb);
afterAll(closeDb);

type Signed = Awaited<ReturnType<typeof signupAgent>>;

// 対象ユーザーの2つ目のワークスペースを作成し、その publicId を返す。
// （個人ワークスペースだけだと「最後の1つ」ガードに阻まれるため）
async function createSecondWorkspace(a: Signed, name: string) {
  const created = await a.agent.post("/api/workspaces").send({ name });
  expect(created.status).toBe(201);
  return created.body.workspace.publicId as string;
}

describe("workspace delete API", () => {
  it("OWNER は確認名が一致すれば削除できる（204）", async () => {
    const a = await signupAgent({ username: "ws-del" });
    const wsPid = await createSecondWorkspace(a, "削除対象WS");

    const res = await a.agent.delete(`/api/workspaces/${wsPid}`).send({ name: "削除対象WS" });
    expect(res.status).toBe(204);

    // 一覧から消えている
    const list = await a.agent.get("/api/workspaces");
    expect(list.body.workspaces.map((w: { publicId: string }) => w.publicId)).not.toContain(wsPid);
    // DB からも消えている
    expect(await prisma.workspace.count({ where: { publicId: wsPid } })).toBe(0);
  });

  it("確認名が一致しないと削除できない（400 NAME_MISMATCH）", async () => {
    const a = await signupAgent({ username: "ws-mismatch" });
    const wsPid = await createSecondWorkspace(a, "本番用WS");

    const res = await a.agent.delete(`/api/workspaces/${wsPid}`).send({ name: "ちがう名前" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("NAME_MISMATCH");
    // 残っている
    expect(await prisma.workspace.count({ where: { publicId: wsPid } })).toBe(1);
  });

  it("確認名が空だと 400（バリデーション）", async () => {
    const a = await signupAgent({ username: "ws-empty" });
    const wsPid = await createSecondWorkspace(a, "空確認WS");

    const res = await a.agent.delete(`/api/workspaces/${wsPid}`).send({ name: "" });
    expect(res.status).toBe(400);
    expect(await prisma.workspace.count({ where: { publicId: wsPid } })).toBe(1);
  });

  it("配下のタスク・タグも連鎖削除される", async () => {
    const a = await signupAgent({ username: "ws-cascade" });
    const wsPid = await createSecondWorkspace(a, "カスケードWS");

    // URL 駆動なので対象WSの publicId を直接使う（アクティブ化は不要）。
    const task = await a.agent.post(`/api/w/${wsPid}/tasks`).send({ title: "消えるタスク" });
    expect(task.status).toBe(201);
    const tag = await a.agent.post(`/api/w/${wsPid}/tags`).send({ name: "消えるタグ" });
    expect(tag.status).toBe(201);

    const res = await a.agent.delete(`/api/workspaces/${wsPid}`).send({ name: "カスケードWS" });
    expect(res.status).toBe(204);

    expect(await prisma.task.count({ where: { workspace: { publicId: wsPid } } })).toBe(0);
    expect(await prisma.tag.count({ where: { workspace: { publicId: wsPid } } })).toBe(0);
    expect(await prisma.membership.count({ where: { workspace: { publicId: wsPid } } })).toBe(0);
  });

  it("最後のワークスペースは削除できない（409 LAST_WORKSPACE）", async () => {
    const a = await signupAgent({ username: "ws-last" });
    const list = await a.agent.get("/api/workspaces");
    const ws = list.body.workspaces[0];

    const res = await a.agent.delete(`/api/workspaces/${ws.publicId}`).send({ name: ws.name });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LAST_WORKSPACE");
    expect(await prisma.workspace.count({ where: { publicId: ws.publicId } })).toBe(1);
  });

  it("ADMIN は削除できない（403 FORBIDDEN）", async () => {
    const owner = await signupAgent({ username: "ws-adm-owner" });
    const member = await signupAgent({ username: "ws-adm-member" });

    const created = await owner.agent.post("/api/workspaces").send({ name: "共有WS" });
    const wsPid = created.body.workspace.publicId as string;

    // ADMIN としてメンバー追加
    const add = await owner.agent
      .post(`/api/w/${wsPid}/members`)
      .send({ username: "ws-adm-member", role: "ADMIN" });
    expect(add.status).toBe(201);
    expect(add.body.member.role).toBe("ADMIN");

    const res = await member.agent.delete(`/api/workspaces/${wsPid}`).send({ name: "共有WS" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(await prisma.workspace.count({ where: { publicId: wsPid } })).toBe(1);
  });

  it("非メンバーは他人のワークスペースを削除できない（403）", async () => {
    const a = await signupAgent({ username: "ws-a" });
    const b = await signupAgent({ username: "ws-b" });

    const listA = await a.agent.get("/api/workspaces");
    const ws = listA.body.workspaces[0];

    const res = await b.agent.delete(`/api/workspaces/${ws.publicId}`).send({ name: ws.name });
    expect(res.status).toBe(403);
    expect(await prisma.workspace.count({ where: { publicId: ws.publicId } })).toBe(1);
  });
});
