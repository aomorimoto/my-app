// 繰り返しタスクのルール（RRULE 風文字列）の検証と「次回日」計算。
// 外部ライブラリ（rrule 等）は入れず、RFC 5545 のサブセットだけを自前で扱う。
//
// サポートするサブセット（`;` 区切り・大文字・順不同）:
//   FREQ=DAILY | WEEKLY | MONTHLY | YEARLY   （必須）
//   INTERVAL=<正の整数>                        （任意・既定 1）
//   BYDAY=SU,MO,TU,WE,TH,FR,SA の任意個         （任意・WEEKLY のときだけ意味を持つ）
// 例: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE"（毎週 月・水）, "FREQ=MONTHLY;INTERVAL=2"（2か月ごと）。
//
// 日付は「日単位」で扱い、タイムゾーン/DST の影響を避けるため UTC で計算する
// （アプリの dueDate は "YYYY-MM-DD" 由来の UTC 深夜で保存される）。

export type Freq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface Recurrence {
  freq: Freq;
  interval: number; // >= 1
  byday: number[]; // 0=Sun .. 6=Sat（WEEKLY のみ有効・空なら dueDate の曜日）
}

const FREQS: Freq[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

// BYDAY トークン → JS getUTCDay の曜日番号（0=Sun .. 6=Sat）
const DAY_TOKENS: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};
const DAY_TOKEN_BY_NUM = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const MS_PER_DAY = 86_400_000;

// ルール文字列を構造体へパースする。形式不正なら null を返す（例外は投げない）。
export function parseRecurrenceRule(rule: string): Recurrence | null {
  if (typeof rule !== "string" || rule.trim() === "") return null;

  const parts = rule.trim().split(";");
  let freq: Freq | undefined;
  let interval = 1;
  let byday: number[] = [];

  for (const part of parts) {
    const [rawKey, rawVal] = part.split("=");
    if (rawKey === undefined || rawVal === undefined) return null;
    const key = rawKey.trim().toUpperCase();
    const val = rawVal.trim().toUpperCase();

    switch (key) {
      case "FREQ":
        if (!FREQS.includes(val as Freq)) return null;
        freq = val as Freq;
        break;
      case "INTERVAL": {
        if (!/^\d+$/.test(val)) return null;
        const n = Number(val);
        if (!Number.isInteger(n) || n < 1) return null;
        interval = n;
        break;
      }
      case "BYDAY": {
        const tokens = val.split(",").map((t) => t.trim());
        const nums: number[] = [];
        for (const t of tokens) {
          if (!(t in DAY_TOKENS)) return null;
          nums.push(DAY_TOKENS[t]);
        }
        byday = [...new Set(nums)].sort((a, b) => a - b);
        break;
      }
      default:
        return null; // 未知のキーは受け付けない
    }
  }

  if (!freq) return null;
  return { freq, interval, byday };
}

// zod の refine 等で使う検証関数。
export function isValidRecurrenceRule(rule: string): boolean {
  return parseRecurrenceRule(rule) !== null;
}

// 構造体をルール文字列へ整形する（クライアントと表現を揃えたいとき用）。
export function formatRecurrenceRule(rec: Recurrence): string {
  const parts = [`FREQ=${rec.freq}`, `INTERVAL=${rec.interval}`];
  if (rec.freq === "WEEKLY" && rec.byday.length > 0) {
    parts.push(`BYDAY=${rec.byday.map((n) => DAY_TOKEN_BY_NUM[n]).join(",")}`);
  }
  return parts.join(";");
}

// UTC 深夜に丸めた日数（1970-01-01 からの通日）。
function toUTCDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY
  );
}

// 通日 → その曜日（0=Sun .. 6=Sat）。1970-01-01 は木曜(4)。
function dayOfWeek(dayNum: number): number {
  return ((((dayNum + 4) % 7) + 7) % 7);
}

// 通日 → 週インデックス（月曜起点でグループ化）。interval 週の判定に使う。
// 1970-01-05(通日4) が月曜なので、(dayNum - 4) を 7 で割った床。
function weekIndex(dayNum: number): number {
  return Math.floor((dayNum - 4) / 7);
}

// UTC で months か月を加算し、月末を超える日付はその月の末日にクランプする
// （例: 1/31 + 1か月 → 2/28）。時刻成分は据え置く。
function addUTCMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const targetIndex = m + months;
  const ty = y + Math.floor(targetIndex / 12);
  const tm = ((targetIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const td = Math.min(d, lastDay);
  return new Date(
    Date.UTC(
      ty,
      tm,
      td,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}

// 通日 + 時刻成分 → Date（元の時刻を保つ）。
function dayNumberToDate(dayNum: number, timeSource: Date): Date {
  const base = dayNum * MS_PER_DAY;
  const timeOfDay =
    timeSource.getTime() -
    Date.UTC(
      timeSource.getUTCFullYear(),
      timeSource.getUTCMonth(),
      timeSource.getUTCDate()
    );
  return new Date(base + timeOfDay);
}

// `from`（前回の期限日）より後の、ルールに従う次回の期限日を返す。
// ルールが不正なら null。基準は「今日」ではなく前回の期限日にする（スケジュール維持）。
export function nextOccurrence(from: Date, rule: string): Date | null {
  const rec = parseRecurrenceRule(rule);
  if (!rec) return null;

  switch (rec.freq) {
    case "DAILY":
      return new Date(from.getTime() + rec.interval * MS_PER_DAY);

    case "WEEKLY": {
      if (rec.byday.length === 0) {
        // 曜日指定なし: from の曜日を interval 週ごとに繰り返す。
        return new Date(from.getTime() + 7 * rec.interval * MS_PER_DAY);
      }
      // 曜日指定あり: from の翌日から走査し、指定曜日かつ interval 週おきに合致する最初の日。
      const fromDay = toUTCDayNumber(from);
      const fromWeek = weekIndex(fromDay);
      // 安全上限（interval 年ぶんを超えたら諦める。実際は数週間以内に必ず見つかる）。
      const limit = fromDay + 7 * rec.interval + 366;
      for (let d = fromDay + 1; d <= limit; d++) {
        if (
          rec.byday.includes(dayOfWeek(d)) &&
          (weekIndex(d) - fromWeek) % rec.interval === 0
        ) {
          return dayNumberToDate(d, from);
        }
      }
      return null;
    }

    case "MONTHLY":
      return addUTCMonths(from, rec.interval);

    case "YEARLY":
      return addUTCMonths(from, 12 * rec.interval);

    default:
      return null;
  }
}
