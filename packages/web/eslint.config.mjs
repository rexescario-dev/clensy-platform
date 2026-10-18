// @ts-check
import { contextforgeJavascript } from '../../tooling/eslint.contextforge.mjs';
import eslint from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**'] },
  ...contextforgeJavascript({ eslint, tseslint }),
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['src/i18n/messages/**/*.{ts,tsx}'],
    rules: {
      'contextforge/record-key-order': 'off',
      'sort-keys': [
        'error',
        'asc',
        {
          allowLineSeparatedGroups: true,
          caseSensitive: true,
          minKeys: 2,
          natural: false,
        },
      ],
    },
  },
);
