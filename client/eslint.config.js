import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config({
  extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
  files: ['src/**/*.{ts,tsx}'],
  ignores: ['dist', '.vite-types'],
  plugins: {
    import: importPlugin
  },
  rules: {
    'import/order': [
      'warn',
      {
        groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index']],
        alphabetize: { order: 'asc', caseInsensitive: true }
      }
    ]
  }
});
