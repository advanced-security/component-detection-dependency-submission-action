/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
    transform: {
      "^.+\\.tsx?$": "ts-jest",
      "^.+\\.[t|j]sx?$": "babel-jest"
    },
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
      "^octokit$": "<rootDir>/node_modules/octokit/dist-bundle/index.js"
      // Removed toolkit mapping for ESM compatibility
    },
    transformIgnorePatterns: [
      "/node_modules/(?!(octokit)/)" // Only octokit is transformed, toolkit is left as ESM
    ],
};