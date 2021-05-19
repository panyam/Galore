import { EBNFParser } from "./ebnf";
import { makeSLRParseTable, makeLRParseTable } from "./ptables";
import { Parser } from "./lr";
import { Grammar } from "./grammar";
import { logParserDebug } from "./debug";

/**
 * Helper to create a grammar, and its parser.
 */
export function newParser(input: string, params: any = null): Parser {
  if (typeof params === "boolean") throw new Error("Config must be a dict");
  const parserParams = { ...params };
  // remove all non parser params from them
  delete parserParams["grammarLoader"];
  delete parserParams["ptableMaker"];
  delete parserParams["ebnfLoader"];
  delete parserParams["type"];
  delete parserParams["debug"];
  delete parserParams["tokenizer"];
  const parser = params.builder ? params.builder(parserParams) : new Parser(parserParams || {});

  let g: Grammar;
  if (params.grammarLoader) {
    g = params.grammarLoader(input, parser);
    parser.setGrammar(g);
  } else {
    g = new Grammar(params.grammar || {});
    let eparser: EBNFParser;
    const ebnfParser = params.ebnfParser;
    if (ebnfParser && typeof ebnfParser === "function") {
      eparser = params.ebnfParser(input, g);
    } else {
      eparser = new EBNFParser(input, { ...(ebnfParser || {}), grammar: g });
    }
    g.augmentStartSymbol();
    parser.setGrammar(g).setTokenizer(eparser.generatedTokenizer.next.bind(eparser.generatedTokenizer));
    if (params.debug) {
      console.log("Prog: \n", `${eparser.generatedTokenizer.vm.prog.debugValue().join("\n")}`);
    }
  }

  if (params.tokenizer) {
    parser.setTokenizer(params.tokenizer);
  }

  if (params.ptableMaker) {
    const [ptable, ig] = params.ptableMaker(g);
    parser.initialize(ptable, ig);
  } else {
    const ptMaker = params.type == "lr1" ? makeLRParseTable : makeSLRParseTable;
    const [ptable, ig] = ptMaker(g, params.itemGraph || {});
    parser.initialize(ptable, ig);
  }
  if (params.debug) {
    logParserDebug(parser);
  }
  return parser;
}
