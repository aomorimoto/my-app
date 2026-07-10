// AI エージェントのアイコン。画像があれば画像、無ければ単色背景＋🤖 を丸型で表示する。
// ユーザーの UserAvatar / ワークスペースの WorkspaceIcon と同じ見た目の系列。
export default function AgentIcon({
  agent,
  size = 22,
}: {
  agent: { name: string; color: string; iconImage?: string | null };
  size?: number;
}) {
  const dim = { width: size, height: size, fontSize: Math.round(size * 0.6) };

  if (agent.iconImage) {
    return (
      <span
        className="agent-icon"
        style={{ ...dim, backgroundImage: `url(${agent.iconImage})` }}
        aria-hidden
      />
    );
  }
  return (
    <span className="agent-icon" style={{ ...dim, background: agent.color || "#6b7280" }} aria-hidden>
      🤖
    </span>
  );
}
