const util = require("util");
import * as TSU from "@panyam/tsutils";
import { Regex, Char, CharRange } from "../core";
import { parse } from "../parser";

function testRegex(input: string, expected: any, debug = false, enforce = true): Regex {
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
    testRegex("abcde", ["Cat", ["a", "b", "c", "d", "e"]]);
    expect(new Char(10, 20).compareTo(new Char(10, 40))).toBeLessThan(0);
    expect(new Char(20, 20).compareTo(new Char(10, 40))).toBeGreaterThan(0);
    testRegex("\\x32\\u2028", ["Cat", ["2", "\u2028"]]);
  });

  test("Test Escape Chars", () => {
    testRegex("\\n\\r\\t\\f\\b\\\\\\\"\\'\\x32\\y", ["Cat", ["\n", "\r", "\t", "\f", "\b", "\\", '"', "'", "2", "y"]]);
  });

  test("Test Cat", () => {
    testRegex("a(b(c(d(e))))", ["Cat", ["a", "b", "c", "d", "e"]]);
  });

  test("Test Union", () => {
    testRegex("a|b|c|d|e", ["Union", ["a", "b", "c", "d", "e"]]);
  });

  test("Test Named Refs", () => {
    testRegex("a|b|<Hello>|e", ["Union", ["a", "b", "<Hello>", "e"]]);
    expect(() => testRegex("<  >", [])).toThrowError();
  });

  test("Test Grouping", () => {
    testRegex("a|b|(c|d)|e", ["Union", ["a", "b", "c", "d", "e"]]);
  });

  test("Test Quants", () => {
    testRegex("a*", ["Quant", ["a", "*"]]);
    testRegex("a+", ["Quant", ["a", "+"]]);
    testRegex("a?", ["Quant", ["a", "?"]]);
    testRegex("abc*?", ["Cat", ["a", "b", ["QuantLazy", ["c", "*"]]]]);
    testRegex("a(bc){10, 20}", ["Cat", ["a", ["Quant", [["Cat", ["b", "c"]], "{10,20}"]]]]);
    testRegex("a(bc){10}", ["Cat", ["a", ["Quant", [["Cat", ["b", "c"]], "{10,10}"]]]]);
    testRegex("a(bc){,10}", ["Cat", ["a", ["Quant", [["Cat", ["b", "c"]], "{0,10}"]]]]);
    testRegex("((ab)*)*", ["Quant", [["Cat", ["a", "b"]], "*"]]);
    expect(() => testRegex("a{1,2,3}", [])).toThrowError();
  });

  test("Test Char Ranges", () => {
    testRegex("[a-c]", ["a-c"]);
    const ch = new CharRange();
    ch.add(new Char(90, 200));
    ch.add(new Char(10, 20));
    ch.add(new Char(50, 150));
    expect(ch.chars.length).toBe(2);
    expect(ch.chars[0].start).toBe(10);
    expect(ch.chars[0].end).toBe(20);
    expect(ch.chars[1].start).toBe(50);
    expect(ch.chars[1].end).toBe(200);
  });

  test("Test Special Char Ranges", () => {
    testRegex(".", ".");
    testRegex("^.$", ["Cat", ["^", ".", "$"]]);
  });

  test("Test LookAheads", () => {
    testRegex("abc(?=hello)", ["Cat", ["a", "b", "c", ["LookAhead", ["Cat", ["h", "e", "l", "l", "o"]]]]]);
    testRegex("hello(?!world)", ["Cat", ["h", "e", "l", "l", "o", ["LookAhead!", ["Cat", ["w", "o", "r", "l", "d"]]]]]);
  });

  test("Test LookBacks", () => {
    testRegex("(?<=hello)world", ["Cat", [["LookBack", ["Cat", ["h", "e", "l", "l", "o"]]], "w", "o", "r", "l", "d"]]);
    testRegex("(?<!hello)world", ["Cat", [["LookBack!", ["Cat", ["h", "e", "l", "l", "o"]]], "w", "o", "r", "l", "d"]]);
  });
});
