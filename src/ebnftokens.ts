import * as TSU from "@panyam/tsutils";
import { TokenMatcher, CharTape, Token } from "./tokenizer";
import { ParseError, UnexpectedTokenError } from "./errors";

export enum TokenType {
  STRING = "STRING",
  NUMBER = "NUMBER",
  SPACES = "SPACES",
  IDENT = "IDENT",
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
  if (!isIdentChar(tape.currCh)) return null;
  // Combination of everything else
  let lit = tape.nextCh();
  while (tape.hasMore) {
    const currCh = tape.currCh;
    if (!isIdentChar(currCh) && !isDigit(currCh)) {
      break;
    }
    lit += tape.nextCh();
  }
  return new Token(TokenType.IDENT, { value: lit });
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
