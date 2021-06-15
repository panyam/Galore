const util = require("util");
import * as TSU from "@panyam/tsutils";
import { newLRParser as newParser } from "../factory";
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
  const [parser, _] = newParser(g, { type: "slr" });
  onParser(parser);

  const result = parser.parse(input);
  if (debug) {
    console.log(
      "Parse Tree: ",
      util.inspect(result?.debugValue(true), {
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
      /* */
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
                    [
                      "$2",
                      [
                        [
                          "$2",
                          [
                            ["$2"],
                            ['","', ","],
                            [
                              "Pair",
                              [
                                ["STRING", '"b"'],
                                ['":"', ":"],
                                ["Value", [["STRING", '"xyz"']]],
                              ],
                            ],
                          ],
                        ],
                        ['","', ","],
                        [
                          "Pair",
                          [
                            ["STRING", '"c"'],
                            ['":"', ":"],
                            ["Value", [["Boolean", [['"false"', "false"]]]]],
                          ],
                        ],
                      ],
                    ],
                    ['","', ","],
                    [
                      "Pair",
                      [
                        ["STRING", '"d"'],
                        ['":"', ":"],
                        ["Value", [['"null"', "null"]]],
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
    const result = testParsing(`{"a": 1, "b": "xyz", "c": false, "d": null}`, (p: Parser) => {
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
            return [];
          }
        }
        return [child];
      };
    });
    expect(result?.debugValue(true)).toEqual([
      "Value",
      [
        [
          "Dict",
          [
            [
              "$3",
              [
                [
                  "Pair",
                  [
                    ["STRING", '"a"'],
                    ["Value", [["NUMBER", "1"]]],
                  ],
                ],
                [
                  "$2",
                  [
                    [
                      "$2",
                      [
                        [
                          "$2",
                          [
                            ["$2"],
                            [
                              "Pair",
                              [
                                ["STRING", '"b"'],
                                ["Value", [["STRING", '"xyz"']]],
                              ],
                            ],
                          ],
                        ],
                        [
                          "Pair",
                          [
                            ["STRING", '"c"'],
                            ["Value", [["Boolean"]]],
                          ],
                        ],
                      ],
                    ],
                    ["Pair", [["STRING", '"d"'], ["Value"]]],
                  ],
                ],
              ],
            ],
          ],
        ],
      ],
    ]);
  });

  test("Inline Simple productions", () => {
    const result = testParsing(`{"a": 1, "b": "xyz", "c": false, "d": null}`, (p: Parser) => {
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
            return [];
          }
        }
        return [child];
      };
      p.onReduction = (node, rule) => {
        if (node.children.length == 1) {
          return node.children[0];
        }
        return node;
      };
    });
    expect(result?.debugValue(true)).toEqual([
      "$3",
      [
        [
          "Pair",
          [
            ["STRING", '"a"'],
            ["NUMBER", "1"],
          ],
        ],
        [
          "$2",
          [
            [
              "$2",
              [
                [
                  "$2",
                  [
                    ["$2"],
                    [
                      "Pair",
                      [
                        ["STRING", '"b"'],
                        ["STRING", '"xyz"'],
                      ],
                    ],
                  ],
                ],
                ["Pair", [["STRING", '"c"'], ["Boolean"]]],
              ],
            ],
            ["Pair", [["STRING", '"d"'], ["Value"]]],
          ],
        ],
      ],
    ]);
  });

  test("Collapse Auxiliary Productions", () => {
    const result = testParsing(
      ` { "name": "Milky Way", "age": 4600000000, "star": "sun", "planets": [ "Mercury", "Venus", "Earth" ] }`,
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
              return [];
            }
          } else if (child.sym.isAuxiliary) {
            return child.children;
          }
          return [child];
        };
        p.onReduction = (node, rule) => {
          if (node.children.length == 1) {
            return node.children[0];
          }
          return node;
        };
      },
    );
    expect(result?.debugValue()).toEqual([
      "Dict",
      [
        [
          "Pair",
          [
            ["STRING", '"name"'],
            ["STRING", '"Milky Way"'],
          ],
        ],
        [
          "Pair",
          [
            ["STRING", '"age"'],
            ["NUMBER", "4600000000"],
          ],
        ],
        [
          "Pair",
          [
            ["STRING", '"star"'],
            ["STRING", '"sun"'],
          ],
        ],
        [
          "Pair",
          [
            ["STRING", '"planets"'],
            [
              "List",
              [
                ["STRING", '"Mercury"'],
                ["STRING", '"Venus"'],
                ["STRING", '"Earth"'],
              ],
            ],
          ],
        ],
      ],
    ]);
  });
});
