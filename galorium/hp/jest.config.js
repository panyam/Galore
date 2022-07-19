module.exports = {
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.json',
    },
  },
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/.*',
    '<rootDir>/dist/.*',
    '<rootDir>/tests/samples.ts',
    '<rootDir>/tests/mocks.ts',
  ],
  moduleFileExtensions: [
    'js',
    'json',
    'jsx',
    'node',
    'ts',
    'tsx',
  ],
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
  },
  moduleDirectories: [
    'node_modules',
    'src',
  ],
}
