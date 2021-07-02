import * as TLEX from "tlex";
import { load as loadGrammar } from "./dsl";
import { makeParseTable } from "./ptables";
import { Parser, ParseTable } from "./lr";
import { LRItemGraph } from "./lritems";
import { logParserDebug } from "./debug";

/**
 * Helper to create a grammar, and its parser.
 */
export function newLRParser(input: string, params: any = null): [Parser, null | TLEX.NextTokenFunc, LRItemGraph] {
  const [ptable, tokenFunc, itemGraph] = newParseTable(input, params);
  const parser = new Parser(ptable);
  if (params.tokenizer || tokenFunc) {
    parser.setTokenizer(params.tokenizer || tokenFunc);
  }
  const debug = params.debug || "";
  if (debug.split("|").findIndex((p: string) => p == "all" || p == "parser") >= 0) {
    logParserDebug(parser, itemGraph);
  }
  return [parser, tokenFunc, itemGraph];
}

export function newParseTable(input: string, params: any = null): [ParseTable, null | TLEX.NextTokenFunc, LRItemGraph] {
  params = params || {};
  const [g, tokenFunc] = loadGrammar(input, params);
  g.augmentStartSymbol();
  const [ptable, itemGraph] = makeParseTable(g, params.type);
  return [ptable, tokenFunc, itemGraph];
}
