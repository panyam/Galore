const util = require("util");
import * as TSU from "@panyam/tsutils";
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
  const g = new EBNFParser(input).grammar.augmentStartSymbol("Start");
  const ptMaker = ptabType == "lr1" ? makeLRParseTable : makeSLRParseTable;
  const [ptable, ig] = ptMaker(g);
  if (debug) {
    console.log("===============================\nItemGraph: \n", ig.debugValue);
    console.log("===============================\nParseTable: \n", ptable.debugValue);
    console.log("===============================\nConflict States: \n", ptable.conflictActions);
  }
  return new Parser(g, ptable, ig);
}

function testParsing(ptabType: string, grammar: string, tokens: Token[], debug = false): TSU.Nullable<PTNode> {
  const parser = newParser(grammar, ptabType, debug);
  parser.setTokenizer(new MockTokenizer(...tokens));
  const result = parser.parse();
  if (debug) {
    console.log(util.inspect(result?.debugValue || null, { showHidden: false, depth: null }));
  }
  return result;
}

describe("LRParsing Tests", () => {
  test("Test Single ID", () => {
    const result = testParsing(
      "slr",
      `
      E -> E plus T | T ;
      T -> T star F | F ;
      F -> open E close | id ;
      `,
      [tok("id", "A")],
    );
    expect(result?.debugValue).toEqual(["E - null", "  T - null", "    F - null", "      id - A"]);
  });

  test("Test A + B * C", () => {
    const result = testParsing(
      "slr",
      `
      E -> E plus T | T ;
      T -> T star F | F ;
      F -> open E close | id ;
      `,
      [tok("id", "A"), tok("plus", "+"), tok("id", "B"), tok("star", "*"), tok("id", "C")],
    );
    expect(result?.debugValue).toEqual([
      "E - null",
      "  E - null",
      "    T - null",
      "      F - null",
      "        id - A",
      "  plus - +",
      "  T - null",
      "    T - null",
      "      F - null",
      "        id - B",
      "    star - *",
      "    F - null",
      "      id - C",
    ]);
  });

  test("Test A + B * C + (x * y + z)", () => {
    const result = testParsing(
      "slr",
      `
      E -> E plus T | T ;
      T -> T star F | F ;
      F -> open E close | id ;
      `,
      [
        tok("id", "A"),
        tok("plus", "+"),
        tok("id", "B"),
        tok("star", "*"),
        tok("id", "C"),
        tok("plus", "+"),
        tok("open", "("),
        tok("id", "x"),
        tok("star", "*"),
        tok("id", "y"),
        tok("plus", "+"),
        tok("id", "z"),
        tok("close", ")"),
      ],
    );
    expect(result?.debugValue).toEqual([
      "E - null",
      "  E - null",
      "    E - null",
      "      T - null",
      "        F - null",
      "          id - A",
      "    plus - +",
      "    T - null",
      "      T - null",
      "        F - null",
      "          id - B",
      "      star - *",
      "      F - null",
      "        id - C",
      "  plus - +",
      "  T - null",
      "    F - null",
      "      open - (",
      "      E - null",
      "        E - null",
      "          T - null",
      "            T - null",
      "              F - null",
      "                id - x",
      "            star - *",
      "            F - null",
      "              id - y",
      "        plus - +",
      "        T - null",
      "          F - null",
      "            id - z",
      "      close - )",
    ]);
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

describe("Non Amgiguous Grammar without Conflicts", () => {
  test("Test1", () => {
    const parser = newParser(
      `
        S -> S A ;
        S -> ;

        A -> X ;
        A -> b X ;
        A -> c X ;

        X -> X x ;
        X -> ;
        `,
      "slr",
      true,
    );
  });
});
