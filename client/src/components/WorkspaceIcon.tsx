import { initialOf } from "../lib/image";

// ワークスペースアイコン。画像があれば画像、無ければ単色背景＋頭文字を角丸で表示する。
// （従来の「🗂」絵文字を置き換え。環境によって絵文字が潰れる問題も解消する。）
export default function WorkspaceIcon({
  workspace,
  size = 22,
}: {
  workspace: { name: string; iconColor?: string | null; iconImage?: string | null };
  size?: number;
}) {
  const dim = { width: size, height: size, fontSize: Math.round(size * 0.5) };

  if (workspace.iconImage) {
    return (
      <span
        className="ws-icon"
        style={{ ...dim, backgroundImage: `url(${workspace.iconImage})` }}
        aria-hidden
      />
    );
  }
  return (
    <span className="ws-icon" style={{ ...dim, background: workspace.iconColor || "#6366f1" }} aria-hidden>
      {initialOf(workspace.name)}
    </span>
  );
}
