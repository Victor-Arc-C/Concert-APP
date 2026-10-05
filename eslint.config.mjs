import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import a11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
export default tseslint.config(
  {
    ignores: [
      '.next/**',
      '.data/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks, 'jsx-a11y': a11y },
    rules: { ...hooks.configs.recommended.rules, ...a11y.configs.recommended.rules, 'jsx-a11y/label-has-associated-control': ['error', { depth: 3 }] },
  },
);
