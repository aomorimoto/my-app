-- Phase 16 (④): ワークスペース公開ID（不透明）＋タスクのWSごと連番
-- 露出する識別子だけを差し替える（内部の autoincrement id は FK 用に保持）。
-- 加算＋バックフィルの手書きマイグレーション（構造だけの diff では採番できないため）。

-- === Workspace.publicId（不透明ID） ===
ALTER TABLE "Workspace" ADD COLUMN "publicId" TEXT;
-- 既存行を採番: 12文字の16進（gen_random_uuid の一部）。WS は少数なので衝突は事実上ない
-- （万一の重複は下の UNIQUE INDEX 作成で検知される）。
UPDATE "Workspace"
SET "publicId" = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
WHERE "publicId" IS NULL;
ALTER TABLE "Workspace" ALTER COLUMN "publicId" SET NOT NULL;
CREATE UNIQUE INDEX "Workspace_publicId_key" ON "Workspace"("publicId");

-- === Task.number（WSごとの連番） ===
ALTER TABLE "Task" ADD COLUMN "number" INTEGER;
-- 既存行を WS ごとに createdAt 昇順（同時刻は id 昇順）で 1,2,3… と採番。
WITH numbered AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY "workspaceId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "Task"
)
UPDATE "Task" t
SET "number" = n.rn
FROM numbered n
WHERE t.id = n.id;
ALTER TABLE "Task" ALTER COLUMN "number" SET NOT NULL;
CREATE UNIQUE INDEX "Task_workspaceId_number_key" ON "Task"("workspaceId", "number");
