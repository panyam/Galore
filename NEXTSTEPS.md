# Next Steps

## Recently Completed

### Documentation Improvements (January 2026)
- Enhanced **Grammar DSL Reference** (`docs/content/reference/grammar-syntax/`)
  - Complete DSL syntax: rules, tokens, directives, EBNF extensions
  - Token directives: `%token`, `%skip`, `%define`, `%start`, `%resyntax`
  - EBNF extensions: `*`, `+`, `?`, `()`, `[]`
  - Comments: `//` and `/* */`
  - Noted: `%left`/`%right`/`%nonassoc` NOT YET IMPLEMENTED

- Created **Semantic Actions** page (`docs/content/reference/semantic-actions/`)
  - Action syntax: `{ $1 }`, `{ functionName }`
  - ParserContext callbacks: `ruleHandlers`, `beforeAddingChildNode`, `onReduction`, `onNextToken`
  - PTNode structure and methods

- Created **API Reference** page (`docs/content/reference/api/`)
  - Entry points: `newParser()`, `newParseTable()`
  - Parser options with TypeScript interface
  - Grammar class API
  - Type definitions

- Created **Tokenization** page (`docs/content/reference/tokenization/`)
  - Brief intro to TLEX integration
  - Basic `%token` and `%skip` usage
  - Link to TLEX repo for advanced features

- Created **Error Handling** page (`docs/content/reference/error-handling/`)
  - `ParseError` class usage
  - Error callbacks: `onTokenError`, `actionResolver`
  - Debug options and troubleshooting

- Enhanced **Parse Tables** page (`docs/content/reference/parse-tables/`)
  - Conflict types: shift-reduce, reduce-reduce
  - Resolution strategies: grammar restructuring, left-factoring
  - LR item set debugging

- Added **CodeBlock component** with copy button
  - `docs/components/CodeBlock.ts` - Adds copy functionality to code blocks
  - CSS styling in `docs/static/css/components/content.css`
  - Auto-initialized on all documentation pages

- Improved **source file JSDoc comments**
  - `src/factory.ts` - Added ParserOptions interface with full documentation
  - `src/errors.ts` - Enhanced ParseError documentation
  - Exported ParserOptions from index.ts

### Editable Action Code (January 2026)
- Added editable JavaScript action code to both PlaygroundPage and ExampleRunner
- Created shared `ActionCompiler` module (`docs/components/ActionCompiler.ts`) for:
  - Compiling user-provided JavaScript using `new Function('node', code)`
  - Compile-time error detection with Ace Editor line markers
  - Runtime error detection with line numbers
  - Status indicator (✓ success / ✗ error)
- PlaygroundPage enhancements:
  - Added "Actions" panel (tabbed with Input)
  - Auto-runs action after parsing
  - Persists action code per grammar when switching
  - Results displayed in Console with proper newline formatting
- ExampleRunner enhancements:
  - Action editor now editable (was read-only)
  - Uses compiled action when code is modified, falls back to config.actionFn
  - Shows compile/runtime errors with line information
- Added `actionCode` field to `BuiltinGrammar` interface in `configs.ts`
- Calculator grammar updated:
  - Added semicolon statement delimiters for conflict-free parsing
  - Action code evaluates and formats as "stmt → result" per line
- Simplified calculator example page to use shared action code from configs

### Playground Parse Table Enhancements (January 2026)
- Added LR item hints to parse table states (like yacc/bison output)
  - Each state header shows state number + first LR item (e.g., "0: $accept -> • Program")
  - Full item list shown as tooltip on hover
- Added conflict highlighting in parse table
  - Cells with multiple actions (shift/reduce or reduce/reduce) highlighted in amber
  - State header cells with any conflicts also highlighted with amber background
- Added example grammars with known conflicts:
  - "Dangling Else" - Classic shift-reduce conflict
  - "Ambiguous Expr" - Shift-reduce from missing precedence
- Fixed Calculator grammar shift-reduce conflict by factoring: `Atom -> ID AtomTail`
- Enhanced `parseTableToHtml` in `src/printers.ts` to accept `itemGraph` config

### Documentation Site Migration (January 2026)
- Created new `docs/` folder using s3gen static site generator
- Replaced Gatsby/Hugo-based galorium with s3gen-based docs site
- Key features:
  - **s3gen v0.1.3** - Go-based static site generator
  - **DockView** - Modern dockable panel layout for playground
  - **Ace Editor** - Code editing for grammar and input
  - **TypeScript + Webpack** - Component bundling with two entry points
- Created templates: BasePage, Header, Sidebar, Content, Footer
- Ported playground components to standalone TypeScript (no React)
- Created GrammarSandbox component for embedding examples in docs
- Full light/dark theme support with CSS custom properties
- Build commands:
  - `cd docs && pnpm build` - Build webpack bundles
  - `cd docs && go run .` - Run dev server on :8085
  - `cd docs && make gh-pages` - Deploy to GitHub Pages

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
