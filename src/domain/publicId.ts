import { randomBytes } from "node:crypto";

// ワークスペースの外部公開ID（不透明）を生成する。
// URL（/w/:publicId/…）や AI 出力に露出する識別子で、連番の内部 id を隠すのが目的。
// 12 文字の base64url（[A-Za-z0-9_-]、URL でそのまま使える）。衝突は @@unique で防御する。
export function generatePublicId(): string {
  return randomBytes(9).toString("base64url"); // 9 byte → 12 文字
}
