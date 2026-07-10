import { useEffect, useRef, useState, type DragEvent } from "react";

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

  // 取得データが更新されたら内部状態へ同期する（ドラッグ操作中は保留）。
  // source は React Query の構造共有により、データが変わったときだけ参照が変わる
  // （＝この effect も再実行される）ので、無限ループにはならない。
  // 以前は「id 並びが同じなら据え置き」にしていたが、それだと完了トグルなど
  // 「並びは同じでも中身（status 等）が変わった」更新が反映されず、リロードが必要だった。
  useEffect(() => {
    if (dragIndex.current != null) return; // ドラッグ操作中は同期しない
    setItems(source);
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
