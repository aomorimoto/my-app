import { useState } from "react";
import WorkspaceGeneralPage from "./WorkspaceGeneralPage";
import WorkspacesPage from "./WorkspacesPage";
import TagsPage from "./TagsPage";
import AgentsPage from "./AgentsPage";

// ワークスペース画面の設定タブ。ワークスペース（名前・アイコン）/ ユーザー（メンバー＋
// AIエージェント）/ タグの管理を1画面に集約し、内部のセグメントで切り替える。
// AI エージェントは「担当者になれるユーザー」の一種として、ユーザータブに含める。
type Section = "workspace" | "users" | "tags";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "workspace", label: "ワークスペース" },
  { key: "users", label: "ユーザー" },
  { key: "tags", label: "タグ" },
];

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("workspace");

  return (
    <>
      <div className="seg settings-seg" role="tablist" aria-label="設定セクション">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={section === s.key}
            className={`seg-btn ${section === s.key ? "active" : ""}`}
            onClick={() => setSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "workspace" && <WorkspaceGeneralPage />}
      {section === "users" && (
        <>
          {/* 人間メンバーと AI エージェントを1つの「ユーザー」タブにまとめて表示する */}
          <WorkspacesPage />
          <AgentsPage />
        </>
      )}
      {section === "tags" && <TagsPage />}
    </>
  );
}
