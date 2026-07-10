-- メール廃止・ユーザーID（username）化（Phase: 2026-07-11）。
-- 既存データは保持し、username は email のローカル部（@ より前）から自動生成する。
-- 形式: 英小文字・数字・_ . -（3〜30 文字）。衝突は連番/ID で一意化する。

-- 1) まず NULL 許容で追加。
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- 2) email ローカル部を整形して候補を作り、同一候補には連番を付けて一意化する。
WITH base AS (
  SELECT
    id,
    -- 小文字化 → 許可外文字を除去 → 30 文字に切り詰め。
    left(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_.-]', '', 'g'), 30) AS cand
  FROM "User"
),
fixed AS (
  -- 3 文字未満/空になったものは user<ID> にフォールバック。
  SELECT id, CASE WHEN length(cand) < 3 THEN left('user' || id::text, 30) ELSE cand END AS cand
  FROM base
),
numbered AS (
  SELECT id, cand, row_number() OVER (PARTITION BY cand ORDER BY id) AS rn
  FROM fixed
)
UPDATE "User" u
SET username = CASE
  WHEN n.rn = 1 THEN n.cand
  ELSE left(n.cand, 27) || n.rn::text -- 連番を付けても 30 文字以内に収める
END
FROM numbered n
WHERE u.id = n.id;

-- 3) 念のための最終保証: それでも重複が残れば ID を付けて必ず一意にする。
UPDATE "User" u
SET username = left(u.username, 24) || '_' || u.id::text
WHERE EXISTS (
  SELECT 1 FROM "User" x WHERE x.username = u.username AND x.id <> u.id
);

-- 4) NOT NULL + 一意制約を付け、email を削除する。
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
DROP INDEX IF EXISTS "User_email_key";
ALTER TABLE "User" DROP COLUMN "email";
