import { Router } from "express";
import { prisma } from "../db";
import { userUpdateSchema } from "./schemas";
import { HttpError } from "./http";

export const apiUsersRouter = Router();

// 返却用のユーザー select（パスワード等は含めない）
const publicSelect = {
  id: true,
  username: true,
  name: true,
  avatarColor: true,
  avatarImage: true,
  colorPrefs: true,
} as const;

function publicUser(user: {
  id: number;
  username: string;
  name: string | null;
  avatarColor: string | null;
  avatarImage: string | null;
  colorPrefs: unknown;
}) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatarColor: user.avatarColor,
    avatarImage: user.avatarImage,
    colorPrefs: (user.colorPrefs as Record<string, string> | null) ?? null,
  };
}

// 自分のプロフィール更新（名前・アバター色/画像・表示色設定）。送られた項目のみ更新。
apiUsersRouter.patch("/me", async (req, res) => {
  const userId = req.userId!;
  const input = userUpdateSchema.parse(req.body);

  const data: Record<string, unknown> = {};
  // ユーザーID（username）の変更。重複時は 409（signup と同じ扱い）。
  // 自分の現在の username と同じ場合（大文字小文字だけ変えた等）は衝突扱いしない。
  if (input.username !== undefined) {
    const taken = await prisma.user.findUnique({
      where: { username: input.username },
      select: { id: true },
    });
    if (taken && taken.id !== userId) {
      throw new HttpError(409, "このユーザーIDは既に使われています。", "USERNAME_TAKEN");
    }
    data.username = input.username;
  }
  if (input.name !== undefined) data.name = input.name;
  if (input.avatarColor !== undefined) data.avatarColor = input.avatarColor;
  if (input.avatarImage !== undefined) data.avatarImage = input.avatarImage;
  if (input.colorPrefs !== undefined) {
    // null → 設定をクリア。オブジェクトは、実際に色が入っているキーだけ保存する。
    data.colorPrefs = input.colorPrefs
      ? Object.fromEntries(
          Object.entries(input.colorPrefs).filter(([, v]) => typeof v === "string")
        )
      : null;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: publicSelect,
  });
  res.json({ user: publicUser(user) });
});
