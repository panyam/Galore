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
    name: "JSON",
    label: "JSON",
    selected: true,
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
    name: "Calculator",
    label: "Calculator",
    grammar: `
%token NUMBER /\\d+(\\.\\d+)?/
%token ID /[a-zA-Z_][a-zA-Z0-9_]*/
%skip /[ \\t\\n\\f\\r]+/

Program -> Statement* ;
Statement -> Assignment | Expr ;
Assignment -> ID "=" Expr ;
Expr -> Expr "+" Term | Expr "-" Term | Term ;
Term -> Term "*" Factor | Term "/" Factor | Factor ;
Factor -> "(" Expr ")" | NUMBER | ID | FuncCall ;
FuncCall -> ID "(" [ Expr ( "," Expr )* ] ")" ;
    `.trim(),
    sampleInput: `x = 10
y = 20
x + y * 2`,
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
];

export const parserTypes = [
  { value: "slr", label: "SLR" },
  { value: "lalr", label: "LALR" },
  { value: "lr1", label: "LR(1)" },
];
