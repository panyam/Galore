const util = require("util");
import { EBNFParser } from "../ebnf";
import { ParseTable, Parser } from "../ll";
import { PTNode } from "../parser";
import { Token } from "../tokenizer";
import { verifyLLParseTable } from "./utils";
import Samples from "./samples";
import { MockTokenizer } from "./mocks";

describe("ParseTable Tests", () => {
  test("Tests 1", () => {
    const g = new EBNFParser(`
      S -> i E t S S1 | a;
      S1 -> e S | ;
      E -> b ;
    `).grammar;

    const ns = g.nullables;
    const fs = g.firstSets;
    // expectFSEntries(g, fs, { S: ["i", "a"], S1: ["e", ""], E: ["b"], });
    // const fls = g.followSets;
    // expectFSEntries(g, fls, { S: ["e", g.Eof.label], S1: ["e", g.Eof.label], E: ["t"], });
    verifyLLParseTable("Tests1", g, {
      S: { i: ["S -> i E t S S1"], a: ["S -> a"] },
      S1: { e: ["S1 -> e S"], "<EOF>": ["S1 -> "] },
      E: { b: ["E -> b"] },
    });
  });

  test("Tests 2", () => {
    const g = new EBNFParser(Samples.expr2).grammar;

    const ns = g.nullables;
    const fs = g.firstSets;
    const fls = g.followSets;
    verifyLLParseTable("Tests2", g, {
      E: { OPEN: ["E -> T E1"], id: ["E -> T E1"] },
      E1: {
        PLUS: ["E1 -> PLUS T E1"],
        "<EOF>": ["E1 -> "],
        CLOSE: ["E1 -> "],
      },
      T: { OPEN: ["T -> F T1"], id: ["T -> F T1"] },
      T1: {
        STAR: ["T1 -> STAR F T1"],
        PLUS: ["T1 -> "],
        "<EOF>": ["T1 -> "],
        CLOSE: ["T1 -> "],
      },
      F: { OPEN: ["F -> OPEN E CLOSE"], id: ["F -> id"] },
    });
  });
});

function tok(tag: any, value: any): Token {
  return new Token(tag, { value: value });
}

describe("Parser Tests", () => {
  test("Tests 1", () => {
    const g = new EBNFParser(Samples.expr2).grammar;

    const tokenizer = new MockTokenizer(
      tok("id", "A"),
      tok("PLUS", "+"),
      tok("id", "B"),
      tok("STAR", "*"),
      tok("id", "C"),
    );
    const parser = new Parser(g).setTokenizer(tokenizer);
    const result = parser.parse();
    console.log(util.inspect(result?.debugValue || null, { showHidden: false, depth: null }));
    expect(result?.debugValue).toEqual([
      "E",
      [
        ["T", [["F", [["id", "A"]]], ["T1"]]],
        [
          "E1",
          [
            ["PLUS", "+"],
            [
              "T",
              [
                ["F", [["id", "B"]]],
                ["T1", [["STAR", "*"], ["F", [["id", "C"]]], ["T1"]]],
              ],
            ],
            ["E1"],
          ],
        ],
      ],
    ]);
  });
});
