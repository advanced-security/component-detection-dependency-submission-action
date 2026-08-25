export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['babel-jest', { configFile: './babel.config.js' }]
  },
  moduleNameMapper: {},
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testMatch: ['**/*.test.ts'],
  // Several tests download the component-detection CLI release and run a full
  // scan, so they need a timeout that tolerates slow network on CI runners.
  testTimeout: 60000,
  resolver: undefined,
};