import type { Tag } from "../types";

// タグの複数選択（チェックボックス式のチップ）。選択状態は親が保持する。
export default function TagSelector({
  tags,
  selected,
  onChange,
}: {
  tags: Tag[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const toggle = (id: number) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  if (tags.length === 0) {
    return <p className="muted">タグがありません。「タグ」ページで作成できます。</p>;
  }

  return (
    <div className="tag-selector">
      {tags.map((t) => {
        const on = selected.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            className={`tag-chip ${on ? "on" : ""}`}
            style={on ? { background: t.color, borderColor: t.color, color: "#fff" } : undefined}
            onClick={() => toggle(t.id)}
            aria-pressed={on}
          >
            {on ? "✓ " : ""}
            {t.name}
          </button>
        );
      })}
    </div>
  );
}
