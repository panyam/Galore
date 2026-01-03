/**
 * Built-in grammars and sample inputs for the playground
 */

export interface BuiltinGrammar {
  name: string;
  label: string;
  grammar: string;
  sampleInput?: string;
  selected?: boolean;
}

export const builtinGrammars: BuiltinGrammar[] = [
  {
    name: "Calculator",
    label: "Calculator",
    selected: true,
    grammar: `
%token NUMBER /\\d+(\\.\\d+)?/
%token ID /[a-zA-Z_][a-zA-Z0-9_]*/
%skip /[ \\t\\n\\f\\r]+/

Program -> Statement* ;
Statement -> Assignment | Expr ;
Assignment -> ID "=" Expr ;
Expr -> Expr "+" Term | Expr "-" Term | Term ;
Term -> Term "*" Factor | Term "/" Factor | Factor ;
Factor -> "(" Expr ")" | NUMBER | Atom ;
Atom -> ID AtomTail ;
AtomTail -> "(" [ Expr ( "," Expr )* ] ")" | ;
    `.trim(),
    sampleInput: `x = 10
y = 20
x + y * 2`,
  },
  {
    name: "JSON",
    label: "JSON",
    grammar: `
%token NUMBER /-?\\d+(\\.\\d+)?([eE][+-]?\\d+)?/
%token STRING /".*?(?<!\\\\)"/
%skip /[ \\t\\n\\f\\r]+/

Value -> Dict | List | STRING | NUMBER | Boolean | "null" ;
List -> "[" [ Value ( "," Value ) * ] "]" ;
Dict -> "{" [ Pair ("," Pair)* ] "}" ;
Pair -> STRING ":" Value ;
Boolean -> "true" | "false" ;
    `.trim(),
    sampleInput: `{
  "name": "Milky Way",
  "age": 4600000000,
  "star": "sun",
  "planets": [ "Mercury", "Venus", "Earth" ],
  "hot": true,
  "x": null
}`,
  },
  {
    name: "Arithmetic",
    label: "Arithmetic",
    grammar: `
%token NUMBER /\\d+/
%skip /[ \\t\\n\\f\\r]+/

Expr -> Expr "+" Term | Expr "-" Term | Term ;
Term -> Term "*" Factor | Term "/" Factor | Factor ;
Factor -> "(" Expr ")" | NUMBER ;
    `.trim(),
    sampleInput: "1 + 2 * 3",
  },
  {
    name: "FarshiG3",
    label: "Farshi G3 (Ambiguous)",
    grammar: `
%token b "b"
%token x "x"
%skip /[ \\t\\n\\f\\r]+/

S -> A S b ;
S -> x ;
A -> ;
    `.trim(),
    sampleInput: "x b b",
  },
  {
    name: "DanglingElse",
    label: "Dangling Else (Conflict)",
    grammar: `
%token IF "if"
%token THEN "then"
%token ELSE "else"
%token EXPR "expr"
%token OTHER "other"
%skip /[ \\t\\n\\f\\r]+/

Stmt -> IF EXPR THEN Stmt
      | IF EXPR THEN Stmt ELSE Stmt
      | OTHER ;
    `.trim(),
    sampleInput: "if expr then if expr then other else other",
  },
  {
    name: "AmbiguousExpr",
    label: "Ambiguous Expr (Conflict)",
    grammar: `
%token NUMBER /\\d+/
%skip /[ \\t\\n\\f\\r]+/

E -> E "+" E | E "*" E | NUMBER ;
    `.trim(),
    sampleInput: "1 + 2 * 3",
  },
];

export const parserTypes = [
  { value: "slr", label: "SLR" },
  { value: "lalr", label: "LALR" },
  { value: "lr1", label: "LR(1)" },
];
