import { useState, type FormEvent } from "react";
import { useMe } from "../queries/auth";
import {
  useMembers,
  useAddMember,
  useUpdateMemberRole,
  useRemoveMember,
} from "../queries/workspaces";
import { useWorkspace } from "../lib/workspaceContext";
import { ROLE_LABEL, memberLabel } from "../labels";
import type { Role } from "../types";

const ASSIGNABLE_ROLES: Role[] = ["ADMIN", "MEMBER"];

export default function WorkspacesPage() {
  const meQ = useMe();
  const { workspace: active } = useWorkspace();
  const myUserId = meQ.data?.user?.id;
  const canManage = active.role === "OWNER" || active.role === "ADMIN";

  const membersQ = useMembers();
  const addMember = useAddMember();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [addError, setAddError] = useState<string | null>(null);

  const members = membersQ.data?.members ?? [];

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    setAddError(null);
    addMember.mutate(
      { username, role },
      {
        onSuccess: () => {
          setUsername("");
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

  return (
    <>
      <h2 className="section-title">👤 メンバー</h2>

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
                <span className="muted member-email">@{m.username}</span>
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
          <p className="muted">既に登録済みのユーザーをユーザーIDで追加します。</p>
          <label className="grow">
            ユーザーID
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="member_id"
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
    </>
  );
}
