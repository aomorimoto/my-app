import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetDb, signupAgent, closeDb } from "./helpers";

beforeEach(resetDb);
afterAll(closeDb);

// コメント API（MCP の list_comments / add_comment / update_comment / delete_comment が叩く先）。
describe("comments API", () => {
  it("投稿 → 一覧 → 編集 → 削除の一連が通る", async () => {
    const { agent, wsPublicId } = await signupAgent();
    const task = await agent.post(`/api/w/${wsPublicId}/tasks`).send({ title: "議題" });
    const comments = `/api/w/${wsPublicId}/tasks/${task.body.task.number}/comments`;

    const posted = await agent.post(comments).send({ body: "最初のコメント" });
    expect(posted.status).toBe(201);
    const commentId = posted.body.comment.id;
    expect(posted.body.comment.body).toBe("最初のコメント");
    expect(posted.body.comment.author).toBeTruthy();

    const list = await agent.get(comments);
    expect(list.status).toBe(200);
    expect(list.body.comments).toHaveLength(1);

    const edited = await agent.patch(`${comments}/${commentId}`).send({ body: "編集後" });
    expect(edited.status).toBe(200);
    expect(edited.body.comment.body).toBe("編集後");

    const del = await agent.delete(`${comments}/${commentId}`);
    expect(del.status).toBe(204);

    const after = await agent.get(comments);
    expect(after.body.comments).toHaveLength(0);
  });

  it("空のコメントは 400（zod バリデーション）", async () => {
    const { agent, wsPublicId } = await signupAgent();
    const task = await agent.post(`/api/w/${wsPublicId}/tasks`).send({ title: "議題" });
    const res = await agent
      .post(`/api/w/${wsPublicId}/tasks/${task.body.task.number}/comments`)
      .send({ body: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("存在しないタスクへのコメントは 404", async () => {
    const { agent, wsPublicId } = await signupAgent();
    const res = await agent.post(`/api/w/${wsPublicId}/tasks/999999/comments`).send({ body: "x" });
    expect(res.status).toBe(404);
  });

  it("未ログインでは 401", async () => {
    const res = await request(app).get("/api/w/anything/tasks/1/comments");
    expect(res.status).toBe(401);
  });
});
