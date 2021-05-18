const util = require("util");
import { newParser } from "../src/factory";
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
/*
parser.onReduction = (node, rule) => {
  if (!rule.nt.isAuxiliary) return node;
  return node;
};
*/

const result = parser.parse(`{
  "name": "Earth",                                                                          
  "age": 4600000000,                                                                        
  "moons": [ "luna" ]
}`);
console.log("Parse Tree: ");
console.log(result?.reprString);
/*
  util.inspect(result?.reprString, {
    showHidden: false,
    depth: null,
    maxArrayLength: null,
    maxStringLength: null,
  }),
);
*/
