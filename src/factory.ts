import { EBNFParser } from "./ebnf";
import { makeSLRParseTable, makeLRParseTable } from "./ptables";
import { Parser } from "./lr";
import { Str, Grammar, Rule } from "./grammar";
import { logParserDebug } from "./debug";

/**
 * Helper to create a grammar, and its parser.
 */
export function newParser(input: string, config: any = null): Parser {
  const params = config == null || typeof config === "boolean" ? {} : config;
  const debug = config === true || params["debug"] || false;
  params.grammar = params.grammar || {};
  params.itemGraph = params.itemGraph || {};
  params.type = params.type || "slr";
  const ptabType = params.type;
  const g = new Grammar(params.grammar);
  const eparser = new EBNFParser(input, { ...(params.parser || {}), grammar: g });
  g.augmentStartSymbol();
  const ptMaker = ptabType == "lr1" ? makeLRParseTable : makeSLRParseTable;
  const [ptable, ig] = ptMaker(g, params);
  const parser = new Parser(g, ptable, ig);
  if (debug) {
    logParserDebug(parser);
    console.log("Prog: \n", `${eparser.generatedTokenizer.vm.prog.debugValue().join("\n")}`);
  }
  parser.setTokenizer(eparser.generatedTokenizer.next.bind(eparser.generatedTokenizer));
  return parser;
}
