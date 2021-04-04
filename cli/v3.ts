import * as TSU from "@panyam/tsutils";
import { EBNFParser } from "../src/ebnf";
import { LRItemSet, LR0Item, LR0ItemGraph } from "../src/lr";
import { makeSLRParseTable, makeLRParseTable } from "../src/ptables";

const grammar = new EBNFParser(`
  Snippet -> ( Command | RoleSelector | Atoms | COMMENT ) * ;
  Command -> BSLASH_IDENT CommandParams ? ;
  CommandParams  -> OPEN_PAREN ParamList ? CLOSE_PAREN ;
  ParamList -> Param |  Param COMMA ParamList ;
  Param -> ParamKey [ EQUALS ParamValue ] ;
  ParamKey  -> STRING | Fraction | IDENT ;
  ParamValue -> STRING | Fraction | IDENT ;
  Fraction -> NUMBER [ "/" NUMBER ] ;

  RoleSelector -> IDENT_COLON ;

  Atoms -> Atom + ;

  Atom -> Duration ? ( SpaceAtom | Literal | Group ) ;
  Duration -> Fraction ;

  SpaceAtom -> COMMA | SEMI_COLON | UNDER_SCORE ;
  Group -> OPEN_SQ Atom * CLOSE_SQ ;
  Literal -> DOTS_IDENT | IDENT | IDENT_DOTS | STRING ;
`).grammar.augmentStartSymbol();

const [ptables, itemGraph] = makeSLRParseTable(grammar);

console.log("Grammar: ", grammar.debugValue());
console.log("ItemGraph: ", itemGraph.debugValue);
console.log("Ptables: ", ptables.debugValue);
