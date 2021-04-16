import * as TSU from "@panyam/tsutils";
import { ParseError, UnexpectedTokenError } from "./errors";
import { Tape } from "./tape";

type TokenType = number | string;

export class Token {
  readonly tag: TokenType;
  value?: any;
  // Location info
  offset: number;
  length: number;

  constructor(type: TokenType, options: any = null) {
    options = options || {};
    this.tag = type;
    this.value = options.value || 0;
    this.offset = options.offset || 0;
    this.length = options.length || 0;
  }

  isOneOf(...expected: any[]): boolean {
    for (const tok of expected) {
      if (this.tag == tok) {
        return true;
      }
    }
    return false;
  }

  immediatelyFollows(another: Token): boolean {
    return this.offset == another.offset + another.length;
  }
}

export type NextTokenFunc = () => TSU.Nullable<Token>;
export type TokenMatcher = (_: Tape, pos: number) => TSU.Nullable<Token>;

/**
 * A wrapper on a tokenizer for providing features like k-lookahead, token
 * insertion, rewinding, expectation enforcement etc.
 */
export class TokenBuffer {
  nextToken: NextTokenFunc;
  buffer: Token[] = [];

  constructor(nextToken: NextTokenFunc) {
    this.nextToken = nextToken;
  }

  next(): TSU.Nullable<Token> {
    const out = this.peek();
    if (out != null) {
      this.consume();
    }
    return out;
  }

  /**
   * Peek at the nth token in the token stream.
   */
  peek(nth = 0): TSU.Nullable<Token> {
    while (this.buffer.length <= nth) {
      const tok = this.nextToken();
      if (tok == null) return null;
      this.buffer.push(tok);
    }
    return this.buffer[nth];
  }

  match(
    matchFunc: (token: Token) => boolean,
    ensure = false,
    consume = true,
    nextAction?: (token: Token) => boolean | undefined,
  ): TSU.Nullable<Token> {
    const token = this.peek();
    if (token != null) {
      if (matchFunc(token)) {
        if (nextAction && nextAction != null) {
          nextAction(token);
        }
        if (consume) {
          this.consume();
        }
      } else if (ensure) {
        // Should we throw an error?
        throw new UnexpectedTokenError(token);
      } else {
        return null;
      }
    } else if (ensure) {
      throw new ParseError(-1, "Unexpected end of input.");
    }
    return token;
  }

  consume(): void {
    this.buffer.splice(0, 1);
  }

  consumeIf(...expected: TokenType[]): TSU.Nullable<Token> {
    return this.match((t) => t.isOneOf(...expected));
  }

  expectToken(...expected: TokenType[]): Token {
    return this.match((t) => t.isOneOf(...expected), true, true) as Token;
  }

  ensureToken(...expected: TokenType[]): Token {
    return this.match((t) => t.isOneOf(...expected), true, false) as Token;
  }

  nextMatches(...expected: TokenType[]): TSU.Nullable<Token> {
    const token = this.peek();
    if (token == null) return null;
    for (const tok of expected) {
      if (token.tag == tok) return token;
    }
    return null;
  }
}

/**
 * A simple tokenize that matches the input to a set of matchers one by one.
 */
export class SimpleTokenizer {
  private peekedToken: TSU.Nullable<Token> = null;
  tape: Tape;
  // TODO  - convert literals into a trie
  literals: [string, TokenType][] = [];
  matchers: [TokenMatcher, boolean][] = [];

  constructor(tape: string | Tape) {
    if (typeof tape === "string") {
      tape = new Tape(tape);
    }
    this.tape = tape;
  }

  addMatcher(matcher: TokenMatcher, skip = false): this {
    this.matchers.push([matcher, skip]);
    return this;
  }

  addLiteral(lit: string, tokType: TokenType): number {
    const index = this.literals.findIndex((k) => k[0] == lit);
    if (index < 0) {
      this.literals.push([lit, tokType]);
      return this.literals.length - 1;
    } else {
      if (this.literals[index][1] != tokType) {
        throw new Error(`Literal '${lit}' already registered as ${tokType}`);
      }
      return index;
    }
  }

  /**
   * Performs the real work of extracting the next token from
   * the tape based on the current state of the tokenizer.
   * This can be overridden to do any other matchings to be prioritized first.
   * Returns NULL if end of input reached.
   */
  nextToken(): TSU.Nullable<Token> {
    // go through all literals first
    if (!this.tape.hasMore) return null;
    const pos = this.tape.index;
    // const line = this.tape.currLine;
    // const col = this.tape.currCol;
    for (const [kwd, toktype] of this.literals) {
      if (this.tape.matches(kwd)) {
        return new Token(toktype, {
          offset: pos,
          length: this.tape.index - pos,
          value: kwd,
        });
      }
    }
    for (const [matcher, skip] of this.matchers) {
      const token = matcher(this.tape, pos);
      if (token != null) {
        if (skip) {
          return this.nextToken();
        } else {
          token.offset = pos;
          token.length = this.tape.index - pos;
          return token;
        }
      }
    }
    // Fall through - error char found
    // throw new Error(`Line ${this.tape.currLine}, Col ${this.tape.currCol} - Invalid character: ${this.tape.currCh}`);
    throw new ParseError(this.tape.index, `Invalid character: [${this.tape.currCh}]`);
  }
}
