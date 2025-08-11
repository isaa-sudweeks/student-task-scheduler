/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [
    'next',
    'next/core-web-vitals',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    tsconfigRootDir: __dirname,
  },
  env: {
    node: true,
    es2022: true,
    browser: true,
  },
  settings: {
    next: {
      rootDir: ['.'],
    },
  },
  rules: {
    // Keep rules minimal; rely on Next.js defaults
    'no-unused-vars': 'off', // handled by TypeScript
    '@next/next/no-html-link-for-pages': 'off', // using App Router
  },
  overrides: [
    {
      files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
      env: { browser: true, node: true },
      globals: {
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
      },
    },
  ],
};

