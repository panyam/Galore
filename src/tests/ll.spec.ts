import * as TLEX from "tlex";
const util = require("util");
import { EBNFParser } from "../ebnf";
import { ParseTable, Parser } from "../ll";
import { PTNode } from "../parser";
import { verifyLLParseTable } from "./utils";
import Samples from "./samples";
import { mockTokenizer } from "./mocks";

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
      S1: { e: ["S1 -> e S"], $end: ["S1 -> "] },
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
        $end: ["E1 -> "],
        CLOSE: ["E1 -> "],
      },
      T: { OPEN: ["T -> F T1"], id: ["T -> F T1"] },
      T1: {
        STAR: ["T1 -> STAR F T1"],
        PLUS: ["T1 -> "],
        $end: ["T1 -> "],
        CLOSE: ["T1 -> "],
      },
      F: { OPEN: ["F -> OPEN E CLOSE"], id: ["F -> id"] },
    });
  });
});

function tok(tag: any, value: any): TLEX.Token {
  const out = new TLEX.Token(tag, 0, 0, 0);
  out.value = value;
  return out;
}

/**
 * Helper to create a grammar, and its parser.
 */
export function newParser(input: string, debug = false): Parser {
  const eparser = new EBNFParser(input);
  const g = eparser.grammar.augmentStartSymbol();
  const parser = new Parser(new ParseTable(g));
  const tokenizer = eparser.generatedTokenizer;
  parser.setTokenizer(tokenizer.next.bind(tokenizer));
  if (debug) {
    console.log(
      "===============================\nGrammar (as default): \n",
      g.debugValue.map((x, i) => `${i + 1}  -   ${x}`),
      "===============================\nGrammar (as Bison): \n",
      g.debugValue.map((x, i) => `${x.replace("->", ":")} ; \n`).join(""),
      "===============================\nParseTable: \n",
      parser.parseTable.debugValue,
    );
    console.log("Prog: \n", `${tokenizer.vm.prog.debugValue().join("\n")}`);
  }
  return parser;
}

describe("Parser Tests", () => {
  test("Tests 1", () => {
    const parser = newParser(Samples.expr2);
    const result = parser.parse("A+B*C");
    expect(result?.debugValue(false)).toEqual([
      "E",
      "  T",
      "    F",
      "      id - A",
      "    T1",
      "  E1",
      "    PLUS - +",
      "    T",
      "      F",
      "        id - B",
      "      T1",
      "        STAR - *",
      "        F",
      "          id - C",
      "        T1",
      "    E1",
    ]);
  });
});
