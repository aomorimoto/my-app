import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMe } from "../queries/auth";
import {
  useMembers,
  useAddMember,
  useUpdateMemberRole,
  useRemoveMember,
  useCreateWorkspace,
  useActivateWorkspace,
} from "../queries/workspaces";
import { ROLE_LABEL, memberLabel } from "../labels";
import type { Role } from "../types";

const ASSIGNABLE_ROLES: Role[] = ["ADMIN", "MEMBER"];

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const meQ = useMe();
  const active = meQ.data?.activeWorkspace;
  const activeId = active?.id;
  const myUserId = meQ.data?.user?.id;
  const canManage = active?.role === "OWNER" || active?.role === "ADMIN";

  const membersQ = useMembers(activeId);
  const addMember = useAddMember(activeId ?? 0);
  const updateRole = useUpdateMemberRole(activeId ?? 0);
  const removeMember = useRemoveMember(activeId ?? 0);
  const createWs = useCreateWorkspace();
  const activateWs = useActivateWorkspace();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [addError, setAddError] = useState<string | null>(null);

  const [wsName, setWsName] = useState("");
  const [wsError, setWsError] = useState<string | null>(null);

  const members = membersQ.data?.members ?? [];

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    setAddError(null);
    addMember.mutate(
      { email, role },
      {
        onSuccess: () => {
          setEmail("");
          setRole("MEMBER");
        },
        onError: (err) => setAddError(err.message || "追加に失敗しました。"),
      }
    );
  };

  const onRemove = (userId: number, label: string) => {
    if (window.confirm(`「${label}」をこのワークスペースから削除しますか？`)) {
      removeMember.mutate(userId);
    }
  };

  const onCreateWs = (e: FormEvent) => {
    e.preventDefault();
    setWsError(null);
    createWs.mutate(
      { name: wsName },
      {
        onSuccess: (data) => {
          // 作成したワークスペースに切り替えてタスク画面へ
          activateWs.mutate(data.workspace.id, { onSuccess: () => navigate("/tasks") });
        },
        onError: (err) => setWsError(err.message || "作成に失敗しました。"),
      }
    );
  };

  return (
    <>
      <h1>ワークスペース</h1>

      {active && (
        <p className="muted">
          現在: <strong>{active.name}</strong>（あなたの役割: {ROLE_LABEL[active.role]}）
        </p>
      )}

      <h2>メンバー</h2>
      {membersQ.isLoading ? (
        <p className="muted">読み込み中…</p>
      ) : (
        <ul className="members-list">
          {members.map((m) => {
            const isOwner = m.role === "OWNER";
            const isSelf = m.id === myUserId;
            const showControls = canManage && !isOwner && !isSelf;
            return (
              <li key={m.id} className="member-item card">
                <span className="member-name">
                  {memberLabel(m)}
                  {isSelf && <span className="muted">（あなた）</span>}
                </span>
                <span className="muted member-email">{m.email}</span>
                {showControls ? (
                  <select
                    className="role-select"
                    value={m.role}
                    onChange={(e) =>
                      updateRole.mutate({ userId: m.id, role: e.target.value as Role })
                    }
                    disabled={updateRole.isPending}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="badge role">{ROLE_LABEL[m.role]}</span>
                )}
                {showControls && (
                  <button
                    type="button"
                    className="btn-small danger"
                    onClick={() => onRemove(m.id, memberLabel(m))}
                    disabled={removeMember.isPending}
                  >
                    削除
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (
        <form className="form card member-form" onSubmit={onAdd}>
          <h2>メンバーを追加</h2>
          {addError && <p className="error">{addError}</p>}
          <p className="muted">既に登録済みのユーザーをメールアドレスで追加します。</p>
          <label className="grow">
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              required
            />
          </label>
          <label>
            役割
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary" disabled={addMember.isPending}>
            追加
          </button>
        </form>
      )}

      <form className="form card ws-create-form" onSubmit={onCreateWs}>
        <h2>新しいワークスペースを作成</h2>
        {wsError && <p className="error">{wsError}</p>}
        <label className="grow">
          名前
          <input
            type="text"
            value={wsName}
            onChange={(e) => setWsName(e.target.value)}
            placeholder="チーム名・プロジェクト名"
            required
          />
        </label>
        <button
          type="submit"
          className="btn-primary"
          disabled={createWs.isPending || activateWs.isPending}
        >
          作成して切り替え
        </button>
      </form>
    </>
  );
}
