module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [
      './tsconfig.json',
    ],
  },
  extends: [
    'standard',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: [
    '@typescript-eslint',
  ],
  // add your custom rules here
  'rules': {
    // allow paren-less arrow functions
    'arrow-parens': 0,
    // allow async-await
    'generator-star-spacing': 0,
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
    // trailing comma
    'comma-dangle': ['error', 'always-multiline'],
    // ts-ignore
    '@typescript-eslint/ban-ts-ignore': 1,
    '@typescript-eslint/ban-ts-comment': 1,
    // semis
    '@typescript-eslint/member-delimiter-style': [2, {
      multiline: { delimiter: 'none' },
      singleline: { delimiter: 'comma' },
    }],
    // require
    '@typescript-eslint/no-var-requires': 0,
    // other
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/no-use-before-define': 0,
    '@typescript-eslint/camelcase': 0,
  },
}
