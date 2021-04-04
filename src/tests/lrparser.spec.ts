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
    expect(result?.debugValue).toEqual(["E", [["T", [["F", [["id", "A"]]]]]]]);
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
      "E",
      [
        ["E", [["T", [["F", [["id", "A"]]]]]]],
        ["plus", "+"],
        [
          "T",
          [
            ["T", [["F", [["id", "B"]]]]],
            ["star", "*"],
            ["F", [["id", "C"]]],
          ],
        ],
      ],
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
      "E",
      [
        [
          "E",
          [
            ["E", [["T", [["F", [["id", "A"]]]]]]],
            ["plus", "+"],
            [
              "T",
              [
                ["T", [["F", [["id", "B"]]]]],
                ["star", "*"],
                ["F", [["id", "C"]]],
              ],
            ],
          ],
        ],
        ["plus", "+"],
        [
          "T",
          [
            [
              "F",
              [
                ["open", "("],
                [
                  "E",
                  [
                    [
                      "E",
                      [
                        [
                          "T",
                          [
                            ["T", [["F", [["id", "x"]]]]],
                            ["star", "*"],
                            ["F", [["id", "y"]]],
                          ],
                        ],
                      ],
                    ],
                    ["plus", "+"],
                    ["T", [["F", [["id", "z"]]]]],
                  ],
                ],
                ["close", ")"],
              ],
            ],
          ],
        ],
      ],
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
