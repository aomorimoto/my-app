import { useState, type FormEvent } from "react";
import type { Role } from "../types";
import { memberLabel, formatDateTime } from "../labels";
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from "../queries/comments";

// タスクのコメントスレッド。投稿者本人 or OWNER/ADMIN は編集・削除できる。
export default function CommentThread({
  taskId,
  currentUserId,
  role,
}: {
  taskId: number;
  currentUserId: number | undefined;
  role: Role | undefined;
}) {
  const commentsQ = useComments(taskId);
  const create = useCreateComment(taskId);
  const update = useUpdateComment(taskId);
  const del = useDeleteComment(taskId);

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");

  const comments = commentsQ.data?.comments ?? [];
  const isManager = role === "OWNER" || role === "ADMIN";
  const canManage = (authorId: number) => authorId === currentUserId || isManager;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const text = body.trim();
    if (!text) return;
    create.mutate(text, {
      onSuccess: () => setBody(""),
      onError: (err) => setError(err.message || "投稿に失敗しました。"),
    });
  };

  const startEdit = (id: number, current: string) => {
    setEditingId(id);
    setEditBody(current);
  };

  const onSaveEdit = (id: number) => {
    const text = editBody.trim();
    if (!text) return;
    update.mutate(
      { id, body: text },
      { onSuccess: () => setEditingId(null) }
    );
  };

  const onDelete = (id: number) => {
    if (window.confirm("このコメントを削除しますか？")) {
      del.mutate(id);
    }
  };

  return (
    <section className="comment-section">
      <h2 className="section-title">コメント</h2>

      {commentsQ.isLoading ? (
        <p className="muted">読み込み中…</p>
      ) : comments.length === 0 ? (
        <p className="muted">まだコメントはありません。</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment-item">
              <div className="comment-head">
                <span className="comment-author">
                  {c.author ? memberLabel(c.author) : "不明なユーザー"}
                </span>
                <span className="comment-time muted">
                  {formatDateTime(c.createdAt)}
                  {new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 1000
                    ? "（編集済み）"
                    : ""}
                </span>
              </div>
              {editingId === c.id ? (
                <div className="comment-edit">
                  <textarea
                    rows={2}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                  <div className="comment-actions">
                    <button
                      type="button"
                      className="btn-small"
                      onClick={() => onSaveEdit(c.id)}
                      disabled={update.isPending}
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      className="btn-small"
                      onClick={() => setEditingId(null)}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="comment-body">{c.body}</div>
                  {canManage(c.authorId) && (
                    <div className="comment-actions">
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => startEdit(c.id, c.body)}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        className="btn-small danger"
                        onClick={() => onDelete(c.id)}
                        disabled={del.isPending}
                      >
                        削除
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="form comment-form" onSubmit={onSubmit}>
        {error && <p className="error">{error}</p>}
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="コメントを追加…"
        />
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          投稿
        </button>
      </form>
    </section>
  );
}
