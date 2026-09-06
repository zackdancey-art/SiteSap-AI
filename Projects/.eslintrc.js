// Anchored to this file's own directory so `parserOptions.project` paths resolve
// against the workspace root (Projects/) no matter what cwd ESLint runs from.
// Without this, `tsconfigRootDir` defaults to cwd, and when `next lint` runs from
// apps/supervisor-web the workspace-relative project paths DOUBLE
// (…/apps/supervisor-web/apps/supervisor-web/tsconfig.json → "Cannot read file").
// This is finding H5. Keep as .js (not .json) so `__dirname` is available.
const tsconfigRootDir = __dirname;

module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir,
    project: [
      "./tsconfig.json",
      "./services/api/tsconfig.json",
      "./shared/tsconfig.build.json",
      "./apps/mobile/tsconfig.json",
      "./apps/supervisor-web/tsconfig.json",
    ],
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "error",
  },
  overrides: [
    {
      files: ["babel.config.js", "**/babel.config.js", "metro.config.js", "**/metro.config.js"],
      env: { node: true },
      parserOptions: { sourceType: "script", project: null },
      rules: {
        "no-undef": "off",
        "@typescript-eslint/no-require-imports": "off",
      },
    },
    {
      files: ["apps/mobile/**/*.{ts,tsx}"],
      rules: {
        "no-restricted-imports": ["error", { patterns: ["services/*", "services/**"] }],
      },
      parserOptions: { tsconfigRootDir, project: ["./apps/mobile/tsconfig.json"] },
    },
    {
      files: ["apps/supervisor-web/**/*.{ts,tsx}"],
      rules: {
        "no-restricted-imports": ["error", { patterns: ["services/*", "services/**"] }],
      },
      parserOptions: { tsconfigRootDir, project: ["./apps/supervisor-web/tsconfig.json"] },
    },
    {
      files: ["services/**/*.{ts,tsx,js,jsx}"],
      rules: {
        "no-restricted-imports": ["error", { patterns: ["apps/*", "apps/**"] }],
      },
      parserOptions: { tsconfigRootDir, project: ["./services/api/tsconfig.json"] },
    },
    {
      files: ["shared/**/*.{ts,tsx,js,jsx}"],
      parserOptions: { tsconfigRootDir, project: ["./shared/tsconfig.build.json"] },
    },
  ],
};
