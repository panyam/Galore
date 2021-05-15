const util = require("util");
import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { PTNode } from "../parser";
import { mockTokenizer } from "./mocks";
import { Sym } from "../Grammar";
import { newParser } from "../factory";

function tok(tag: any, value: any): TLEX.Token {
  const out = new TLEX.Token(tag, 0, 0, 0);
  out.value = value;
  return out;
}

function testParsing(grammar: string, input: string, config: any = {}): TSU.Nullable<PTNode> {
  const parser = newParser(grammar, config);
  const result = parser.parse(input);
  if (config === true || config.debug) {
    console.log(util.inspect(result?.debugValue || null, { showHidden: false, depth: null }));
  }
  return result;
}

const test_grammar = `
      %token plus "+"
      %token star "*"
      %token open "("
      %token close ")"
      %token id /[A-Za-z]+/
      %skip /[ \\t\\n\\f\\r]+/

      E -> E plus T | T ;
      T -> T star F | F ;
      F -> open E close | id ;
`;

describe("LRParsing Tests", () => {
  test("Test Single ID", () => {
    const result = testParsing(test_grammar, "A", { type: "slr" });
    expect(result?.debugValue(false)).toEqual(["E - null", "  T - null", "    F - null", "      id - A"]);
  });

  test("Test A + B * C", () => {
    const result = testParsing(test_grammar, "A+B*C", { type: "slr" });
    expect(result?.debugValue(false)).toEqual([
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
    const result = testParsing(test_grammar, "A+B*C+(x*y+z)", { type: "slr" });
    expect(result?.debugValue(false)).toEqual([
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
      { type: "slr" },
    );
  });

  test("Test JSON", () => {
    const result = testParsing(
      `
        %token NUMBER /-?\\d+(\\.\\d+)?([eE][+-]?\\d+)?/
        %token STRING /".*?(?<!\\\\)"/
        %skip /[ \\t\\n\\f\\r]+/

        Value -> Dict | List | STRING | NUMBER | "true" | "false" | "null" ;
        List -> "[" [ Value ( "," Value ) * ] "]" ;
        Dict -> "{" [ Pair ("," Pair)* ] "}" ;
        Pair -> STRING ":" Value ;
      `,
      `{"key": ["item0", "item1", 3.14 ] }`,
      // `{ "key" : 3.14 }`,
      // `[ 1 ]`,
      {
        type: "slr",
        grammar: { auxNTPrefix: "_" },
        itemGraph: {
          gotoSymbolSorter2: (s1: Sym, s2: Sym) => {
            const diff = (s1.isTerminal ? 0 : 1) - (s2.isTerminal ? 0 : 1);
            if (diff != 0) return;
            return s1.creationId - s2.creationId;
          },
        },
      },
    );
  });
});
