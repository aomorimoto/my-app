import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMe, useUpdateMe } from "../queries/auth";
import { fileToSquareDataUrl } from "../lib/image";
import { DEFAULT_COLORS, COLOR_FIELDS } from "../theme";
import type { ColorPrefs } from "../types";
import UserAvatar from "../components/UserAvatar";
import SettingsLayout, { type SettingsSection } from "../components/SettingsLayout";

// 既定色に、保存済みの colorPrefs を上書きして初期値を作る。
function initialColors(prefs: ColorPrefs | null | undefined): Required<ColorPrefs> {
  return { ...DEFAULT_COLORS, ...(prefs ?? {}) };
}

// ユーザー設定（ワークスペース非依存の全体設定）:
//   - プロフィール（名前）
//   - アバター（単色背景＋頭文字 / アップロード画像）
//   - 表示色（状態・優先度・期限）
export default function AccountPage() {
  const meQ = useMe();
  const update = useUpdateMe();
  const user = meQ.data?.user;

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [avatarColor, setAvatarColor] = useState("#2563eb");
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [colors, setColors] = useState<Required<ColorPrefs>>(DEFAULT_COLORS);

  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 取得したユーザー情報をフォームへ反映
  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setName(user.name ?? "");
      setAvatarColor(user.avatarColor || "#2563eb");
      setAvatarImage(user.avatarImage ?? null);
      setColors(initialColors(user.colorPrefs));
    }
  }, [user]);

  if (meQ.isLoading) return <p className="muted">読み込み中…</p>;
  if (!user) return <p className="error">ユーザー情報を取得できませんでした。</p>;

  const flash = (text: string) => {
    setError(null);
    setMsg(text);
  };
  const fail = (e: unknown) => {
    setMsg(null);
    setError((e as Error)?.message || "保存に失敗しました。");
  };

  // プレビュー用の擬似ユーザー（現在のフォーム値でアバターを表示）
  const preview = { name, username, avatarColor, avatarImage };

  const onSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    // ユーザーIDは変更時のみ送る（サーバ側で小文字化・重複チェック）。
    const nextUsername = username.trim().toLowerCase();
    const payload: { name: string | null; username?: string } = { name: name.trim() || null };
    if (nextUsername !== user.username) payload.username = nextUsername;
    update.mutate(payload, {
      onSuccess: () => flash("プロフィールを保存しました。"),
      onError: fail,
    });
  };

  const onPickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToSquareDataUrl(file);
      setAvatarImage(dataUrl);
      setMsg(null);
      setError(null);
    } catch (err) {
      fail(err);
    } finally {
      if (fileRef.current) fileRef.current.value = ""; // 同じファイルを選び直せるように
    }
  };

  const onSaveAvatar = () => {
    update.mutate(
      { avatarColor, avatarImage },
      { onSuccess: () => flash("アバターを保存しました。"), onError: fail }
    );
  };

  const onRemoveImage = () => setAvatarImage(null);

  const onSaveColors = () => {
    update.mutate(
      { colorPrefs: colors },
      { onSuccess: () => flash("表示色を保存しました。"), onError: fail }
    );
  };

  const onResetColors = () => {
    setColors(DEFAULT_COLORS);
    update.mutate(
      { colorPrefs: null },
      { onSuccess: () => flash("表示色を既定に戻しました。"), onError: fail }
    );
  };

  const sections: SettingsSection[] = [
    {
      id: "profile",
      label: "プロフィール",
      content: (
        <form className="form card stack-form" onSubmit={onSaveProfile}>
          <h2 className="section-title">プロフィール</h2>
          <label>
            名前
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="表示名" />
          </label>
          <label>
            ユーザーID
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user_id"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <small className="muted">
              ログインに使うIDです。英小文字・数字・_ . - の3〜30文字。変更するとログインIDも新しいIDに変わります。
            </small>
          </label>
          <div className="actions">
            <button type="submit" className="btn-primary" disabled={update.isPending}>
              保存
            </button>
          </div>
        </form>
      ),
    },
    {
      id: "avatar",
      label: "アバター",
      content: (
        <section className="card">
          <h2 className="section-title">アバター</h2>
          <div className="avatar-edit">
            <UserAvatar user={preview} size={72} />
            <div className="avatar-controls">
              <label className="inline-color">
                背景色
                <input
                  type="color"
                  value={avatarColor}
                  onChange={(e) => setAvatarColor(e.target.value)}
                />
              </label>
              <p className="muted avatar-hint">
                画像を設定すると背景色より画像が優先されます。未設定なら背景色＋頭文字を表示します。
              </p>
              <div className="avatar-buttons">
                <button
                  type="button"
                  className="btn-small"
                  onClick={() => fileRef.current?.click()}
                >
                  画像をアップロード
                </button>
                {avatarImage && (
                  <button type="button" className="btn-small" onClick={onRemoveImage}>
                    画像を外す
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickImage}
                  hidden
                />
              </div>
            </div>
          </div>
          <div className="actions">
            <button type="button" className="btn-primary" onClick={onSaveAvatar} disabled={update.isPending}>
              アバターを保存
            </button>
          </div>
        </section>
      ),
    },
    {
      id: "colors",
      label: "表示色",
      content: (
        <section className="card">
          <h2 className="section-title">表示色</h2>
          <p className="muted">状態・優先度・期限バッジの色をカスタマイズできます。</p>
          <ul className="color-pref-list">
            {COLOR_FIELDS.map((f) => (
              <li key={f.key} className="color-pref-item">
                <input
                  type="color"
                  value={colors[f.key]}
                  onChange={(e) =>
                    setColors((c) => ({ ...c, [f.key]: e.target.value }) as Required<ColorPrefs>)
                  }
                  aria-label={f.label}
                />
                <span className="color-pref-label">{f.label}</span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() =>
                    setColors((c) => ({ ...c, [f.key]: DEFAULT_COLORS[f.key] }) as Required<ColorPrefs>)
                  }
                >
                  既定
                </button>
              </li>
            ))}
          </ul>
          <div className="actions">
            <button type="button" className="btn-primary" onClick={onSaveColors} disabled={update.isPending}>
              表示色を保存
            </button>
            <button type="button" className="btn-small" onClick={onResetColors} disabled={update.isPending}>
              すべて既定に戻す
            </button>
          </div>
        </section>
      ),
    },
  ];

  return (
    <>
      <p className="breadcrumb">
        <Link to="/">← ホーム</Link>
      </p>
      <h1>ユーザー設定</h1>
      {msg && <p className="muted settings-flash">{msg}</p>}
      {error && <p className="error settings-flash">{error}</p>}
      <SettingsLayout sections={sections} navLabel="ユーザー設定セクション" />
    </>
  );
}
