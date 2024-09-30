/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
    transform: {
      "^.+\\.tsx?$": "ts-jest",
      "^.+\\.[t|j]sx?$": "babel-jest", // Use Babel for transforming JS and TS files
      "^.+\\.mjs$": "jest-transform-stub",  // Use the stub to handle ES modules
    },
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
      "^octokit$": "<rootDir>/node_modules/octokit/dist-bundle/index.js",
      "^@github/dependency-submission-toolkit$": "<rootDir>/node_modules/@github/dependency-submission-toolkit/dist/index.js",
    },
    extensionsToTreatAsEsm: [".ts"],
    transformIgnorePatterns: ["/node_modules/(?!(octokit|\\@github\\/dependency-submission-toolkit)/)"],  // Ensure octokit and @github/dependency-submission-toolkit are transformed
    globals: {
      "ts-jest": {
        useESM: true,
      },
    },
  };