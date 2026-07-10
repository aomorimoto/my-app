import { useEffect, useRef, useState, type ReactNode } from "react";

export interface SettingsSection {
  id: string;
  label: string;
  content: ReactNode;
}

// 設定画面の共通レイアウト（Discord の設定風）。
// 左に項目一覧、右に各セクションを縦に並べ、項目クリックで対象セクションへ
// スムーズスクロールする。スクロール位置に応じて左ナビの現在地をハイライトする。
export default function SettingsLayout({
  sections,
  navLabel = "設定セクション",
}: {
  sections: SettingsSection[];
  navLabel?: string;
}) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  // 最新の sections をスクロールハンドラから参照するための ref（監視は一度だけ登録する）。
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  // クリックによるプログラム的スクロール中はスクロール監視を一時停止するための期限。
  const lockUntil = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      if (Date.now() < lockUntil.current) return;
      // ビューポート上部（offset）を越えている最も下のセクションを現在地とみなす。
      const offset = 120;
      const secs = sectionsRef.current;
      let current = secs[0]?.id ?? "";
      for (const s of secs) {
        const el = document.getElementById(`settings-${s.id}`);
        if (el && el.getBoundingClientRect().top <= offset) current = s.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const jump = (id: string) => {
    const el = document.getElementById(`settings-${id}`);
    if (!el) return;
    setActive(id);
    lockUntil.current = Date.now() + 700; // スムーズスクロール中は監視を止める
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label={navLabel}>
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`settings-nav-item${active === s.id ? " active" : ""}`}
            aria-current={active === s.id ? "true" : undefined}
            onClick={() => jump(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="settings-content">
        {sections.map((s) => (
          <div key={s.id} id={`settings-${s.id}`} className="settings-section">
            {s.content}
          </div>
        ))}
      </div>
    </div>
  );
}
