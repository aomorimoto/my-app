import { useEffect, useRef, useState, type DragEvent } from "react";

// 2つのリストが同じ id 並びかを判定する（無駄な再同期・再レンダーを避けるため）。
function sameIds<T extends { id: number }>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].id !== b[i].id) return false;
  return true;
}

// ネイティブ HTML5 D&D で並べ替えできるリストを扱う小さなフック。
// - source（取得データ）が変わったら内部順序を同期する（ドラッグ中は保留）。
// - ドロップ時に新しい id 配列で onReorder を呼ぶ（サーバ保存は呼び出し側で）。
// 返り値の items を描画し、各要素に onDragStart(i) 等を割り当てる。
export function useDragList<T extends { id: number }>(
  source: T[],
  onReorder: (ids: number[]) => void
) {
  const [items, setItems] = useState<T[]>(source);
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // 取得データの変化を内部順序へ反映（id 並びが同じなら据え置き＝無限ループ防止）。
  useEffect(() => {
    if (dragIndex.current != null) return; // ドラッグ操作中は同期しない
    setItems((prev) => (sameIds(prev, source) ? prev : source));
  }, [source]);

  const onDragStart = (index: number) => (e: DragEvent) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (index: number) => (e: DragEvent) => {
    e.preventDefault(); // これが無いと drop が発火しない
    e.dataTransfer.dropEffect = "move";
    if (overIndex !== index) setOverIndex(index);
  };

  const onDrop = (index: number) => (e: DragEvent) => {
    e.preventDefault();
    const from = dragIndex.current;
    dragIndex.current = null;
    setOverIndex(null);
    if (from == null || from === index) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    setItems(next);
    onReorder(next.map((it) => it.id));
  };

  const onDragEnd = () => {
    dragIndex.current = null;
    setOverIndex(null);
  };

  return { items, overIndex, onDragStart, onDragOver, onDrop, onDragEnd };
}
