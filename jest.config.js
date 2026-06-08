/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^p-retry$': '<rootDir>/src/__tests__/__mocks__/p-retry.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  collectCoverageFrom: [
    'src/lib/wisdom-engine.ts',
    'src/lib/services/ai-vision-service.ts',
    'src/lib/audit.ts',
  ],
  coverageThreshold: {
    'src/lib/wisdom-engine.ts': {
      statements: 30,
      branches: 10,
      functions: 35,
      lines: 30,
    },
    'src/lib/services/ai-vision-service.ts': {
      statements: 45,
      branches: 20,
      functions: 50,
      lines: 45,
    },
    'src/lib/audit.ts': {
      statements: 35,
      branches: 10,
      functions: 50,
      lines: 35,
    },
  },
};
