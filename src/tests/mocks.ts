/**
 * @jest-environment jsdom
 */
import * as TLEX from "tlex";

export function mockTokenizer(...tokens: TLEX.Token[]): TLEX.NextTokenFunc {
  let current = 0;
  return () => {
    return tokens[current++] || null;
  };
}
