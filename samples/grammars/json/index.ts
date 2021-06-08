import * as TLEX from "tlex";
import { newParser as newLRParser } from "../../../src/factory";
import { Parser } from "../../../src/lr";

export const GRAMMAR = `
    %token NUMBER /-?\\d+(\\.\\d+)?([eE][+-]?\\d+)?/
    %token STRING /".*?(?<!\\\\)"/
    %skip /[ \\t\\n\\f\\r]+/

    Value -> Dict | List | STRING | NUMBER | Boolean | "null" ;
    List -> "[" [ Value ( "," Value ) * ] "]" ;
    Dict -> "{" [ Pair ("," Pair)* ] "}" ;
    Pair -> STRING ":" Value ;
    Boolean -> "true" | "false" ;
`;

export const newParser = (params?: any): [Parser, null | TLEX.NextTokenFunc] => newLRParser(GRAMMAR, params);
