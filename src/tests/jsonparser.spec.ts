import * as TSU from "@panyam/tsutils";
import { newLRParser as newParser } from "../factory";
import { PTNode } from "../parser";
import { Rule } from "../grammar";

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

function testParsing(input: string, parseParams: any = null, debug = false): any {
  const [parser, _] = newParser(g, { type: "slr" });

  const result = parser.parse(input, parseParams);
  if (debug) {
    console.log("Parse Tree: ", JSON.stringify(result?.debugValue(true), null, 4));
  }
  return result;
}

describe("JSON Parsing", () => {
  test("Basic Parsing", () => {
    const result = testParsing(`{"a": 1, "b": "xyz", "c": false, "d": null}`, null);
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
    const result = testParsing(`{"a": 1, "b": "xyz", "c": false, "d": null}`, {
      beforeAddingChildNode: (parent: PTNode, child: PTNode) => {
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
      },
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
    const result = testParsing(`{"a": 1, "b": "xyz", "c": false, "d": null}`, {
      beforeAddingChildNode: (parent: PTNode, child: PTNode) => {
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
      },
      onReduction: (node: PTNode, rule: Rule) => {
        if (node.children.length == 1) {
          return node.children[0];
        }
        return node;
      },
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
      {
        beforeAddingChildNode: (parent: PTNode, child: PTNode) => {
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
        },
        onReduction: (node: PTNode, rule: Rule) => {
          if (node.children.length == 1) {
            return node.children[0];
          }
          return node;
        },
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
