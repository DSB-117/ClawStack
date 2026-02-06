import nextConfig from "eslint-config-next";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const eslintConfig = [
  {
    ignores: ["supabase/functions/**", ".next/**", "node_modules/**", "out/**", "**/*.d.ts"],
  },
  ...nextConfig,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];

export default eslintConfig;
