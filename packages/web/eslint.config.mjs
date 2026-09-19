// @ts-check
import { contextforgeJavascript } from '../../tooling/eslint.contextforge.mjs';
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**'] },
  ...contextforgeJavascript({ eslint, tseslint }),
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
);
