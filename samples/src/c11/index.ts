import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import * as G from "galore";
export * from "./data";
import { GRAMMAR } from "./data";

export function newParser(params: any): [G.LR.Parser, TLEX.NextTokenFunc | null] {
  const [parser, tokenizer] = G.newLRParser(GRAMMAR, params);
  /*
  const typedefNames = new Set<string>();
  const enumNames = new Set<string>();
  parser.onNextToken = (token: TLEX.Token) => {
    if (token.tag == "IDENTIFIER") {
      if (typedefNames.has(token.value)) {
        token.tag = "TYPEDEF_NAME";
      } else if (enumNames.has(token.value)) {
        token.tag = "ENUMERATION_CONSTANT";
      }
    }
    // Check token and extract enum or typedef names
    return token;
  };

  parser.onReduction = (node: G.PTNode, rule: G.Rule) => {
    if (node.sym.label == "declaration" && node.childAt(0).sym.label == "declaration_specifiers") {
      return node;
    }
    return node;
  };
  */
  return [parser, tokenizer];
}
