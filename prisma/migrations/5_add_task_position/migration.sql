-- タスクの兄弟内表示順（D&D 並べ替え用）。既存タスクはすべて 0 で開始し、
-- 表示は (position asc, createdAt) をタイブレークにするため既存の見た目は概ね維持される。
-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;
