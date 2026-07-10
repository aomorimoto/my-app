import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import LoginPage, { safeReturnTo } from "./LoginPage";

// apiFetch は内部で fetch を呼ぶだけなので、fetch をスタブしてネットワークを遮断する。
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginPage", () => {
  it("ログインフォームを表示する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { user: null, activeWorkspace: null })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<LoginPage />);

    expect(await screen.findByRole("heading", { name: "ログイン" })).toBeInTheDocument();
    expect(screen.getByLabelText("ユーザーID")).toBeInTheDocument();
    expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
  });

  it("誤った資格情報でエラーメッセージを表示する", async () => {
    const fetchMock = vi.fn();
    // 1回目: /api/auth/me（未ログイン）
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: null, activeWorkspace: null }));
    // 2回目: /api/auth/login（401）
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, {
        error: { code: "INVALID_CREDENTIALS", message: "ユーザーIDまたはパスワードが違います。" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<LoginPage />);

    await screen.findByRole("heading", { name: "ログイン" });
    await userEvent.type(screen.getByLabelText("ユーザーID"), "baduser");
    await userEvent.type(screen.getByLabelText("パスワード"), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(
      await screen.findByText("ユーザーIDまたはパスワードが違います。")
    ).toBeInTheDocument();
  });
});

describe("safeReturnTo（OAuth 復帰先の検証）", () => {
  it("/authorize（クエリ有無）は許可する", () => {
    expect(safeReturnTo("/authorize")).toBe("/authorize");
    expect(safeReturnTo("/authorize?client_id=abc&state=xyz")).toBe(
      "/authorize?client_id=abc&state=xyz"
    );
  });

  it("null や /authorize 以外の相対パスは null にフォールバックする", () => {
    expect(safeReturnTo(null)).toBeNull();
    expect(safeReturnTo("/tasks")).toBeNull();
    expect(safeReturnTo("/authorized-evil")).toBeNull(); // 前方一致バイパスを防ぐ
  });

  it("外部オリジンへのオープンリダイレクトを弾く", () => {
    expect(safeReturnTo("//evil.com/authorize")).toBeNull();
    expect(safeReturnTo("https://evil.com/authorize")).toBeNull();
    expect(safeReturnTo("http://evil.com")).toBeNull();
  });
});
