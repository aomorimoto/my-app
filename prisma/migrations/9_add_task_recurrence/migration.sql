-- 繰り返しタスク（Phase: 追加機能 2026-07-11）。
-- Task に NULL 許容カラムを2つ追加するだけの加算マイグレーション。
ALTER TABLE "Task" ADD COLUMN "recurrenceRule" TEXT;
ALTER TABLE "Task" ADD COLUMN "recurrenceParentId" INTEGER;
