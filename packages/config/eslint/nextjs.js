import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { FlatCompat } from '@eslint/eslintrc';
import globals from 'globals';

import base from './base.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  ...base,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // import/order конфликтует с next/core-web-vitals — отключаем для Next.js проектов
      'import/order': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
