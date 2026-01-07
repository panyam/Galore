import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { load as loadGrammar, TokenHandler } from "./dsl";
import { makeParseTable } from "./ptables";
import { Parser, ParseTable } from "./lr";
import { LRItemGraph } from "./lritems";
import { logParserDebug } from "./debug";

/**
 * Configuration options for creating a parser.
 */
export interface ParserOptions {
  /**
   * Parser algorithm to use.
   * - "slr": Simple LR - smallest tables, may have false conflicts
   * - "lalr": Look-Ahead LR - default, good balance of power and size
   * - "lr1": Canonical LR(1) - most powerful, largest tables
   * @default "lalr"
   */
  type?: "slr" | "lalr" | "lr1";

  /**
   * Custom tokenizer function. If not provided, one is auto-generated
   * from %token and inline token definitions in the grammar.
   */
  tokenizer?: TLEX.NextTokenFunc;

  /**
   * Enable debug output.
   * - "lexer": Log tokenizer program
   * - "parser": Log parse table and state transitions
   * - "all": Log both lexer and parser
   */
  debug?: "all" | "lexer" | "parser" | string;

  /**
   * Use left recursion for EBNF expansions (*, +).
   * @default true
   */
  leftRecursive?: boolean;

  /**
   * Prefix for auxiliary non-terminals created by EBNF expansions.
   * @default "$"
   */
  auxNTPrefix?: string;

  /**
   * Custom token handlers for post-processing tokens.
   */
  tokenHandlers?: TSU.StringMap<TokenHandler>;
}

/**
 * Creates a parser from a grammar DSL string.
 *
 * This is the main entry point for creating parsers in Galore.
 *
 * @param input - Grammar definition in DSL format
 * @param params - Configuration options
 * @returns A tuple of [parser, tokenFunc, itemGraph]
 *   - parser: The LR parser instance
 *   - tokenFunc: The generated tokenizer (or null if custom provided)
 *   - itemGraph: The LR item graph (useful for debugging)
 *
 * @example
 * ```typescript
 * import { newParser } from "galore";
 *
 * const [parser, tokenFunc, itemGraph] = newParser(`
 *   %token NUMBER /[0-9]+/
 *   %skip /[ \\t\\n]+/
 *
 *   Expr -> Expr "+" Term | Term ;
 *   Term -> NUMBER ;
 * `, { type: "lalr" });
 *
 * const result = parser.parse("1 + 2");
 * ```
 */
export function newLRParser(
  input: string,
  params: ParserOptions | null = null,
): [Parser, null | TLEX.NextTokenFunc, LRItemGraph] {
  const options = params || ({} as ParserOptions);
  const [ptable, tokenFunc, itemGraph] = newParseTable(input, options);
  const parser = new Parser(ptable);
  if (options.tokenizer || tokenFunc) {
    parser.setTokenizer(options.tokenizer || tokenFunc!);
  }
  const debug = options.debug || "";
  if (debug.split("|").findIndex((p: string) => p == "all" || p == "parser") >= 0) {
    logParserDebug(parser, itemGraph);
  }
  return [parser, tokenFunc, itemGraph];
}

/**
 * Creates a parse table from a grammar DSL string without creating a parser.
 *
 * Useful when you need access to the parse table for analysis or visualization.
 *
 * @param input - Grammar definition in DSL format
 * @param params - Configuration options
 * @returns A tuple of [parseTable, tokenFunc, itemGraph]
 *
 * @example
 * ```typescript
 * import { newParseTable, Printers } from "galore";
 *
 * const [ptable, tokenFunc, itemGraph] = newParseTable(grammar, { type: "lalr" });
 *
 * // Check for conflicts
 * if (ptable.hasConflicts) {
 *   console.log("Conflicts:", ptable.conflictActions);
 * }
 *
 * // Visualize the parse table
 * const html = Printers.parseTableToHtml(ptable, { itemGraph });
 * ```
 */
export function newParseTable(
  input: string,
  params: ParserOptions | null = null,
): [ParseTable, null | TLEX.NextTokenFunc, LRItemGraph] {
  const options = params || ({} as ParserOptions);
  const [g, tokenFunc] = loadGrammar(input, options as any);
  g.augmentStartSymbol();
  const [ptable, itemGraph] = makeParseTable(g, options.type);
  return [ptable, tokenFunc, itemGraph];
}
