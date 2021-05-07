import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";

type Tape = TLEX.Tape;
type SimpleTokenizer = TLEX.Misc.SimpleTokenizer;

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

/**
 * Tokenizer with matchers specific to EBNF
 */
export function EBNFTokenizer(input: string | Tape): SimpleTokenizer {
  return new TLEX.Misc.SimpleTokenizer(input)
    .addMatcher(spacesMatcher, true)
    .addMatcher(startStopMatcher(TokenType.COMMENT, "/*", "*/"), true) // Comments
    .addMatcher(singleLineCommentMatcher, true)
    .addMatcher(startStopMatcher(TokenType.STRING, "'", "'")) // Single quoted String
    .addMatcher(startStopMatcher(TokenType.STRING, '"', '"')) // Double quoted String
    .addMatcher(startStopMatcher(TokenType.REGEX, "/", "/")) //  Match regex between "/"s
    .addMatcher((tape: TLEX.Tape, offset: number) => {
      if (!TLEX.TapeHelper.matches(tape, "->")) return null;
      const tok = new TLEX.Token(TokenType.ARROW, 0, 0, 0);
      tok.value = "->";
      return tok;
    })
    .addMatcher(numberMatcher)
    .addMatcher(identMatcher)
    .addMatcher((tape: TLEX.Tape, offset: number) => {
      if (!(tape.currCh in SingleChTokens)) return null;
      const tok = new TLEX.Token(SingleChTokens[tape.currCh], 0, 0, 0);
      tok.value = tape.nextCh;
      return tok;
    });
}

export function numberMatcher(tape: Tape, offset: number): TSU.Nullable<TLEX.Token> {
  if (!isDigit(tape.currCh)) return null;
  let out = "";
  while (tape.hasMore && isDigit(tape.currCh)) {
    out += tape.nextCh;
  }
  const tok = new TLEX.Token(TokenType.NUMBER, 0, 0, 0);
  tok.value = parseInt(out);
  return tok;
}

export function startStopMatcher(tokenType: TokenType, start: string, end: string): TLEX.Misc.TokenMatcher {
  return (tape: TLEX.Tape, offset: number) => {
    if (TLEX.TapeHelper.matches(tape, start) && TLEX.TapeHelper.advanceAfter(tape, end) >= 0) {
      const tok = new TLEX.Token(tokenType, 0, 0, 0);
      tok.value = tape.substring(offset + start.length, tape.index - end.length);
      return tok;
    }
    return null;
  };
}

export function identMatcher(tape: Tape, offset: number): TSU.Nullable<TLEX.Token> {
  const isPct = tape.currCh == "%";
  if (isPct) tape.nextCh;
  if (!isIdentChar(tape.currCh)) {
    if (isPct) {
      const tok = new TLEX.Token(TokenType.PCT_IDENT, 0, 0, 0);
      tok.value = "";
      return tok;
    } else {
      return null;
    }
  }
  // Combination of everything else
  let lit = tape.nextCh;
  while (tape.hasMore) {
    const currCh = tape.currCh;
    if (!isIdentChar(currCh) && !isDigit(currCh)) {
      break;
    }
    lit += tape.nextCh;
  }
  const tok = new TLEX.Token(isPct ? TokenType.PCT_IDENT : TokenType.IDENT, 0, 0, 0);
  tok.value = lit;
  return tok;
}

export function spacesMatcher(tape: Tape, offset: number): TSU.Nullable<TLEX.Token> {
  let out = "";
  while (tape.hasMore && isSpace(tape.currCh)) {
    out += tape.nextCh;
  }
  if (out.length == 0) return null;
  const tok = new TLEX.Token(TokenType.SPACES, 0, 0, 0);
  tok.value = out;
  return tok;
}

export function singleLineCommentMatcher(tape: Tape, offset: number): TSU.Nullable<TLEX.Token> {
  if (!TLEX.TapeHelper.matches(tape, "//")) return null;
  while (tape.hasMore && tape.currCh != "\n") {
    tape.nextCh;
  }
  tape.nextCh; // consume the "\n"
  const tok = new TLEX.Token(TokenType.COMMENT, 0, 0, 0);
  tok.value = tape.substring(offset + 2, tape.index);
  return tok;
}
