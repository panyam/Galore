const util = require("util");
import * as TSU from "@panyam/tsutils";
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
            return null;
          }
        }
        return child;
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
            return null;
          }
        }
        return child;
      };
      p.onReduction = (node, rule) => {
        if (node.children.length == 1) return node.children[0];
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
              return null;
            }
          }
          return child;
        };
        p.onReduction = (node, rule) => {
          const nt = node.sym;
          if (nt.isAuxiliary) {
            if (nt.auxType == "opt") {
              // do nothing - include even if a place holder
            } else if (nt.auxType == "atleast0" || nt.auxType == "atleast1") {
              // right recursive
              if (node.childCount > 0) {
                const rightChild = node.childAt(-1);
                TSU.assert(rightChild.sym == nt);
                // append everthing from child to this node
                node.children.pop();
                for (const child of rightChild.children) {
                  node.add(child);
                }
              }
            } else if (nt.auxType == "atleast0:left" || nt.auxType == "atleast1:left") {
              // left recursive
              if (node.childCount > 0) {
                const rightChild = node.childAt(0);
                TSU.assert(rightChild.sym == nt);
                node.splice(0, 1, ...rightChild.children);
              }
            }
          } else if (node.children.length == 1) {
            return node.children[0];
          }
          return node;
        };
      },
      true,
    );
    expect(result?.debugValue(false)).toEqual([]);
  });
});
