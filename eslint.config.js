import js from "@eslint/js";
import tseslint from "typescript-eslint";

// バックエンド（Node / TypeScript, ESM）用の ESLint flat config。
// client/ は独自の設定を持つため対象外。生成物（generated）とビルド成果物（dist）は除外する。
export default tseslint.config(
  { ignores: ["generated/**", "client/**", "mcp/**", "**/dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // ESLint 9 flat config は既定で .js のみ対象。.ts を明示して lint 対象に含める。
    files: ["**/*.ts"],
    rules: {
      // 型の未定義参照は tsc が検査するため、no-undef は無効化（process / console 等の誤検知回避）
      "no-undef": "off",
      // 既存コードに any を使う箇所があるため、まずは許容（段階的に強化）
      "@typescript-eslint/no-explicit-any": "off",
      // _ 始まりの引数・変数は「意図的に未使用」として無視する
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  }
);
