import * as TSU from "@panyam/tsutils";
import { EBNFParser } from "../src/ebnf";
import { LRItemSet, LR0Item, LR0ItemGraph } from "../src/lr";
import { makeSLRParseTable, makeLRParseTable } from "../src/ptables";

const grammar = new EBNFParser(`
  stmt -> if expr then stmt else stmt
       | if expr then stmt
       | expr QMARK stmt stmt
       | arr OSQ expr CSQ ASGN  expr
       ;
  expr -> num | expr PLUS  expr ;
  num -> DIGIT | num DIGIT ;
`).grammar.augmentStartSymbol();

const [ptables, itemGraph] = makeSLRParseTable(grammar);

console.log("Grammar: ", grammar.debugValue());
console.log("ItemGraph: ", itemGraph.debugValue);
console.log("Ptables: ", ptables.debugValue);
