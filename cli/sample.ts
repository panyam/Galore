import * as TSU from "@panyam/tsutils";
const util = require("util");
import { newParser } from "../src/factory";
import { PTNode } from "../src/parser";
import { Rule, Sym } from "../src/grammar";
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
const parser = newParser(g, { flatten: true, type: "slr" });
parser.beforeAddingChildNode = (parent, child) => {
  if (child.sym.isTerminal) {
    // only allow true, false, string, number and null terminals
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
parser.onReduction = (node: PTNode, rule: Rule) => {
  if (node.children.length == 1) {
    return node.children[0];
  }
  return node;
};

const result = parser.parse(
  ` { "name": "Milky Way", "age": 4600000000, "star": "sun", "planets": [ "Mercury", "Venus", "Earth" ] }`,
);
//const result = parser.parse(` {"a": 1, "b": "xyz", "c": false, "d": null} `);
console.log("Parse Tree: ");
// result?.reprString,
const dVal = util.inspect(result?.debugValue(false), {
  showHidden: false,
  depth: null,
  maxArrayLength: null,
  maxStringLength: null,
});
console.log(dVal);
