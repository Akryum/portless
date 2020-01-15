/** @type {import('@jest/types').Config.ProjectConfig} */
module.exports = {
  rootDir: __dirname,
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests',
  ],
  moduleFileExtensions: [
    'ts',
    'js',
  ],
  testMatch: [
    '<rootDir>/tests/**/*.spec.ts',
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testEnvironment: 'node',
}
