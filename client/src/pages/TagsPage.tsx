import { useState, type FormEvent } from "react";
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from "../queries/tags";

export default function TagsPage() {
  const tagsQ = useTags();
  const create = useCreateTag();
  const update = useUpdateTag();
  const del = useDeleteTag();

  const [name, setName] = useState("");
  const [color, setColor] = useState("#888888");
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#888888");

  const tags = tagsQ.data?.tags ?? [];

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate(
      { name, color },
      {
        onSuccess: () => {
          setName("");
          setColor("#888888");
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
    if (window.confirm(`「${label}」を削除しますか？（タスクは残ります）`)) {
      del.mutate(id);
    }
  };

  return (
    <>
      <h1>タグ</h1>

      <form className="form card category-form" onSubmit={onSubmit}>
        {error && <p className="error">{error}</p>}
        <label className="grow">
          名前
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="タグ名"
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

      {tagsQ.isLoading ? (
        <p className="muted">読み込み中…</p>
      ) : tags.length === 0 ? (
        <p className="empty">タグがまだありません。</p>
      ) : (
        <ul className="category-list">
          {tags.map((t) => (
            <li key={t.id} className="category-item card">
              {editingId === t.id ? (
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
                    onClick={() => onSaveEdit(t.id)}
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
                  <span className="swatch" style={{ background: t.color }} />
                  <span className="category-name">{t.name}</span>
                  <span className="muted">{t._count?.taskTags ?? 0} 件のタスク</span>
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => startEdit(t.id, t.name, t.color)}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className="btn-small danger"
                    onClick={() => onDelete(t.id, t.name)}
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
