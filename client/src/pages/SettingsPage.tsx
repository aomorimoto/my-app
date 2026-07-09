import { useState } from "react";
import WorkspacesPage from "./WorkspacesPage";
import TagsPage from "./TagsPage";
import AgentsPage from "./AgentsPage";

// ワークスペース画面の設定タブ。メンバー / タグ / エージェントの管理を1画面に集約し、
// 内部のセグメントで切り替える（各セクションは既存ページをそのまま再利用）。
type Section = "members" | "tags" | "agents";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "members", label: "メンバー" },
  { key: "tags", label: "タグ" },
  { key: "agents", label: "エージェント" },
];

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("members");

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

      {section === "members" && <WorkspacesPage />}
      {section === "tags" && <TagsPage />}
      {section === "agents" && <AgentsPage />}
    </>
  );
}
