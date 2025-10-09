module.exports = {
  preset: 'ts-jest',

  testEnvironment: 'node',

  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
    '<rootDir>/test/integration/pg-mem/*.spec.ts',
  ],

  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
};
