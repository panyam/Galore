const util = require("util");
import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { PTNode } from "../parser";
import { mockTokenizer } from "./mocks";
import { newParser } from "./utils";

function tok(tag: any, value: any): TLEX.Token {
  const out = new TLEX.Token(tag, 0, 0, 0);
  out.value = value;
  return out;
}

function testParsing(ptabType: string, grammar: string, input: string, debug = false): TSU.Nullable<PTNode> {
  const parser = newParser(grammar, ptabType, debug);
  const result = parser.parse(input);
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
      "A",
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
      "A+B*C",
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
      "A+B*C+(x*y+z)",
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
