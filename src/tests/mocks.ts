import { Token, NextTokenFunc } from "../tokenizer";

export function mockTokenizer(...tokens: Token[]): NextTokenFunc {
  let current = 0;
  return () => {
    return tokens[current++] || null;
  };
}
