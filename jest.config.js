module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-vector-icons|react-native-svg|react-native-modal|react-native-toast-message|react-native-keyboard-aware-scroll-view|react-native-gesture-handler|react-native-reanimated|react-native-permissions|react-native-view-shot|react-native-fs|lucide-react-native)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/?(*.)+(spec|test).(ts|tsx|js)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '/vendor/',
  ],
  modulePathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '/vendor/',
  ],
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  verbose: true,
  testTimeout: 10000,
};
