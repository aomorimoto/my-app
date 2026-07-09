import { useState } from "react";
import type { Task } from "../types";
import { PRIORITY_LABEL } from "../labels";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const MAX_CHIPS = 3; // 1セルに表示する最大タスク数（超過は「＋N件」）

// ローカル日付の「年-月-日」キー。期限は UTC 深夜保存だが、表示は他画面（formatDate）と
// 揃えてブラウザのローカル時刻で解釈する。
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// 月表示のカレンダー本体（プレゼンテーション）。データ取得は呼び出し側が行う。
//   tasks:        期限のあるタスクを日付セルに配置する（期限なしは無視）。
//   onOpenTask:   チップをクリックしたときの遷移（WS単位/集約で挙動が異なるため注入）。
//   showWorkspace: true のとき、チップに所属ワークスペース名を併記（集約カレンダー用）。
export default function CalendarGrid({
  tasks,
  onOpenTask,
  showWorkspace = false,
}: {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  showWorkspace?: boolean;
}) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

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
                    const ws = showWorkspace && t.workspace ? `${t.workspace.name} / ` : "";
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onOpenTask(t)}
                        className={`cal-chip prio-${t.priority.toLowerCase()}${done ? " done" : ""}${
                          overdue ? " overdue" : ""
                        }`}
                        title={`${t.title}（${ws}優先度: ${PRIORITY_LABEL[t.priority]}）`}
                      >
                        {showWorkspace && t.workspace && (
                          <span className="cal-chip-ws">{t.workspace.name}</span>
                        )}
                        {t.title}
                      </button>
                    );
                  })}
                  {extra > 0 && <div className="cal-more">＋{extra}件</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
