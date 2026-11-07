import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    singleQuote: true,
    ignorePatterns: ['AGENTS.md', 'docs/**', '**/dist/**', 'pnpm-lock.yaml'],
  },
  lint: {
    ignorePatterns: ['**/dist/**'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
    overrides: [{ files: ['apps/web/src/**'], plugins: ['react', 'jsx-a11y'] }],
  },
  run: { cache: false },
});
