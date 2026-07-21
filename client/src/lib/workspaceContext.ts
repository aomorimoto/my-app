import { createContext, useContext } from "react";
import type { Workspace } from "../types";

// URL 駆動のワークスペース・スコープ（Phase 16）。
// WorkspaceLayout が /w/:wsPublicId を解決し、対象WS（publicId と所属情報）をこの Context で配る。
// 配下のページ・クエリフックはここから現在のワークスペースを取得する（セッションのアクティブWSは廃止）。
export interface WorkspaceCtxValue {
  wsPublicId: string;
  workspace: Workspace;
}

export const WorkspaceContext = createContext<WorkspaceCtxValue | undefined>(undefined);

// 現在のワークスペース（publicId ＋ 所属情報）。ワークスペース・スコープ配下でのみ使う。
export function useWorkspace(): WorkspaceCtxValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace はワークスペース・スコープ配下でのみ使用できます。");
  return ctx;
}

// 現在のワークスペースの publicId（スコープ付き API パスの組み立てに使う）。
export function useWsPublicId(): string {
  return useWorkspace().wsPublicId;
}

// スコープ外（メイン画面など）でも安全に呼べる版。スコープ外では undefined を返す。
export function useOptionalWsPublicId(): string | undefined {
  return useContext(WorkspaceContext)?.wsPublicId;
}
