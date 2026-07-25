/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverage: false,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/models/**',
    '!src/routes/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@whiskeysockets/baileys$': '<rootDir>/src/__mocks__/@whiskeysockets/baileys.js',
    '^https-proxy-agent$': '<rootDir>/src/__mocks__/https-proxy-agent.js',
  }
};
