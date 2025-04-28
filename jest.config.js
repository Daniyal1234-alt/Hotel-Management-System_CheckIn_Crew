// jest.config.js
module.exports = {
    testEnvironment: 'node',
    collectCoverage: true,
    coverageReporters: ['text', 'html', 'lcov'],
    collectCoverageFrom: [
      'routes/**/*.js',
      'controllers/**/*.js',
      'models/**/*.js',
      'middleware/**/*.js',
      'utils/**/*.js',
      '!node_modules/**',
      '!coverage/**'
    ],
    coverageThreshold: {
      global: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70
      }
    },
    verbose: true
  };