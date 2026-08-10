// ============================================================
// Casa Quest — Jest Configuration
// ============================================================

import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts',
  ],
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    '!src/domain/**/types.ts',
    '!src/domain/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};

export default config;
