/* eslint-disable no-undef */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    '.venv',
    'coverage',
    'public',
    'vite.config.ts',
    '*.config.js',
    '*.config.cjs',
  ],
  rules: {
    /* React */
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],

    /* TypeScript */
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-empty-function': 'off',

    /* General */
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'warn',
    eqeqeq: ['error', 'smart'],
    'prefer-const': 'warn',
  },
  overrides: [
    {
      files: ['**/*.{test,spec}.{ts,tsx}'],
      env: { jest: true },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
