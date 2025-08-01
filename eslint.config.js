// eslint.config.js for ESLint v9+ (flat config)
import js from '@eslint/js';
const { configs } = js;

export default [
  {
    ...configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  {
    ignores: [
      'dist/',
      'ado-dist/',
      'coverage/',
      'output.json',
      '*.d.ts',
      'node_modules/',
    ],
  },
];
