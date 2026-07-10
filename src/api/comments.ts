import { Router } from "express";
import { prisma } from "../db";
import { resolveWorkspace } from "../domain/workspace";
import { commentCreateSchema, commentUpdateSchema } from "./schemas";
import { HttpError, parseId } from "./http";

// タスク配下にネストするコメントルータ（/api/tasks/:taskId/comments）。
// 親ルータの :taskId を読むため mergeParams を有効にする。
export const apiCommentsRouter = Router({ mergeParams: true });

// 対象ワークスペースにタスクが存在するか確認する。無ければ 404。
async function assertTaskInWorkspace(workspaceId: number, taskId: number) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
    select: { id: true },
  });
  if (!task) throw new HttpError(404, "タスクが見つかりません。", "NOT_FOUND");
}

// コメントの公開表現に整える（投稿者情報を含める）
const commentInclude = {
  author: { select: { id: true, username: true, name: true } },
} as const;

// コメント一覧（古い順）。メンバーなら閲覧可。
apiCommentsRouter.get("/", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const taskId = parseId(req.params.taskId);
  await assertTaskInWorkspace(workspaceId, taskId);

  const comments = await prisma.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    include: commentInclude,
  });
  res.json({ comments });
});

// コメント投稿。メンバーなら誰でも可。
apiCommentsRouter.post("/", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const userId = req.userId!;
  const taskId = parseId(req.params.taskId);
  await assertTaskInWorkspace(workspaceId, taskId);
  const { body } = commentCreateSchema.parse(req.body);

  const comment = await prisma.comment.create({
    data: { body, taskId, authorId: userId },
    include: commentInclude,
  });
  res.status(201).json({ comment });
});

// 対象コメントを取得し、編集/削除権限（投稿者本人 or OWNER/ADMIN）を検証する。
async function getEditableComment(
  workspaceId: number,
  taskId: number,
  commentId: number,
  userId: number,
  role: string
) {
  await assertTaskInWorkspace(workspaceId, taskId);
  const comment = await prisma.comment.findFirst({ where: { id: commentId, taskId } });
  if (!comment) throw new HttpError(404, "コメントが見つかりません。", "NOT_FOUND");
  const canManage = comment.authorId === userId || role === "OWNER" || role === "ADMIN";
  if (!canManage) {
    throw new HttpError(403, "このコメントを操作する権限がありません。", "FORBIDDEN");
  }
  return comment;
}

// コメント編集（投稿者本人 or OWNER/ADMIN）
apiCommentsRouter.patch("/:commentId", async (req, res) => {
  const { workspaceId, role } = await resolveWorkspace(req);
  const userId = req.userId!;
  const taskId = parseId(req.params.taskId);
  const commentId = parseId(req.params.commentId);
  await getEditableComment(workspaceId, taskId, commentId, userId, role);
  const { body } = commentUpdateSchema.parse(req.body);

  const comment = await prisma.comment.update({
    where: { id: commentId },
    data: { body },
    include: commentInclude,
  });
  res.json({ comment });
});

// コメント削除（投稿者本人 or OWNER/ADMIN）
apiCommentsRouter.delete("/:commentId", async (req, res) => {
  const { workspaceId, role } = await resolveWorkspace(req);
  const userId = req.userId!;
  const taskId = parseId(req.params.taskId);
  const commentId = parseId(req.params.commentId);
  await getEditableComment(workspaceId, taskId, commentId, userId, role);

  await prisma.comment.delete({ where: { id: commentId } });
  res.status(204).end();
});
