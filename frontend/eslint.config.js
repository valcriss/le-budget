const js = require('@eslint/js');
const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const testingGlobals = {
  describe: 'readonly',
  it: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  jasmine: 'readonly',
  spyOn: 'readonly',
};

const legacyConfigs = compat.config(require('./.eslintrc.json')).map((config) => {
  if (config.languageOptions && config.languageOptions.parserOptions) {
    config.languageOptions = {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions.parserOptions,
        project: ['./tsconfig.app.json', './tsconfig.spec.json'],
        tsconfigRootDir: __dirname,
      },
    };
  }
  return config;
});

module.exports = [
  {
    ignores: [
      'projects/**/*',
      '**/*.html',
      'node_modules',
      'dist',
      'build',
      '.vscode',
      '**/*.d.ts',
      'src/app/components/budget/**/*',
      'src/app/components/ui/**/*',
      'src/app/shared/formatters.ts',
      'src/app/pages/budget-page/**/*',
    ],
  },
  ...legacyConfigs,
  {
    files: ['**/*.spec.ts'],
    languageOptions: {
      globals: testingGlobals,
    },
  },
];
