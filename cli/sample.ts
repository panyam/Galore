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
parser.onRuleReduced = (node, rule) => {
  if (!rule.nt.isAuxiliary) return node;
  return node;
};

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
