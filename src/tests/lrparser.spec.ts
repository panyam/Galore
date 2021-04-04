const util = require("util");
import { Grammar } from "../grammar";
import { EBNFParser } from "../ebnf";
import { PTNode } from "../parser";
import { Token } from "../tokenizer";
import { MockTokenizer } from "./mocks";
import { Parser, LRItemGraph, LR0ItemGraph, LR1ItemGraph } from "../lr";
import { makeSLRParseTable, makeLRParseTable } from "../ptables";

function tok(tag: any, value: any): Token {
  return new Token(tag, { value: value });
}

function newParser(input: string, ptabType = "slr", debug = false): Parser {
  const g = new EBNFParser(input).grammar.augmentStartSymbol();
  const ptMaker = ptabType == "lr1" ? makeLRParseTable : makeSLRParseTable;
  const [ptable, ig] = ptMaker(g);
  if (debug) {
    console.log("===============================\nItemGraph: \n", ig.debugValue);
    console.log("===============================\nParseTable: \n", ptable.debugValue);
    console.log("===============================\nConflict States: \n", ptable.conflictActions);
  }
  return new Parser(g, ptable, ig);
}

describe("LRParsing Tests", () => {
  test("Test SLR Grammar", () => {
    const parser = newParser(
      `
      E -> E plus T | T ;
      T -> T star F | F ;
      F -> open E close | id ;
      `,
      "slr",
      true,
    );

    const tokenizer = new MockTokenizer(tok("id", "A"));
    parser.setTokenizer(tokenizer);
    // new MockTokenizer(tok("id", "A"), tok("PLUS", "+"), tok("id", "B"), tok("STAR", "*"), tok("id", "C")),

    const result = parser.parse();
    expect(result?.debugValue).toEqual({
      sym: "E",
      children: [
        {
          sym: "T",
          children: [{ sym: "F", children: [{ sym: "id", value: "A" }] }],
        },
      ],
    });
    // console.log(util.inspect(result?.debugValue || null, { showHidden: false, depth: null }));
  });
  test("Test 1", () => {
    const parser = newParser(
      `
        stmt -> if expr then stmt else stmt
         | if expr then stmt
         | expr QMARK stmt stmt
         | arr OSQ expr CSQ ASGN  expr
         ;
        expr -> num | expr PLUS  expr ;
        num -> DIGIT | num DIGIT ;
      `,
      "slr",
    );
  });
});
