module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'src/types/database.ts'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // Rule 1: No @supabase/* outside src/lib
      files: ['src/**'],
      excludedFiles: ['src/lib/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@/lib/api',
                message: 'Direct imports from api.ts are forbidden. Import from @/lib/apiClient instead.',
              },
              {
                name: '@/lib/api.mock',
                message: 'Direct imports from api.mock.ts are forbidden. Import from @/lib/apiClient instead.',
              },
            ],
            patterns: [
              {
                group: ['@supabase/*'],
                message:
                  'Direct imports from @supabase/* are forbidden outside src/lib. Builders must import exclusively from @/lib/apiClient.',
              },
              {
                group: ['*/lib/api', '*/lib/api.mock', '**/lib/api', '**/lib/api.mock', '../*/api', '../lib/api', '../../lib/api'],
                message:
                  'Direct imports from api.ts or api.mock.ts are forbidden. Import from @/lib/apiClient instead.',
              },
            ],
          },
        ],
      },
    },
    {
      // Rule 2: api.mock.ts may import from ./api (re-exports mapError/newClientId)
      files: ['src/lib/api.mock.ts'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
};
