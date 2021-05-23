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
  const [parser, _] = newParser(grammar, config);
  const result = parser.parse(input);
  if (config === true || config.debug) {
    // console.log(result?.reprString);
    console.log(util.inspect(result?.debugValue(true) || null, { showHidden: false, depth: null }));
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
    expect(result?.debugValue(false)).toEqual(["E", "  T", "    F", "      id - A"]);
  });

  test("Test A + B * C", () => {
    const result = testParsing(test_grammar, "A+B*C", { type: "slr" });
    expect(result?.debugValue(false)).toEqual([
      "E",
      "  E",
      "    T",
      "      F",
      "        id - A",
      "  plus - +",
      "  T",
      "    T",
      "      F",
      "        id - B",
      "    star - *",
      "    F",
      "      id - C",
    ]);
  });

  test("Test A + B * C + (x * y + z)", () => {
    const result = testParsing(test_grammar, "A+B*C+(x*y+z)", { type: "slr" });
    expect(result?.debugValue(false)).toEqual([
      "E",
      "  E",
      "    E",
      "      T",
      "        F",
      "          id - A",
      "    plus - +",
      "    T",
      "      T",
      "        F",
      "          id - B",
      "      star - *",
      "      F",
      "        id - C",
      "  plus - +",
      "  T",
      "    F",
      "      open - (",
      "      E",
      "        E",
      "          T",
      "            T",
      "              F",
      "                id - x",
      "            star - *",
      "            F",
      "              id - y",
      "        plus - +",
      "        T",
      "          F",
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
      `{
        "name": "Earth",                                                                          
        "age": 4600000000,                                                                        
        "moons": [ "luna" ]
      }`,
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

describe("Auxiliary Symbol Tests", () => {
  const g1 = `
      %token A "a"
      %token B "b"
      %token C "c"
      %skip /[ \\t\\n\\f\\r]+/

      X -> A B* C ;
    `;
  test("Test Zero or More with no B", () => {
    const result = testParsing(g1, "a c");
    expect(result?.debugValue()).toEqual(["X", [["A", "a"], ["$0"], ["C", "c"]]]);
  });

  test("Test Zero or More with error", () => {
    expect(() => testParsing(g2, "a d c")).toThrowError("Invalid character found at offset (3): ' '");
  });

  test("Test Zero or More", () => {
    const result = testParsing(g1, "a b b b b c");
    expect(result?.debugValue()).toEqual([
      "X",
      [
        ["A", "a"],
        [
          "$0",
          [
            [
              "$0",
              [
                [
                  "$0",
                  [
                    ["$0", [["$0"], ["B", "b"]]],
                    ["B", "b"],
                  ],
                ],
                ["B", "b"],
              ],
            ],
            ["B", "b"],
          ],
        ],
        ["C", "c"],
      ],
    ]);
  });

  const g2 = `
      %token A "a"
      %token B "b"
      %token C "c"
      %skip /[ \\t\\n\\f\\r]+/

      X -> A B+ C ;
    `;
  test("Test One or More with Failure", () => {
    expect(() => testParsing(g2, "a c")).toThrowError("Parse Error at (2): Unexpected token at state (1): C ('C')");
  });
  test("Test One or More", () => {
    const result = testParsing(g2, "a b b b b c");
    expect(result?.debugValue()).toEqual([
      "X",
      [
        ["A", "a"],
        [
          "$0",
          [
            [
              "$0",
              [
                [
                  "$0",
                  [
                    ["$0", [["B", "b"]]],
                    ["B", "b"],
                  ],
                ],
                ["B", "b"],
              ],
            ],
            ["B", "b"],
          ],
        ],
        ["C", "c"],
      ],
    ]);
  });
});
