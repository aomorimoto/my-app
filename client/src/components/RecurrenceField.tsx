import { parseRule, buildRule, WEEKDAYS, type Freq } from "../lib/recurrence";

// 繰り返しルール（RRULE 風文字列）の入力欄。
// 値は文字列（"" = 繰り返しなし）で受け渡しし、内部で頻度/間隔/曜日に分解して編集する。
// 期限（dueDate）が無いと完了時の次回生成ができないため、未設定時は注意書きを出す。
export default function RecurrenceField({
  value,
  onChange,
  hasDueDate,
}: {
  value: string; // ルール文字列 or ""
  onChange: (rule: string) => void;
  hasDueDate: boolean;
}) {
  const state = parseRule(value);

  const setFreq = (freq: Freq | "") => onChange(buildRule({ ...state, freq }) ?? "");
  const setInterval = (interval: number) =>
    onChange(buildRule({ ...state, interval: Math.max(1, interval || 1) }) ?? "");
  const toggleDay = (num: number) => {
    const byday = state.byday.includes(num)
      ? state.byday.filter((d) => d !== num)
      : [...state.byday, num];
    onChange(buildRule({ ...state, byday }) ?? "");
  };

  const unitLabel: Record<Freq, string> = {
    DAILY: "日",
    WEEKLY: "週間",
    MONTHLY: "か月",
    YEARLY: "年",
  };

  return (
    <div className="recurrence-field">
      <label>
        繰り返し
        <select value={state.freq} onChange={(e) => setFreq(e.target.value as Freq | "")}>
          <option value="">なし</option>
          <option value="DAILY">毎日</option>
          <option value="WEEKLY">毎週</option>
          <option value="MONTHLY">毎月</option>
          <option value="YEARLY">毎年</option>
        </select>
      </label>

      {state.freq && (
        <label className="recurrence-interval">
          間隔
          <span className="interval-inline">
            <input
              type="number"
              min={1}
              value={state.interval}
              onChange={(e) => setInterval(Number(e.target.value))}
            />
            {unitLabel[state.freq]}ごと
          </span>
        </label>
      )}

      {state.freq === "WEEKLY" && (
        <div className="recurrence-weekdays">
          <span className="field-label">曜日（未選択なら期限の曜日）</span>
          <div className="weekday-toggles">
            {WEEKDAYS.map((w) => (
              <button
                key={w.num}
                type="button"
                className={`weekday-toggle ${state.byday.includes(w.num) ? "on" : ""}`}
                aria-pressed={state.byday.includes(w.num)}
                onClick={() => toggleDay(w.num)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.freq && !hasDueDate && (
        <p className="muted recurrence-hint">
          ※ 繰り返しは期限日を基準に次回を生成します。期限を設定してください。
        </p>
      )}
    </div>
  );
}
