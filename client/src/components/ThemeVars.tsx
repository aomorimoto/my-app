import { useEffect } from "react";
import { useMe } from "../queries/auth";
import { COLOR_FIELDS } from "../theme";

// ログインユーザーの色設定（colorPrefs）を CSS 変数として document のルートに適用する。
// 未設定のキーは変数を解除し、styles.css の :root 既定値へフォールバックさせる。
// 画面を描画しない副作用専用コンポーネント（Layout に1つだけ置く）。
export default function ThemeVars() {
  const { data } = useMe();
  const prefs = data?.user?.colorPrefs ?? null;

  useEffect(() => {
    const root = document.documentElement;
    for (const f of COLOR_FIELDS) {
      const v = prefs?.[f.key];
      if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) {
        root.style.setProperty(f.cssVar, v);
      } else {
        root.style.removeProperty(f.cssVar);
      }
    }
  }, [prefs]);

  return null;
}
