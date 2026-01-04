# Galore

A toolbox for language analyzers and parser generators in TypeScript.

Galore provides implementations of SLR, LALR, and LR(1) parsing algorithms with a simple grammar DSL. It works in Node.js and browsers with full TypeScript support.

## Documentation

Full documentation and interactive examples: **[panyam.github.io/galore](https://panyam.github.io/galore/)**

Try grammars in the browser: **[Playground](https://panyam.github.io/galore/playground/)**

## Installation

```bash
npm install galore
```

## Quick Example

```typescript
import { newParser } from "galore";

const parser = newParser(`
  %token NUMBER /[0-9]+/

  Expr -> Expr "+" Term | Term ;
  Term -> Term "*" Factor | Factor ;
  Factor -> "(" Expr ")" | NUMBER ;
`, { type: "lalr" });

const result = parser.parse("1 + 2 * 3");
```

## Features

- **Multiple parser types** - SLR, LALR, and LR(1) table generation
- **Grammar DSL** - BNF-style grammar definitions with regex token patterns
- **Parse table visualization** - See shift/reduce tables and LR item sets
- **Conflict detection** - Identifies shift-reduce and reduce-reduce conflicts
- **Semantic actions** - Attach JavaScript actions to grammar rules
- **TypeScript native** - Full type definitions included

## Examples

The documentation includes several runnable examples:

- [Arithmetic expressions](https://panyam.github.io/galore/examples/arithmetic/) - Basic expression parsing with evaluation
- [Calculator](https://panyam.github.io/galore/examples/calculator/) - Multi-statement calculator with variables
- [JSON parser](https://panyam.github.io/galore/examples/json-parser/) - Complete JSON grammar

## License

ISC
