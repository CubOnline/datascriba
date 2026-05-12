// @ts-check
const base = require('./index')

/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...base,
  rules: {
    ...base.rules,
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
  },
}
