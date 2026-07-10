import { memberLabel } from "../labels";
import { initialOf } from "../lib/image";

// ユーザーアバター。画像があれば画像、無ければ単色背景＋頭文字を丸型で表示する。
export default function UserAvatar({
  user,
  size = 28,
}: {
  user: {
    name: string | null;
    email: string;
    avatarColor?: string | null;
    avatarImage?: string | null;
  };
  size?: number;
}) {
  const dim = { width: size, height: size, fontSize: Math.round(size * 0.42) };

  if (user.avatarImage) {
    return (
      <span
        className="avatar"
        style={{ ...dim, backgroundImage: `url(${user.avatarImage})` }}
        aria-hidden
      />
    );
  }
  return (
    <span className="avatar" style={{ ...dim, background: user.avatarColor || "var(--primary)" }} aria-hidden>
      {initialOf(memberLabel(user))}
    </span>
  );
}
