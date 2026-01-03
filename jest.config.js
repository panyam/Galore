// const { pathsToModuleNameMapper } = require("ts-jest/utils");
// const { compilerOptions } = require("./tsconfig");

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/.*",
    "<rootDir>/dist/.*",
    "<rootDir>/tests/samples.ts",
    "<rootDir>/tests/mocks.ts",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  transform: {
    "^.+\\.jsx?$": "babel-jest",
    "^.+\\.(ts|tsx)?$": ["ts-jest", { tsconfig: "./tsconfig.json" }],
  },
  moduleDirectories: ["node_modules", "src"],
};
