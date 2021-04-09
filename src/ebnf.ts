import * as TSU from "@panyam/tsutils";
import { TokenMatcher, CharTape, Token, SimpleTokenizer } from "./tokenizer";
import { UnexpectedTokenError } from "./errors";
import { Sym, Grammar, Str } from "./grammar";

export enum TokenType {
  STRING = "STRING",
  REGEX = "REGEX",
  NUMBER = "NUMBER",
  SPACES = "SPACES",
  IDENT = "IDENT",
  PCT_IDENT = "PCT_IDENT",
  STAR = "STAR",
  PLUS = "PLUS",
  QMARK = "QMARK",
  PIPE = "PIPE",
  OPEN_PAREN = "OPEN_PAREN",
  CLOSE_PAREN = "CLOSE_PAREN",
  OPEN_BRACE = "OPEN_BRACE",
  CLOSE_BRACE = "CLOSE_BRACE",
  OPEN_SQ = "OPEN_SQ",
  CLOSE_SQ = "CLOSE_SQ",
  COMMENT = "COMMENT",
  ARROW = "ARROW",
  SEMI_COLON = "SEMI_COLON",
}

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
export function EBNFTokenizer(input: string | CharTape): SimpleTokenizer {
  return new SimpleTokenizer(input)
    .addMatcher(spacesMatcher, true)
    .addMatcher(startStopMatcher(TokenType.COMMENT, "/*", "*/"), true) // Comments
    .addMatcher(singleLineCommentMatcher, true)
    .addMatcher(startStopMatcher(TokenType.STRING, "'", "'")) // Single quoted String
    .addMatcher(startStopMatcher(TokenType.STRING, '"', '"')) // Double quoted String
    .addMatcher(startStopMatcher(TokenType.REGEX, "/", "/")) //  Match regex between "/"s
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
  private tokenizer: SimpleTokenizer;
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
    let peeked = this.tokenizer.peek();
    while (peeked != null) {
      if (peeked.tag == TokenType.IDENT) {
        // declaration
        this.parseDecl(grammar);
      } else if (peeked.tag == TokenType.PCT_IDENT) {
        // Some kind of directive
        this.tokenizer.next();
        console.log("Here: ", peeked);
        TSU.assert(peeked.value == "skip", "Invalid directive: " + peeked.value);
        const next = this.tokenizer.expectToken(TokenType.STRING, TokenType.REGEX);
        // TODO - add next to skip list
      }
      peeked = this.tokenizer.peek();
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
        const label = "L:" + token.value;
        curr = new Str(grammar.getSym(label) || grammar.newTerm(label));
      } else if (this.tokenizer.nextMatches(TokenType.NUMBER)) {
        const token = this.tokenizer.next() as Token;
        const label = "L:" + token.value;
        curr = new Str(grammar.getSym(label) || grammar.newTerm(label));
      } else if (this.tokenizer.nextMatches(TokenType.REGEX)) {
        const token = this.tokenizer.next() as Token;
        const label = "R:" + token.value;
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

export const SingleChTokens = {
  "[": TokenType.OPEN_SQ,
  "]": TokenType.CLOSE_SQ,
  "(": TokenType.OPEN_PAREN,
  ")": TokenType.CLOSE_PAREN,
  "{": TokenType.OPEN_BRACE,
  "}": TokenType.CLOSE_BRACE,
  "*": TokenType.STAR,
  "+": TokenType.PLUS,
  "?": TokenType.QMARK,
  "|": TokenType.PIPE,
  ";": TokenType.SEMI_COLON,
} as TSU.StringMap<TokenType>;

export const ReservedChars = {
  "#": true,
  "&": true,
  "%": true,
  "@": true,
  ":": true,
  "!": true,
  "*": true,
  "~": true,
  "`": true,
  "'": true,
  ".": true,
  "^": true,
  "|": true,
  "?": true,
  "<": true,
  ">": true,
  $: true,
} as TSU.StringMap<boolean>;

export const isSpace = (ch: string): boolean => ch.trim() === "";
export const isDigit = (ch: string): boolean => ch >= "0" && ch <= "9";
export function isIdentChar(ch: string): boolean {
  if (ch in SingleChTokens) return false;
  if (ch in ReservedChars) return false;
  if (isSpace(ch)) return false;
  if (isDigit(ch)) return false;
  return true;
}

export function numberMatcher(tape: CharTape, offset: number): TSU.Nullable<Token> {
  if (!isDigit(tape.currCh)) return null;
  let out = "";
  while (tape.hasMore && isDigit(tape.currCh)) {
    out += tape.nextCh();
  }
  return new Token(TokenType.NUMBER, { value: parseInt(out) });
}

export function startStopMatcher(tokenType: TokenType, start: string, end: string): TokenMatcher {
  return (tape, offset) => {
    if (tape.matches(start) && tape.advanceAfter(end) >= 0) {
      return new Token(tokenType, { value: tape.substring(offset + start.length, tape.index - end.length) });
    }
    return null;
  };
}

export function identMatcher(tape: CharTape, offset: number): TSU.Nullable<Token> {
  const isPct = tape.currCh == "%";
  if (isPct) tape.nextCh();
  if (!isIdentChar(tape.currCh)) {
    if (isPct) {
      return new Token(TokenType.PCT_IDENT, { value: "" });
    } else {
      return null;
    }
  }
  // Combination of everything else
  let lit = tape.nextCh();
  while (tape.hasMore) {
    const currCh = tape.currCh;
    if (!isIdentChar(currCh) && !isDigit(currCh)) {
      break;
    }
    lit += tape.nextCh();
  }
  return new Token(isPct ? TokenType.PCT_IDENT : TokenType.IDENT, { value: lit });
}

export function spacesMatcher(tape: CharTape, offset: number): TSU.Nullable<Token> {
  let out = "";
  while (tape.hasMore && isSpace(tape.currCh)) {
    out += tape.nextCh();
  }
  if (out.length == 0) return null;
  return new Token(TokenType.SPACES, { value: out });
}

export function singleLineCommentMatcher(tape: CharTape, offset: number): TSU.Nullable<Token> {
  if (!tape.matches("//")) return null;
  while (tape.hasMore && tape.currCh != "\n") {
    tape.nextCh();
  }
  tape.nextCh(); // consume the "\n"
  return new Token(TokenType.COMMENT, { value: tape.substring(offset + 2, tape.index) });
}
