/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest/presets/js-with-ts-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  roots: ["<rootDir>/test"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "test/tsconfig.json",
      },
    ],
  },
  moduleNameMapper: {
    "^(\.\.?\/.+)\.js$": "$1",
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};
