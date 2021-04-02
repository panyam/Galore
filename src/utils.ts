import { Sym, Str, Grammar, Rule } from "./grammar";
import { PTNode } from "./parser";

export function printGrammar(g: Grammar, hideAux = true): string {
  let out = "";
  g.forEachNT((nt) => {
    if (!hideAux || !nt.isAuxiliary) {
      out += nt.label + " -> ";
      out += printRules(g, g.rulesForNT(nt), hideAux) + "\n\n";
    }
  });
  return out;
}

export function printRules(g: Grammar, rules: Rule[], hideAux = true): string {
  // If auxiliaries are hidden then we dont show the rule name
  let out = "";
  const indentStr = "    ";
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (i > 0) {
      if (!hideAux) {
        out += "\n";
        out += indentStr;
      }
      out += " | ";
    }
    out += printRule(g, rule.rhs, hideAux);
  }
  if (!hideAux) {
    out += "\n";
    out += indentStr;
  }
  out += " ;";
  return out;
}

export function printRule(g: Grammar, rule: Str, hideAux = true): string {
  return rule.debugString;
}

function printTree(node: PTNode, level = 0): string {
  let out = "";
  let indentStr = "";
  for (let i = 0; i < level; i++) indentStr += "  ";
  out += indentStr + node.sym.label + " - " + node.value;
  for (const child of node.children) out += "\n" + printTree(child, level + 1);
  return out;
}
