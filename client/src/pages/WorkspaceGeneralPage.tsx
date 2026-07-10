import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMe } from "../queries/auth";
import { useUpdateWorkspace, useDeleteWorkspace } from "../queries/workspaces";
import { fileToSquareDataUrl } from "../lib/image";
import WorkspaceIcon from "../components/WorkspaceIcon";

// ワークスペースの一般設定（名前・アイコン）。編集は OWNER / ADMIN のみ。
export default function WorkspaceGeneralPage() {
  const meQ = useMe();
  const active = meQ.data?.activeWorkspace;
  const activeId = active?.id;
  const canManage = active?.role === "OWNER" || active?.role === "ADMIN";
  const isOwner = active?.role === "OWNER";
  const update = useUpdateWorkspace(activeId ?? 0);
  const remove = useDeleteWorkspace(activeId ?? 0);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [iconColor, setIconColor] = useState("#6366f1");
  const [iconImage, setIconImage] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 削除の確認フロー（誤削除防止のためワークスペース名の再入力を求める）
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (active) {
      setName(active.name);
      setIconColor(active.iconColor || "#6366f1");
      setIconImage(active.iconImage ?? null);
    }
  }, [active]);

  if (!active) return <p className="muted">読み込み中…</p>;

  const fail = (e: unknown) => {
    setMsg(null);
    setError((e as Error)?.message || "保存に失敗しました。");
  };

  const preview = { name, iconColor, iconImage };

  const onPickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIconImage(await fileToSquareDataUrl(file));
      setMsg(null);
      setError(null);
    } catch (err) {
      fail(err);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(
      { name: name.trim(), iconColor, iconImage },
      {
        onSuccess: () => {
          setError(null);
          setMsg("保存しました。");
        },
        onError: fail,
      }
    );
  };

  // 入力された確認名が現在のワークスペース名と完全一致したときだけ削除を許可する。
  const confirmMatches = confirmName.trim() === active.name;

  const onDelete = (e: FormEvent) => {
    e.preventDefault();
    if (!confirmMatches) return;
    setDeleteError(null);
    remove.mutate(confirmName.trim(), {
      onSuccess: () => navigate("/"),
      onError: (err) => setDeleteError((err as Error)?.message || "削除に失敗しました。"),
    });
  };

  return (
    <>
      <h2 className="section-title">一般</h2>
      {msg && <p className="muted">{msg}</p>}
      {error && <p className="error">{error}</p>}

      {!canManage ? (
        <div className="card">
          <div className="avatar-edit">
            <WorkspaceIcon workspace={active} size={56} />
            <div>
              <div className="ws-name">{active.name}</div>
              <p className="muted">名前・アイコンの編集はオーナー / 管理者のみ可能です。</p>
            </div>
          </div>
        </div>
      ) : (
        <form className="form card stack-form" onSubmit={onSave}>
          <label>
            名前
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <div className="avatar-edit">
            <WorkspaceIcon workspace={preview} size={56} />
            <div className="avatar-controls">
              <label className="inline-color">
                背景色
                <input
                  type="color"
                  value={iconColor}
                  onChange={(e) => setIconColor(e.target.value)}
                />
              </label>
              <p className="muted avatar-hint">
                画像を設定すると背景色より画像が優先されます。未設定なら背景色＋頭文字を表示します。
              </p>
              <div className="avatar-buttons">
                <button type="button" className="btn-small" onClick={() => fileRef.current?.click()}>
                  画像をアップロード
                </button>
                {iconImage && (
                  <button type="button" className="btn-small" onClick={() => setIconImage(null)}>
                    画像を外す
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} hidden />
              </div>
            </div>
          </div>
          <div className="actions">
            <button type="submit" className="btn-primary" disabled={update.isPending}>
              保存
            </button>
          </div>
        </form>
      )}

      {isOwner && (
        <section className="card danger-zone">
          <h3 className="danger-title">危険な操作</h3>
          <p className="muted">
            ワークスペースを削除すると、含まれるタスク・タグ・AI エージェント・メンバー・コメントも
            すべて完全に削除されます。この操作は取り消せません。
          </p>

          {!confirmOpen ? (
            <div className="actions">
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  setConfirmOpen(true);
                  setConfirmName("");
                  setDeleteError(null);
                }}
              >
                このワークスペースを削除
              </button>
            </div>
          ) : (
            <form className="stack-form" onSubmit={onDelete}>
              {deleteError && <p className="error">{deleteError}</p>}
              <label>
                確認のため、ワークスペース名「<strong>{active.name}</strong>」を入力してください
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={active.name}
                  autoFocus
                />
              </label>
              <div className="actions">
                <button
                  type="submit"
                  className="btn-danger"
                  disabled={!confirmMatches || remove.isPending}
                >
                  {remove.isPending ? "削除中…" : "完全に削除する"}
                </button>
                <button
                  type="button"
                  className="btn-small"
                  onClick={() => {
                    setConfirmOpen(false);
                    setConfirmName("");
                    setDeleteError(null);
                  }}
                  disabled={remove.isPending}
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </>
  );
}
