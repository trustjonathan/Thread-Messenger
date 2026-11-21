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
      files: ['src/**'],
      excludedFiles: ['src/lib/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@supabase/*'],
                message:
                  'Direct imports from @supabase/* are forbidden outside src/lib. Builders must import exclusively from @/lib/apiClient.',
              },
            ],
          },
        ],
      },
    },
  ],
};
