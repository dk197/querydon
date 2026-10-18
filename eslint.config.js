import eslint from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
	globalIgnores(["**/dist/", "**/coverage/", "**/node_modules/"]),

	eslint.configs.recommended,
	tseslint.configs.strictTypeChecked,
	tseslint.configs.stylisticTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		linterOptions: {
			reportUnusedDisableDirectives: "error",
			reportUnusedInlineConfigs: "error",
		},
		rules: {
			curly: ["error", "all"],
			eqeqeq: ["error", "always"],
			"no-console": "error",
			"no-implicit-coercion": "error",
			"no-nested-ternary": "error",
			"no-param-reassign": "error",
			"object-shorthand": "error",
			"prefer-template": "error",
			"no-restricted-syntax": ["error", { selector: "TSEnumDeclaration", message: "Use union types or const objects instead of enums." }],

			"@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
			"@typescript-eslint/explicit-function-return-type": ["error", { allowExpressions: true, allowTypedFunctionExpressions: true }],
			"@typescript-eslint/explicit-member-accessibility": ["error", { accessibility: "no-public" }],
			"@typescript-eslint/no-import-type-side-effects": "error",
			"@typescript-eslint/prefer-readonly": "error",
			"@typescript-eslint/promise-function-async": "error",
			"@typescript-eslint/require-array-sort-compare": "error",
			"@typescript-eslint/return-await": ["error", "always"],
			"@typescript-eslint/strict-boolean-expressions": "error",
			"@typescript-eslint/switch-exhaustiveness-check": ["error", { considerDefaultExhaustiveForUnions: false }],
		},
	},

	{
		files: ["**/*.{js,mjs,cjs}"],
		extends: [tseslint.configs.disableTypeChecked],
	},

	{
		files: ["apps/backend/**/*.ts"],
		languageOptions: { globals: globals.node },
		rules: {
			// NestJS modules are decorated empty classes
			"@typescript-eslint/no-extraneous-class": ["error", { allowWithDecorator: true }],
		},
	},

	{
		files: ["apps/frontend/**/*.{ts,tsx}"],
		extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
		languageOptions: { globals: globals.browser },
	},

	prettier,
);
