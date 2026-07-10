import SettingsLayout, { type SettingsSection } from "../components/SettingsLayout";
import WorkspaceGeneralPage from "./WorkspaceGeneralPage";
import WorkspacesPage from "./WorkspacesPage";
import TagsPage from "./TagsPage";
import AgentsPage from "./AgentsPage";

// ワークスペース画面の設定タブ。ワークスペース（名前・アイコン）/ メンバー /
// AI エージェント / タグの管理を1画面に集約し、左の項目一覧から各セクションへ飛べる。
// AI エージェントは「担当者になれるユーザー」の一種として扱う。
const SECTIONS: SettingsSection[] = [
  { id: "workspace", label: "ワークスペース", content: <WorkspaceGeneralPage /> },
  { id: "members", label: "メンバー", content: <WorkspacesPage /> },
  { id: "agents", label: "AI エージェント", content: <AgentsPage /> },
  { id: "tags", label: "タグ", content: <TagsPage /> },
];

export default function SettingsPage() {
  return <SettingsLayout sections={SECTIONS} navLabel="設定セクション" />;
}
