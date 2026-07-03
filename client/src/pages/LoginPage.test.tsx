import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import LoginPage from "./LoginPage";

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
    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
    expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
  });

  it("誤った資格情報でエラーメッセージを表示する", async () => {
    const fetchMock = vi.fn();
    // 1回目: /api/auth/me（未ログイン）
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: null, activeWorkspace: null }));
    // 2回目: /api/auth/login（401）
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, {
        error: { code: "INVALID_CREDENTIALS", message: "メールアドレスまたはパスワードが違います。" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders(<LoginPage />);

    await screen.findByRole("heading", { name: "ログイン" });
    await userEvent.type(screen.getByLabelText("メールアドレス"), "bad@example.com");
    await userEvent.type(screen.getByLabelText("パスワード"), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(
      await screen.findByText("メールアドレスまたはパスワードが違います。")
    ).toBeInTheDocument();
  });
});
