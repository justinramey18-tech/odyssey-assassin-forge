import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Every real d20 roll must go through rollD20() in src/lib/rollD20.ts so it
      // respects dice odds and triggers the crit cinematic. Animation-only
      // spinning numbers may disable this line with a comment saying why.
      "no-restricted-syntax": ["warn",
        {
          selector: "BinaryExpression[operator='*'][left.callee.object.name='Math'][left.callee.property.name='random'][right.value=20]",
          message: "Real d20 rolls must use rollD20() from '@/lib/rollD20'. Animation-only? Add an eslint-disable comment explaining why.",
        },
        {
          selector: "CallExpression[callee.name='rollDice'][arguments.0.value='d20']",
          message: "d20 rolls must use rollD20() from '@/lib/rollD20' so dice odds and the crit cinematic apply.",
        },
      ],
    },
  },
);
