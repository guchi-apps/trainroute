import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // PM2 が CommonJS として読み込む設定ファイル。アプリのビルド対象ではないため、
    // ESM 前提のルール（no-require-imports）を当てない。
    "deploy/ecosystem.config.js",
  ]),
  {
    rules: {
      // 使わない引数をアンダースコア始まりにして明示できるようにする。
      // 実装していない拡張ポイント（src/lib/transit/index.ts）で、引数の名前と型を
      // 契約として残したまま未使用にしておきたいため。
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
