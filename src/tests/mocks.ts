import * as TSU from "@panyam/tsutils";
import { Tokenizer } from "../parser";
import { Token } from "../tokenizer";

type Nullable<T> = TSU.Nullable<T>;

export class MockTokenizer implements Tokenizer {
  tokens: Token[];
  current = 0;
  peeked: Nullable<Token> = null;
  constructor(...tokens: Token[]) {
    this.tokens = tokens;
  }

  peek(): Nullable<Token> {
    if (!this.peeked && this.current < this.tokens.length) {
      this.peeked = this.tokens[this.current];
    }
    return this.peeked;
  }

  next(): Nullable<Token> {
    const out = this.peek();
    this.peeked = null;
    this.current++;
    return out;
  }
}
