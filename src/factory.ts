import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { load as loadGrammar } from "./dsl";
import { newParseTable } from "./ptables";
import { Parser } from "./lr";
import { logParserDebug } from "./debug";

/**
 * Helper to create a grammar, and its parser.
 */
export function newParser(input: string, params: any = null): [Parser, TSU.Nullable<TLEX.NextTokenFunc>] {
  params = params || {};
  const [g, tokenFunc] = loadGrammar(input, params);
  g.augmentStartSymbol();
  const ptable = newParseTable(g, params.type);
  const parser = new Parser(ptable);
  if (params.tokenizer || tokenFunc) {
    parser.setTokenizer(params.tokenizer || tokenFunc);
  }
  if (params.debug) {
    logParserDebug(parser);
  }
  return [parser, tokenFunc];
}
