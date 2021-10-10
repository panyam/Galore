/**
 * @jest-environment jsdom
 */
import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { PTNode } from "../parser";
import { Sym, Rule } from "../Grammar";
import { newLRParser as newParser } from "../factory";
import { ParseError } from "../errors";

function tok(tag: any, value: any): TLEX.Token {
  const out = new TLEX.Token(tag, 0, 0, 0);
  out.value = value;
  return out;
}

function testParsing(grammar: string, input: string, config: any = {}): TSU.Nullable<PTNode> {
  const [parser, _] = newParser(grammar, config);
  const result = parser.parse(input, config);
  if (config === true || config.debug) {
    // console.log(result?.reprString);
    console.log(JSON.stringify(result?.debugValue(true) || null, null, 4));
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
    expect(result?.debugValue()).toEqual(["E", "A", [["T", "A", [["F", "A", [["id", "A"]]]]]]]);
  });

  test("Test A + B * C", () => {
    const result = testParsing(test_grammar, "A+B*C", { type: "slr" });
    expect(result?.debugValue()).toEqual([
      "E",
      [
        ["E", "A", [["T", "A", [["F", "A", [["id", "A"]]]]]]],
        ["plus", "+"],
        [
          "T",
          [
            ["T", "B", [["F", "B", [["id", "B"]]]]],
            ["star", "*"],
            ["F", "C", [["id", "C"]]],
          ],
        ],
      ],
    ]);
  });

  test("Test A + B * C + (x * y + z)", () => {
    const result = testParsing(test_grammar, "A+B*C+(x*y+z)", { type: "slr" });
    expect(result?.debugValue()).toEqual([
      "E",
      [
        [
          "E",
          [
            ["E", "A", [["T", "A", [["F", "A", [["id", "A"]]]]]]],
            ["plus", "+"],
            [
              "T",
              [
                ["T", "B", [["F", "B", [["id", "B"]]]]],
                ["star", "*"],
                ["F", "C", [["id", "C"]]],
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
                            ["T", "x", [["F", "x", [["id", "x"]]]]],
                            ["star", "*"],
                            ["F", "y", [["id", "y"]]],
                          ],
                        ],
                      ],
                    ],
                    ["plus", "+"],
                    ["T", "z", [["F", "z", [["id", "z"]]]]],
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
    expect(() => testParsing(g2, "a d c")).toThrowError("Unexpected character ('d')");
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
    try {
      testParsing(g2, "a c");
      fail("Should not be here");
    } catch (e) {
      const err = e as ParseError;
      expect(err.message).toEqual("ParseError(UnexpectedToken)");
      expect(err.type).toEqual("UnexpectedToken");
      expect(err.value.nextSym.label).toEqual("C");
      expect(err.value.state).toEqual(1);
    }
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
                    ["$0", "b", [["B", "b"]]],
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

const grammar_with_actions = `
      %token plus "+"
      %token star "*"
      %token open "("
      %token close ")"
      %token id /[A-Za-z]+/
      %skip /[ \\t\\n\\f\\r]+/

      E -> E plus T { add } | T { $1 };
      T -> T star F { mult } | F { $1 };
      F -> open E close { $2 } | id { getVar };
`;

describe("LRParsing Action Tests", () => {
  test("Test A + B * C", () => {
    const vars = { a: 1, b: 2, c: 3 } as any;
    const result = testParsing(grammar_with_actions, "a+b*c", {
      type: "slr",
      ruleHandlers: {
        mult: (rule: Rule, parent: PTNode, ...children: PTNode[]) => {
          return children[0].value * children[2].value;
        },
        add: (rule: Rule, parent: PTNode, ...children: PTNode[]) => {
          return children[0].value + children[2].value;
        },
        getVar: (rule: Rule, parent: PTNode, ...children: PTNode[]) => {
          const varname = children[0].value;
          if (!(varname in vars)) {
            throw new Error("Variable not found: " + varname);
          }
          return vars[varname];
        },
      },
    });
    expect(result?.value).toEqual(7);
  });
});

describe("LRParsing Tokenizer Errors", () => {
  test("Test A + B # * C", () => {
    const vars = { a: 1, b: 2, c: 3 } as any;
    const errors: TLEX.TokenizerError[] = [];
    const result = testParsing(grammar_with_actions, "a+b##*c", {
      type: "slr",
      onTokenError: (err: TLEX.TokenizerError, tape: TLEX.Tape) => {
        errors.push(err);
        return true; // true will skip this error token
      },
      ruleHandlers: {
        mult: (rule: Rule, parent: PTNode, ...children: PTNode[]) => {
          return children[0].value * children[2].value;
        },
        add: (rule: Rule, parent: PTNode, ...children: PTNode[]) => {
          return children[0].value + children[2].value;
        },
        getVar: (rule: Rule, parent: PTNode, ...children: PTNode[]) => {
          const varname = children[0].value;
          if (!(varname in vars)) {
            throw new Error("Variable not found: " + varname);
          }
          return vars[varname];
        },
      },
    });
    expect(result?.value).toEqual(7);
    expect(errors.length).toEqual(2); // one for each "#"
  });
});
