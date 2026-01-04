/**
 * Built-in grammars and sample inputs for the playground
 */

export interface BuiltinGrammar {
  name: string;
  label: string;
  grammar: string;
  sampleInput?: string;
  selected?: boolean;
  actionCode?: string;
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
Statement -> Assignment ";" | Expr ";" ;
Assignment -> ID "=" Expr ;
Expr -> Expr "+" Term | Expr "-" Term | Term ;
Term -> Term "*" Factor | Term "/" Factor | Factor ;
Factor -> ParenExpr | NUMBER | FuncCall ;
FuncCall -> ID | ID ParenExpr | ID CommaExprList ;
CommaExprList -> "(" Expr ( "," Expr ) + ")" | "(" ")";
ParenExpr -> "(" Expr ")" ;
    `.trim(),
    sampleInput: `x = 10;
y = 20;
x + y * 2;`,
    actionCode: `// Calculator evaluator with statement formatting
const vars = {};
const output = [];

// Convert parse tree node to source text (without ";")
function nodeToString(n) {
  if (!n) return "";
  if (n.value !== undefined && !n.children?.length) return n.value;
  if (n.children) {
    return n.children
      .filter(c => c.sym?.label !== ";")
      .map(nodeToString).join(" ");
  }
  return "";
}

function evaluate(n) {
  if (!n) return 0;
  const sym = n.sym?.label;
  const kids = n.children || [];

  if (sym === "NUMBER") return parseFloat(n.value);
  if (sym === "ID") return vars[n.value] ?? 0;

  if (sym === "Assignment") {
    const name = kids[0].value;
    const val = evaluate(kids[2]);
    vars[name] = val;
    return val;
  }

  if (sym === "Expr" || sym === "Term") {
    if (kids.length === 3) {
      const l = evaluate(kids[0]);
      const op = kids[1].value;
      const r = evaluate(kids[2]);
      if (op === "+") return l + r;
      if (op === "-") return l - r;
      if (op === "*") return l * r;
      if (op === "/") return l / r;
    }
  }

  if (sym === "Factor" || sym === "ParenExpr") {
    return evaluate(kids.find(c =>
      c.sym?.label !== "(" && c.sym?.label !== ")"
    ) || kids[0]);
  }

  if (sym === "FuncCall") {
    if (kids.length === 1) {
      return vars[kids[0].value] ?? 0;
    }
    return 0; // Function calls not supported in simple version
  }

  if (sym === "Statement") {
    const stmtNode = kids[0];
    const text = nodeToString(stmtNode);
    const val = evaluate(stmtNode);
    output.push(text + "  →  " + val);
    return val;
  }

  if (sym === "Program") {
    for (const stmt of kids) evaluate(stmt);
    return output.join("\\n");
  }

  // Default: recurse
  let result = 0;
  for (const c of kids) result = evaluate(c);
  return result;
}

return evaluate(node);`,
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
