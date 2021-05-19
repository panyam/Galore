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
      return null;
    }
  }
  return child;
};
parser.onReduction = (node: PTNode, rule: Rule) => {
  const nt = node.sym;
  if (nt.isAuxiliary) {
    if (nt.auxType == "opt") {
      // do nothing - include even if a place holder
    } else if (nt.auxType == "atleast0" || nt.auxType == "atleast1") {
      // right recursive
      const rightChild = node.childAt(-1);
      TSU.assert(rightChild.sym == nt);
      // append everthing from child to this node
      node.children.pop();
      for (const child of rightChild.children) {
        node.add(child);
      }
    } else if (nt.auxType == "atleast0:left" || nt.auxType == "atleast1:left") {
      // left recursive
      const rightChild = node.childAt(0);
      TSU.assert(rightChild.sym == nt);
    } else if (nt.auxType == "atleast0" || nt.auxType == "atleast1") {
    }
  } else if (node.children.length == 1) {
    return node.children[0];
  }
  return node;
};

const result = parser.parse(` { "name": "Earth", "age": 4600000000, "moons": [ "luna" ] }`);
//const result = parser.parse(` {"a": 1, "b": "xyz", "c": false, "d": null} `);
console.log("Parse Tree: ");
console.log(
  result?.reprString,
  //util.inspect(result?.reprString, { util.inspect(result?.debugValue(), { showHidden: false, depth: null, maxArrayLength: null, maxStringLength: null, }),
);
