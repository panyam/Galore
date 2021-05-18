const util = require("util");
import { newParser } from "../factory";
import { Parser } from "../lr";

const g = `
        %token NUMBER /-?\\d+(\\.\\d+)?([eE][+-]?\\d+)?/
        %token STRING /".*?(?<!\\\\)"/
        %skip /[ \\t\\n\\f\\r]+/

        Value -> Dict | List | STRING | NUMBER | Boolean | "null" ;
        List -> "[" [ Value ( "," Value ) * ] "]" ;
        Dict -> "{" [ Pair ("," Pair)* ] "}" ;
        Pair -> STRING ":" Value ;
        Boolean -> "true" | "false" ;
`;

function testParsing(input: string, onParser: (p: Parser) => void, debug = false): any {
  const parser = newParser(g, { type: "slr" });
  onParser(parser);

  const result = parser.parse(input);
  if (debug) {
    console.log(
      "Parse Tree: ",
      util.inspect(result?.debugValue(false), {
        showHidden: false,
        depth: null,
        maxArrayLength: null,
        maxStringLength: null,
      }),
    );
  }
  return result;
}

describe("JSON Parsing", () => {
  test("Basic Parsing", () => {
    const result = testParsing(`{"a": 1, "b": "xyz", "c": false, "d": null}`, (p: Parser) => {
      p.onReduction = (node, rule) => {
        if (!rule.nt.isAuxiliary) return node;
        return node;
      };
    });
    expect(result?.debugValue(true)).toEqual([
      "Value",
      [
        [
          "Dict",
          [
            ['"{"', "{"],
            [
              "$3",
              [
                [
                  "Pair",
                  [
                    ["STRING", '"a"'],
                    ['":"', ":"],
                    ["Value", [["NUMBER", "1"]]],
                  ],
                ],
                [
                  "$2",
                  [
                    ['","', ","],
                    [
                      "Pair",
                      [
                        ["STRING", '"b"'],
                        ['":"', ":"],
                        ["Value", [["STRING", '"xyz"']]],
                      ],
                    ],
                    [
                      "$2",
                      [
                        ['","', ","],
                        [
                          "Pair",
                          [
                            ["STRING", '"c"'],
                            ['":"', ":"],
                            ["Value", [["Boolean", [['"false"', "false"]]]]],
                          ],
                        ],
                        [
                          "$2",
                          [
                            ['","', ","],
                            [
                              "Pair",
                              [
                                ["STRING", '"d"'],
                                ['":"', ":"],
                                ["Value", [['"null"', "null"]]],
                              ],
                            ],
                            ["$2"],
                          ],
                        ],
                      ],
                    ],
                  ],
                ],
              ],
            ],
            ['"}"', "}"],
          ],
        ],
      ],
    ]);
  });
  test("Filter Useless Tokens", () => {
    const result = testParsing(
      `{"a": 1, "b": "xyz", "c": false, "d": null}`,
      (p: Parser) => {
        p.beforeAddingChildNode = (parent, child) => {
          if (child.sym.isTerminal) {
            // only allow true, false, string, number and null
            // terminals
            if (
              child.sym.label != "STRING" &&
              child.sym.label != "NUMBER" &&
              child.sym.label != "Boolean" &&
              child.sym.label != "null" &&
              child.sym.label != "true" &&
              child.sym.label != "false"
            ) {
              return null;
            }
          }
          return child;
        };
      },
      true,
    );
    // expect(result?.debugValue(true)).toEqual([]);
  });
});
