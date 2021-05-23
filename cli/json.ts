import * as TSU from "@panyam/tsutils";
const fs = require("fs");
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
// only allow true, false, string, number and null terminals
const allowList = new Set(["STRING", "NUMBER", "Boolean", '"null"', '"true"', '"false"']);
const parser = newParser(g, { flatten: true, type: "slr", debug: true });
parser.onNextToken = (token) => {
  if (token.tag == "STRING") {
    token.value = token.value.substring(1, token.value.length - 1);
  } else if (token.tag == "NUMBER") {
    token.value = parseFloat(token.value);
  } else if (token.tag == '"true"') {
    token.value = true;
  } else if (token.tag == '"false"') {
    token.value = false;
  } else if (token.tag == '"null"') {
    token.value = null;
  }
  return token;
};
parser.beforeAddingChildNode = (parent, child) => {
  if (child.sym.isTerminal) {
    if (!allowList.has(child.sym.label)) {
      return [];
    }
  } else if (child.sym.isAuxiliary) {
    return child.children;
  }
  return [child];
};
parser.onReduction = (node: PTNode, rule: Rule) => {
  if (node.children.length == 1) {
    node = node.children[0];
  }
  if (node.sym.label == "List") {
    node.value = node.children.map((n) => n.value);
  } else if (node.sym.label == "Dict") {
    node.value = {};
    for (const pair of node.children) {
      // these *will* be Pair objects
      TSU.assert(pair.sym.label == "Pair");
      TSU.assert(pair.children.length == 2);
      node.value[pair.children[0].value] = pair.children[1].value;
    }
  }
  return node;
};

const args = process.argv.slice(2);
const payloadPath = args[0];
const payload = fs.readFileSync(payloadPath, "utf8");
const parseStartTime = Date.now();
const result = parser.parse(payload);
const parseEndTime = Date.now();
console.log("Parse Tree: ");
const dVal = util.inspect(result?.debugValue(true), {
  showHidden: false,
  depth: null,
  maxArrayLength: null,
  maxStringLength: null,
});
console.log(dVal);
console.log(result?.reprString);
console.log(
  "Value: ",
  util.inspect(result?.value, {
    showHidden: false,
    depth: null,
    maxArrayLength: null,
    maxStringLength: null,
  }),
);
console.log("Time with parser.parse: ", parseEndTime - parseStartTime);

const jsonParseStartTime = Date.now();
const jpResult = JSON.parse(payload);
const jsonParseEndTime = Date.now();
console.log("JSON Parse Result: ", jpResult);
console.log("Time with JSON.parse: ", jsonParseEndTime - jsonParseStartTime);
