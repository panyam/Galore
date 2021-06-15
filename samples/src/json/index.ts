import * as TLEX from "tlex";
import * as G from "galore";

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

export const newParser = (params?: any): [G.LR.Parser, null | TLEX.NextTokenFunc] => G.newLRParser(GRAMMAR, params);
