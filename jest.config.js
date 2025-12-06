module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!jest.config.js',
    '!coverage/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  setupFiles: ['<rootDir>/tests/setup.js'],
  maxWorkers: 1 // Run tests serially to avoid database conflicts
};
