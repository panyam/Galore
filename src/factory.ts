import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { EBNFParser } from "./ebnf";
import { makeSLRParseTable, makeLRParseTable } from "./ptables";
import { ParseTable, Parser } from "./lr";
import { Grammar } from "./grammar";
import { logParserDebug } from "./debug";

function loadGrammar(input: string, params: any = {}): [Grammar, null | TLEX.NextTokenFunc] {
  const g = new Grammar(params.grammar || {});
  const eparser = new EBNFParser(input, { ...params, grammar: g });
  g.augmentStartSymbol();
  const tokenFunc = eparser.generatedTokenizer.next.bind(eparser.generatedTokenizer);
  if (params.debug) {
    console.log("Prog: \n", `${eparser.generatedTokenizer.vm.prog.debugValue().join("\n")}`);
  }
  return [g, tokenFunc];
}

export function genParseTable(g: Grammar, type = "lr1"): ParseTable {
  const ptMaker = type == "lr1" ? makeLRParseTable : makeSLRParseTable;
  return ptMaker(g);
}

/**
 * Helper to create a grammar, and its parser.
 */
export function newParser(input: string, params: any = null): [Parser, TSU.Nullable<TLEX.NextTokenFunc>] {
  const [g, tokenFunc] = loadGrammar(input, params);
  const ptable = genParseTable(g, params.type);
  const parser = new Parser(ptable);
  if (params.tokenizer || tokenFunc) {
    parser.setTokenizer(params.tokenizer || tokenFunc);
  }
  if (params.debug) {
    logParserDebug(parser);
  }
  return [parser, tokenFunc];
}
