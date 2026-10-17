// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { files: ['scripts/**/*.{js,mjs}', '*.config.js'], languageOptions: { globals: { Buffer: 'readonly', __dirname: 'readonly', process: 'readonly', module: 'readonly', require: 'readonly', console: 'readonly' } } },
  {
    ignores: ["dist/**", ".expo/**", "scripts/.*.tmp.*"],
  }
]);
