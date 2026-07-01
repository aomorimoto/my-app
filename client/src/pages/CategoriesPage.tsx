import { useState, type FormEvent } from "react";
import { useCategories, useCreateCategory, useDeleteCategory } from "../queries/categories";

export default function CategoriesPage() {
  const catsQ = useCategories();
  const create = useCreateCategory();
  const del = useDeleteCategory();

  const [name, setName] = useState("");
  const [color, setColor] = useState("#888888");
  const [error, setError] = useState<string | null>(null);

  const categories = catsQ.data?.categories ?? [];

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

  const onDelete = (id: number, label: string) => {
    if (window.confirm(`「${label}」を削除しますか？（タスクは残ります）`)) {
      del.mutate(id);
    }
  };

  return (
    <>
      <h1>カテゴリ</h1>

      <form className="form card category-form" onSubmit={onSubmit}>
        {error && <p className="error">{error}</p>}
        <label className="grow">
          名前
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="カテゴリ名"
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

      {catsQ.isLoading ? (
        <p className="muted">読み込み中…</p>
      ) : categories.length === 0 ? (
        <p className="empty">カテゴリがまだありません。</p>
      ) : (
        <ul className="category-list">
          {categories.map((c) => (
            <li key={c.id} className="category-item card">
              <span className="swatch" style={{ background: c.color }} />
              <span className="category-name">{c.name}</span>
              <span className="muted">{c._count?.tasks ?? 0} 件のタスク</span>
              <button
                type="button"
                className="btn-small danger"
                onClick={() => onDelete(c.id, c.name)}
                disabled={del.isPending}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
