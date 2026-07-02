import { useState } from "react";
import { Link } from "react-router-dom";
import type { Task, TaskFilters } from "../types";
import { useTasks } from "../queries/tasks";
import { PRIORITY_LABEL } from "../labels";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const MAX_CHIPS = 3; // 1セルに表示する最大タスク数（超過は「＋N件」）

// カレンダーは全タスク（トップレベル）の期限を対象にするので絞り込みなしで取得する。
// TasksPage と同じ空フィルタ形なので React Query のキャッシュを共有できる。
const NO_FILTERS: TaskFilters = {
  status: "",
  priority: "",
  category: "",
  assignee: "",
  tag: "",
  sort: "",
};

// ローカル日付の「年-月-日」キー。期限は UTC 深夜保存だが、表示は他画面（formatDate）と
// 揃えてブラウザのローカル時刻で解釈する。
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function CalendarPage() {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const { data, isLoading, isError } = useTasks(NO_FILTERS);
  const tasks = data?.tasks ?? [];

  // 期限を持つタスクを日付キーでまとめる
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const key = dayKey(new Date(t.dueDate));
    const arr = byDay.get(key);
    if (arr) arr.push(t);
    else byDay.set(key, [t]);
  }

  const { year, month } = cursor;
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=日曜
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7; // 週数ぶんのマス
  const cells: Date[] = [];
  for (let i = 0; i < totalCells; i++) {
    cells.push(new Date(year, month, 1 - firstDayOfWeek + i));
  }

  const goPrev = () =>
    setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  const goNext = () =>
    setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));
  const goToday = () => setCursor({ year: today.getFullYear(), month: today.getMonth() });

  return (
    <>
      <h1>カレンダー</h1>

      <div className="cal-toolbar">
        <button type="button" className="btn-small" onClick={goPrev}>
          ← 前月
        </button>
        <button type="button" className="btn-small" onClick={goToday}>
          今月
        </button>
        <button type="button" className="btn-small" onClick={goNext}>
          翌月 →
        </button>
        <span className="cal-title">
          {year}年{month + 1}月
        </span>
      </div>

      {isLoading ? (
        <p className="muted">読み込み中…</p>
      ) : isError ? (
        <p className="error">タスクの取得に失敗しました。</p>
      ) : (
        <div className="calendar">
          <div className="cal-head">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`cal-weekday${i === 0 ? " sun" : ""}${i === 6 ? " sat" : ""}`}>
                {w}
              </div>
            ))}
          </div>
          <div className="cal-grid">
            {cells.map((cell) => {
              const inMonth = cell.getMonth() === month;
              const isToday = dayKey(cell) === dayKey(today);
              const dow = cell.getDay();
              const dayTasks = byDay.get(dayKey(cell)) ?? [];
              const shown = dayTasks.slice(0, MAX_CHIPS);
              const extra = dayTasks.length - shown.length;

              return (
                <div
                  key={cell.toISOString()}
                  className={`cal-cell${inMonth ? "" : " out"}${isToday ? " today" : ""}`}
                >
                  <div className={`cal-daynum${dow === 0 ? " sun" : ""}${dow === 6 ? " sat" : ""}`}>
                    {cell.getDate()}
                  </div>
                  <div className="cal-tasks">
                    {shown.map((t) => {
                      const done = t.status === "DONE";
                      const overdue = !done && new Date(t.dueDate!) < todayStart;
                      return (
                        <Link
                          key={t.id}
                          to={`/tasks/${t.id}`}
                          className={`cal-chip prio-${t.priority.toLowerCase()}${done ? " done" : ""}${
                            overdue ? " overdue" : ""
                          }`}
                          title={`${t.title}（優先度: ${PRIORITY_LABEL[t.priority]}）`}
                        >
                          {t.title}
                        </Link>
                      );
                    })}
                    {extra > 0 && <div className="cal-more">＋{extra}件</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
