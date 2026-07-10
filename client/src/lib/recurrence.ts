// 繰り返しルール（RRULE 風文字列）の UI 用ユーティリティ。
// サーバの src/domain/recurrence.ts と同じサブセット（FREQ / INTERVAL / BYDAY）を扱う。
// UI では「頻度セレクト＋間隔＋（毎週のとき）曜日トグル」を、この文字列へ相互変換する。

export type Freq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface RecurrenceState {
  freq: Freq | ""; // "" = 繰り返しなし
  interval: number; // >= 1
  byday: number[]; // 0=日 .. 6=土（WEEKLY のみ有効）
}

export const EMPTY_RECURRENCE: RecurrenceState = { freq: "", interval: 1, byday: [] };

// 曜日ラベル（0=日 .. 6=土）と RRULE トークンの対応。
export const WEEKDAYS: { num: number; label: string; token: string }[] = [
  { num: 0, label: "日", token: "SU" },
  { num: 1, label: "月", token: "MO" },
  { num: 2, label: "火", token: "TU" },
  { num: 3, label: "水", token: "WE" },
  { num: 4, label: "木", token: "TH" },
  { num: 5, label: "金", token: "FR" },
  { num: 6, label: "土", token: "SA" },
];

const TOKEN_TO_NUM: Record<string, number> = Object.fromEntries(
  WEEKDAYS.map((w) => [w.token, w.num])
);
const NUM_TO_TOKEN = WEEKDAYS.map((w) => w.token);
const FREQS: Freq[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
const FREQ_LABEL: Record<Freq, string> = {
  DAILY: "毎日",
  WEEKLY: "毎週",
  MONTHLY: "毎月",
  YEARLY: "毎年",
};

// ルール文字列 → UI 状態。不正/未設定は「繰り返しなし」。
export function parseRule(rule: string | null | undefined): RecurrenceState {
  if (!rule || rule.trim() === "") return { ...EMPTY_RECURRENCE };
  let freq: Freq | "" = "";
  let interval = 1;
  let byday: number[] = [];
  for (const part of rule.trim().split(";")) {
    const [k, v] = part.split("=");
    if (k === undefined || v === undefined) return { ...EMPTY_RECURRENCE };
    const key = k.trim().toUpperCase();
    const val = v.trim().toUpperCase();
    if (key === "FREQ") {
      if (!FREQS.includes(val as Freq)) return { ...EMPTY_RECURRENCE };
      freq = val as Freq;
    } else if (key === "INTERVAL") {
      const n = Number(val);
      if (Number.isInteger(n) && n >= 1) interval = n;
    } else if (key === "BYDAY") {
      byday = val
        .split(",")
        .map((t) => TOKEN_TO_NUM[t.trim()])
        .filter((n) => n !== undefined);
      byday = [...new Set(byday)].sort((a, b) => a - b);
    }
  }
  if (!freq) return { ...EMPTY_RECURRENCE };
  return { freq, interval, byday };
}

// UI 状態 → ルール文字列。freq が "" なら null（繰り返しなし）。
export function buildRule(state: RecurrenceState): string | null {
  if (!state.freq) return null;
  const interval = Number.isInteger(state.interval) && state.interval >= 1 ? state.interval : 1;
  const parts = [`FREQ=${state.freq}`, `INTERVAL=${interval}`];
  if (state.freq === "WEEKLY" && state.byday.length > 0) {
    const tokens = [...state.byday].sort((a, b) => a - b).map((n) => NUM_TO_TOKEN[n]);
    parts.push(`BYDAY=${tokens.join(",")}`);
  }
  return parts.join(";");
}

// ルール文字列 → 表示ラベル（バッジ等）。例「毎週 月・水」「2週間ごと」「繰り返しなし」。
export function recurrenceLabel(rule: string | null | undefined): string {
  const s = parseRule(rule);
  if (!s.freq) return "繰り返しなし";
  const unit: Record<Freq, string> = { DAILY: "日", WEEKLY: "週間", MONTHLY: "か月", YEARLY: "年" };
  const base = s.interval > 1 ? `${s.interval}${unit[s.freq]}ごと` : FREQ_LABEL[s.freq];
  if (s.freq === "WEEKLY" && s.byday.length > 0) {
    const days = s.byday
      .map((n) => WEEKDAYS.find((w) => w.num === n)?.label ?? "")
      .join("・");
    return `${base} ${days}`;
  }
  return base;
}
