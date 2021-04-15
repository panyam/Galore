const util = require("util");
import * as TSU from "@panyam/tsutils";
import { parse, Expr, Char, CharClass, Lexer, Rule } from "../regex";
import { Prog } from "../pikevm";

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

function testRegexCompile(input: string, expected: any, debug = false, enforce = true): Prog {
  const lexer = new Lexer();
  lexer.add(new Rule(input, "Test"));
  const prog = lexer.compile();
  if (debug || expected.length == 0) {
    console.log(
      "Found Value: \n",
      util.inspect(prog.debugValue, {
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
    console.log(`Found Value Formatted (${input}): \n${prog.debugValue.join("\n")}`);
  }
  if (enforce) expect(prog.debugValue).toEqual(expected);
  return prog;
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

  test("Test Named Groups", () => {
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

  test("Test Char Classes", () => {
    testRegex("[a-c]", ["a-c"]);
    const ch = new CharClass();
    ch.add(new Char(90, 200));
    ch.add(new Char(10, 20));
    ch.add(new Char(50, 150));
    expect(ch.chars.length).toBe(2);
    expect(ch.chars[0].start).toBe(10);
    expect(ch.chars[0].end).toBe(20);
    expect(ch.chars[1].start).toBe(50);
    expect(ch.chars[1].end).toBe(200);
  });

  test("Test Special Char Classes", () => {
    testRegex(".", ".");
    testRegex("^.$", [[["Cat", ["."]], "IF_BEFORE", "$"], "IF_AFTER", "^"]);
  });

  test("Test Lookahead Assertions", () => {
    testRegex("abc(?=hello)", [["Cat", ["a", "b", "c"]], "IF_BEFORE", ["Cat", ["h", "e", "l", "l", "o"]]]);
    testRegex("hello(?!world)", [
      ["Cat", ["h", "e", "l", "l", "o"]],
      "IF_BEFORE",
      ["NOT", ["Cat", ["w", "o", "r", "l", "d"]]],
    ]);
  });

  test("Test LookBack Assertions", () => {
    testRegex("(?<=hello)world", [["Cat", ["w", "o", "r", "l", "d"]], "IF_AFTER", ["Cat", ["h", "e", "l", "l", "o"]]]);
    testRegex("(?<!hello)world", [
      ["Cat", ["w", "o", "r", "l", "d"]],
      "IF_AFTER",
      ["NOT", ["Cat", ["h", "e", "l", "l", "o"]]],
    ]);
  });
});

describe("Regex Compile Tests", () => {
  test("Test Chars", () => {
    testRegexCompile("abcde", [
      "L0: Split 1",
      "L1: Save 0",
      "L2: Char 61",
      "L3: Char 62",
      "L4: Char 63",
      "L5: Char 64",
      "L6: Char 65",
      "L7: Save 1",
      "L8: Match 10 0",
    ]);
  });

  test("Test Escape Chars", () => {
    testRegexCompile("\\n\\r\\t\\f\\b\\\\\\\"\\'\\x32\\y", [
      "L0: Split 1",
      "L1: Save 0",
      "L2: Char a",
      "L3: Char d",
      "L4: Char 9",
      "L5: Char c",
      "L6: Char 8",
      "L7: Char 5c",
      "L8: Char 22",
      "L9: Char 27",
      "L10: Char 32",
      "L11: Char 79",
      "L12: Save 1",
      "L13: Match 10 0",
    ]);
  });

  test("Test Union", () => {
    testRegexCompile("a|b|c|d|e", [
      "L0: Split 1",
      "L1: Save 0",
      "L2: Split 3, 5, 7, 9, 11",
      "L3: Char 61",
      "L4: Jump 12",
      "L5: Char 62",
      "L6: Jump 12",
      "L7: Char 63",
      "L8: Jump 12",
      "L9: Char 64",
      "L10: Jump 12",
      "L11: Char 65",
      "L12: Save 1",
      "L13: Match 10 0",
    ]);
  });

  test("Test Quants - a*", () => {
    testRegexCompile("a*", [
      "L0: Split 1",
      "L1: Save 0",
      "L2: Split 9",
      "L3: RegAcquire",
      "L4: Char 61",
      "L5: RegInc L3",
      "L6: JumpIfGt L3 4294967295 L8",
      "L7: Split 4, 8",
      "L8: RegRelease L3",
      "L9: Save 1",
      "L10: Match 10 0",
    ]);
  });

  test("Test Quants - a+", () => {
    testRegexCompile("a+", [
      "L0: Split 1",
      "L1: Save 0",
      "L2: RegAcquire",
      "L3: Char 61",
      "L4: RegInc L2",
      "L5: JumpIfLt L2 1 L3",
      "L6: JumpIfGt L2 4294967295 L8",
      "L7: Split 3, 8",
      "L8: RegRelease L2",
      "L9: Save 1",
      "L10: Match 10 0",
    ]);
  });

  test("Test Quants - a?", () => {
    testRegexCompile("a?", [
      "L0: Split 1",
      "L1: Save 0",
      "L2: Split 9",
      "L3: RegAcquire",
      "L4: Char 61",
      "L5: RegInc L3",
      "L6: JumpIfGt L3 0 L8",
      "L7: Split 4, 8",
      "L8: RegRelease L3",
      "L9: Save 1",
      "L10: Match 10 0",
    ]);
  });

  test("Test Quants - (ab){10,20}", () => {
    testRegexCompile("(ab){10,20}", [
      "L0: Split 1",
      "L1: Save 0",
      "L2: RegAcquire",
      "L3: Char 61",
      "L4: Char 62",
      "L5: RegInc L2",
      "L6: JumpIfLt L2 10 L3",
      "L7: JumpIfGt L2 19 L9",
      "L8: Split 3, 9",
      "L9: RegRelease L2",
      "L10: Save 1",
      "L11: Match 10 0",
    ]);
  });

  test("Test Char Classes", () => {
    testRegexCompile("[a-c]", ["L0: Split 1", "L1: Save 0", "L2: CharClass 61-63", "L3: Save 1", "L4: Match 10 0"]);
    testRegexCompile("[a-cb-j]", ["L0: Split 1", "L1: Save 0", "L2: CharClass 61-6a", "L3: Save 1", "L4: Match 10 0"]);
    testRegexCompile("[a-cm-q]", [
      "L0: Split 1",
      "L1: Save 0",
      "L2: CharClass 61-63 6d-71",
      "L3: Save 1",
      "L4: Match 10 0",
    ]);
  });

  test("Test Special Char Classes", () => {
    testRegexCompile(".", ["L0: Split 1", "L1: Save 0", "L2: .", "L3: Save 1", "L4: Match 10 0"]);
    // testRegexCompile("^.$", []);
  });

  test("Test Named Groups", () => {
    const lexer = new Lexer();
    lexer.add(new Rule("abcde", null, "Hello"));
    lexer.add(new Rule("<Hello  >", 10));
    const prog = lexer.compile();
    expect(prog.debugValue).toEqual([
      "L0: Split 1",
      "L1: Save 0",
      "L2: Char 61",
      "L3: Char 62",
      "L4: Char 63",
      "L5: Char 64",
      "L6: Char 65",
      "L7: Save 1",
      "L8: Match 10 1",
    ]);
  });

  /*

  test("Test Lookahead Assertions", () => {
    testRegex("abc(?=hello)", [["Cat", ["a", "b", "c"]], "IF_BEFORE", ["Cat", ["h", "e", "l", "l", "o"]]]);
    testRegex("hello(?!world)", [
      ["Cat", ["h", "e", "l", "l", "o"]],
      "IF_BEFORE",
      ["NOT", ["Cat", ["w", "o", "r", "l", "d"]]],
    ]);
  });

  test("Test LookBack Assertions", () => {
    testRegex("(?<=hello)world", [["Cat", ["w", "o", "r", "l", "d"]], "IF_AFTER", ["Cat", ["h", "e", "l", "l", "o"]]]);
    testRegex("(?<!hello)world", [
      ["Cat", ["w", "o", "r", "l", "d"]],
      "IF_AFTER",
      ["NOT", ["Cat", ["h", "e", "l", "l", "o"]]],
    ]);
  });
  */
});
