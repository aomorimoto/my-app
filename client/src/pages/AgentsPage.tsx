import { useState, type FormEvent } from "react";
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent } from "../queries/agents";
import { memberLabel } from "../labels";

// AI エージェント管理（ワークスペースごと）。ここで登録したエージェントを
// タスクの「担当者」に指定できる。1人のユーザーが複数のエージェントを持てる。
export default function AgentsPage() {
  const agentsQ = useAgents();
  const create = useCreateAgent();
  const update = useUpdateAgent();
  const del = useDeleteAgent();

  const [name, setName] = useState("");
  const [color, setColor] = useState("#6b7280");
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6b7280");

  const agents = agentsQ.data?.agents ?? [];

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate(
      { name, color },
      {
        onSuccess: () => {
          setName("");
          setColor("#6b7280");
        },
        onError: (err) => setError(err.message || "追加に失敗しました。"),
      }
    );
  };

  const startEdit = (id: number, curName: string, curColor: string) => {
    setEditingId(id);
    setEditName(curName);
    setEditColor(curColor);
    setError(null);
  };

  const onSaveEdit = (id: number) => {
    update.mutate(
      { id, name: editName, color: editColor },
      {
        onSuccess: () => setEditingId(null),
        onError: (err) => setError(err.message || "更新に失敗しました。"),
      }
    );
  };

  const onDelete = (id: number, label: string) => {
    if (window.confirm(`「${label}」を削除しますか？（担当タスクは未割当に戻ります）`)) {
      del.mutate(id);
    }
  };

  return (
    <>
      <h1>AI エージェント</h1>
      <p className="muted">
        登録した AI エージェントは、タスクの担当者に人間メンバーと同じように指定できます。
      </p>

      <form className="form card category-form" onSubmit={onSubmit}>
        {error && <p className="error">{error}</p>}
        <label className="grow">
          名前
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: リサーチ担当エージェント"
            required
          />
        </label>
        <label>
          色
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          追加
        </button>
      </form>

      {agentsQ.isLoading ? (
        <p className="muted">読み込み中…</p>
      ) : agents.length === 0 ? (
        <p className="empty">エージェントがまだありません。</p>
      ) : (
        <ul className="category-list">
          {agents.map((a) => (
            <li key={a.id} className="category-item card">
              {editingId === a.id ? (
                <>
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                  />
                  <input
                    type="text"
                    className="tag-edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => onSaveEdit(a.id)}
                    disabled={update.isPending}
                  >
                    保存
                  </button>
                  <button type="button" className="btn-small" onClick={() => setEditingId(null)}>
                    キャンセル
                  </button>
                </>
              ) : (
                <>
                  <span className="swatch" style={{ background: a.color }}>
                    🤖
                  </span>
                  <span className="category-name">{a.name}</span>
                  {a.owner && (
                    <span className="muted">使用者: {memberLabel(a.owner)}</span>
                  )}
                  <span className="muted">{a._count?.assignedTasks ?? 0} 件のタスク</span>
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => startEdit(a.id, a.name, a.color)}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className="btn-small danger"
                    onClick={() => onDelete(a.id, a.name)}
                    disabled={del.isPending}
                  >
                    削除
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
