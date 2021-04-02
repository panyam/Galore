import * as TSU from "@panyam/tsutils";
import { CharTape, Token, Tokenizer } from "./tokenizer";
import { UnexpectedTokenError } from "./errors";
import { Sym, Grammar, Str } from "./grammar";
import {
  SingleChTokens,
  TokenType,
  singleLineCommentMatcher,
  spacesMatcher,
  numberMatcher,
  identMatcher,
  startStopMatcher,
} from "./ebnftokens";

export enum NodeType {
  GRAMMAR = "GRAMMAR",
  DECL = "DECL",
  RULE = "RULE",
  PROD_NULL = "PROD_NULL",
  PROD_STR = "PROD_STR",
  PROD_UNION = "PROD_UNION",
  PROD_NAME = "PROD_NAME",
  PROD_STRING = "PROD_STRING",
  PROD_NUM = "PROD_NUM",
  PROD_IDENT = "PROD_IDENT",
  PROD_STAR = "PROD_STAR",
  PROD_PLUS = "PROD_PLUS",
  PROD_OPTIONAL = "PROD_OPTIONAL",
  IDENT = "IDENT",
  ERROR = "ERROR",
  COMMENT = "COMMENT",
}

/**
 * Tokenizer with matchers specific to EBNF
 */
export function EBNFTokenizer(input: string | CharTape): Tokenizer {
  return new Tokenizer(input)
    .addMatcher(spacesMatcher, true)
    .addMatcher(startStopMatcher(TokenType.COMMENT, "/*", "*/"), true) // Comments
    .addMatcher(singleLineCommentMatcher, true)
    .addMatcher(startStopMatcher(TokenType.STRING, "'", "'")) // Single quoted String
    .addMatcher(startStopMatcher(TokenType.STRING, '"', '"')) // Double quoted String
    .addMatcher((tape, offset) => {
      if (!tape.matches("->")) return null;
      return new Token(TokenType.ARROW, { value: "->" });
    })
    .addMatcher(numberMatcher)
    .addMatcher(identMatcher)
    .addMatcher((tape, offset) => {
      return tape.currCh in SingleChTokens ? new Token(SingleChTokens[tape.currCh], { value: tape.nextCh() }) : null;
    });
}

/**
 * EBNF Grammar:
 *
 * grammar -> rules;
 *
 * decl -> rule ;
 *
 * rules -> rule | rule rules ;
 *
 * rule -> IDENT "->" productions ";" ;
 *
 * productions -> prod  ( | prod ) *
 *            |
 *            ;
 *
 * prod -> ( prod_group | optional_prod | IDENT | STRING ) ( "*" | "+" | "?" ) ?
 *      ;
 *
 * prod_group -> "(" productions ")"  ;
 *
 * optional_prod -> "(" productions ")"  ;
 */
export class EBNFParser {
  readonly grammar: Grammar;
  private tokenizer: Tokenizer;
  private allowLeftRecursion = false;
  constructor(input: string, config: any = {}) {
    this.grammar = this.parse(input);
    this.allowLeftRecursion = config.allowLeftRecursion || false;
  }

  parse(input: string): Grammar {
    this.tokenizer = EBNFTokenizer(input);
    return this.parseGrammar();
  }

  parseGrammar(): Grammar {
    const grammar = new Grammar();
    while (this.tokenizer.peek() != null) {
      this.parseDecl(grammar);
    }
    return grammar;
  }

  parseDecl(grammar: Grammar): void {
    const ident = this.tokenizer.expectToken(TokenType.IDENT);
    if (this.tokenizer.consumeIf(TokenType.ARROW)) {
      let nt = grammar.getSym(ident.value);
      if (nt == null) {
        nt = grammar.newNT(ident.value);
      } else if (nt.isTerminal) {
        // it is a terminal so mark it as a non-term now that we
        // know there is a declaration for it.
        nt.isTerminal = false;
      } else if (nt.isAuxiliary) {
        throw new Error("NT is already auxiliary and cannot be reused.");
      }
      for (const rule of this.parseProductions(grammar, nt)) {
        grammar.add(nt, rule);
      }
      this.tokenizer.expectToken(TokenType.SEMI_COLON);
    }
  }

  parseProductions(grammar: Grammar, nt: TSU.Nullable<Sym>): Str[] {
    const out: Str[] = [];
    while (this.tokenizer.peek() != null) {
      const rule = this.parseProd(grammar);
      if (rule) out.push(rule);
      if (this.tokenizer.consumeIf(TokenType.PIPE)) {
        continue;
      } else if (this.tokenizer.nextMatches(TokenType.CLOSE_SQ, TokenType.CLOSE_PAREN, TokenType.SEMI_COLON)) {
        break;
      }
    }
    return out;
  }

  parseProd(grammar: Grammar): Str {
    const out = new Str();
    while (true) {
      // if we are starting with a FOLLOW symbol then return as it marks
      // the end of this production
      if (this.tokenizer.nextMatches(TokenType.CLOSE_PAREN, TokenType.CLOSE_SQ, TokenType.SEMI_COLON, TokenType.PIPE)) {
        return out;
      }
      let curr: TSU.Nullable<Str> = null;
      if (this.tokenizer.consumeIf(TokenType.OPEN_PAREN)) {
        const rules = this.parseProductions(grammar, null);
        if (rules.length == 0) {
          // nothing
        } else if (rules.length == 1) {
          curr = rules[0];
        } else {
          // create a new NT over this
          curr = grammar.anyof(...rules);
        }
        this.tokenizer.expectToken(TokenType.CLOSE_PAREN);
      } else if (this.tokenizer.consumeIf(TokenType.OPEN_SQ)) {
        const rules = this.parseProductions(grammar, null);
        if (rules.length == 0) {
          // nothing
        } else if (rules.length == 1) {
          curr = grammar.opt(rules[0]);
        } else {
          // create a new NT over this
          curr = grammar.opt(grammar.anyof(...rules));
        }
        this.tokenizer.expectToken(TokenType.CLOSE_SQ);
      } else if (this.tokenizer.nextMatches(TokenType.IDENT)) {
        const token = this.tokenizer.next() as Token;
        curr = new Str(grammar.getSym(token.value) || grammar.newTerm(token.value));
      } else if (this.tokenizer.nextMatches(TokenType.STRING)) {
        const token = this.tokenizer.next() as Token;
        const label = '"' + token.value + '"';
        // TODO - ensure we can add literal into our
        // Tokenizer so it will prioritize this over its rules
        curr = new Str(grammar.getSym(label) || grammar.newTerm(label));
      } else if (this.tokenizer.nextMatches(TokenType.NUMBER)) {
        const token = this.tokenizer.next() as Token;
        const label = token.value + "";
        // TODO - ensure we can add literal into our
        // Tokenizer so it will prioritize this over its rules
        curr = new Str(grammar.getSym(label) || grammar.newTerm(label));
      } else {
        throw new UnexpectedTokenError(this.tokenizer.peek());
      }

      if (curr == null) {
        throw new Error("Could not determine node");
      }

      if (this.tokenizer.consumeIf(TokenType.STAR)) {
        curr = grammar.atleast0(curr, this.allowLeftRecursion);
      } else if (this.tokenizer.consumeIf(TokenType.PLUS)) {
        curr = grammar.atleast1(curr, this.allowLeftRecursion);
      } else if (this.tokenizer.consumeIf(TokenType.QMARK)) {
        curr = grammar.opt(curr);
      }
      out.extend(curr);
    }
    return out;
  }
}
