# Next Steps

## Recently Completed

### Tooling Migration (January 2026)
- Migrated from TSLint to ESLint (TSLint was deprecated)
- Upgraded all dependencies to latest versions:
  - TypeScript 4.x -> 5.9
  - ESLint 7.x -> 9.x (with new flat config format)
  - Jest 27.x -> 29.x
  - Prettier 2.x -> 3.x
  - ts-jest 27.x -> 29.x
- Updated `tsconfig.json` target from ES5 to ES2020
- Migrated ESLint config from `.eslintrc.json` to `eslint.config.mjs` (flat config)
- Updated Jest config to use new ts-jest configuration format

## Known Issues

### Samples Folder
The `samples/` subfolder has import issues - it imports `galore` as an external package rather than using relative paths. This causes test failures in:
- `samples/src/json/tests/small.spec.ts`
- `samples/src/c11/tests/t1.spec.ts`

Consider either:
1. Setting up proper workspace/monorepo configuration
2. Using relative imports in samples
3. Publishing galore and installing it as a dependency

## Future Considerations

- Consider enabling stricter ESLint rules (`@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unused-vars`) and fixing violations
- Evaluate upgrading to Jest 30 when ts-jest adds support
- Review and update the `samples/` folder project structure
