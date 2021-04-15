const util = require("util");
import * as TSU from "@panyam/tsutils";
import { parse, Expr, Char } from "../regex";

function testRegex(input: string, expected: any, debug = false, enforce = true): Expr {
  const found = parse(input);
  if (debug) {
    console.log(
      "Found Value: \n",
      util.inspect(found.debugValue, {
        showHidden: false,
        depth: null,
        maxArrayLength: null,
        maxStringLength: null,
      }),
      "\nExpected Value: \n",
      util.inspect(expected, {
        showHidden: false,
        depth: null,
        maxArrayLength: null,
        maxStringLength: null,
      }),
    );
  }
  if (enforce) expect(found.debugValue).toEqual(expected);
  return found;
}

describe("Regex Tests", () => {
  test("Test Chars", () => {
    testRegex("abcde\\n\\r\\t\\f\\b\\\\\\\"\\'\\x32", [
      "Cat",
      ["a", "b", "c", "d", "e", "\n", "\r", "\t", "\f", "\b", "\\", '"', "'", "2"],
    ]);
    expect(new Char(10, 20).compareTo(new Char(10, 40))).toBeLessThan(0);
    expect(new Char(20, 20).compareTo(new Char(10, 40))).toBeGreaterThan(0);
    testRegex("\\x32\\u2028", ["Cat", ["2", "\u2028"]]);
  });

  test("Test Union", () => {
    testRegex("a|b|c|d|e", ["Union", ["a", "b", "c", "d", "e"]]);
  });

  test("Test Named Groups", () => {
    testRegex("a|b|<Hello>|e", ["Union", ["a", "b", "<Hello>", "e"]]);
  });

  test("Test Grouping", () => {
    testRegex("a|b|(c|d)|e", ["Union", ["a", "b", "c", "d", "e"]]);
  });

  test("Test Quants", () => {
    testRegex("a*", ["Quant", ["a", "*"]]);
    testRegex("a+", ["Quant", ["a", "+"]]);
    testRegex("abc*?", ["Cat", ["a", "b", ["QuantLazy", ["c", "*"]]]]);
    testRegex("a(bc){10, 20}", ["Cat", ["a", ["Quant", [["Cat", ["b", "c"]], "{10,20}"]]]]);
  });
});
