const util = require("util");
import * as TSU from "@panyam/tsutils";
import { Rule } from "../core";
import { parse } from "../parser";
import { Prog } from "../vm";
import { InstrDebugValue, Compiler } from "../pikevm";

function testRegexCompile(prog: Prog, expected: Prog | null, debug = false, enforce = true): Prog {
  if (debug || expected == null) {
    console.log(
      "Found Value: \n",
      util.inspect(prog.reprString, {
        showHidden: false,
        depth: null,
        maxArrayLength: null,
        maxStringLength: null,
      }),
      "\nExpected Value: \n",
      util.inspect(expected?.reprString, {
        showHidden: false,
        depth: null,
        maxArrayLength: null,
        maxStringLength: null,
      }),
    );
    console.log(`Found Debug Value: \n${prog.debugValue(InstrDebugValue).join("\n")}`);
  }
  if (enforce) expect(prog).toEqual(expected);
  return prog;
}

function compile(exprResolver: null | ((name: string) => Rule), ...rules: Rule[]): Prog {
  const out = new Compiler(exprResolver);
  rules.forEach((rule) => (rule.expr = parse(rule.pattern)));
  return out.compile(rules);
}

describe("Regex Compile Tests", () => {
  test("Test Chars", () => {
    testRegexCompile(
      compile(null, new Rule("abcde", 0)),
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(5, 97, 97);
        p.add(5, 98, 98);
        p.add(5, 99, 99);
        p.add(5, 100, 100);
        p.add(5, 101, 101);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });

  test("Test Escape Chars", () => {
    testRegexCompile(
      compile(null, new Rule("\\n\\r\\t\\f\\b\\\\\\\"\\'\\x32\\y", 0)),
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(5, 10, 10);
        p.add(5, 13, 13);
        p.add(5, 9, 9);
        p.add(5, 12, 12);
        p.add(5, 8, 8);
        p.add(5, 92, 92);
        p.add(5, 34, 34);
        p.add(5, 39, 39);
        p.add(5, 50, 50);
        p.add(5, 121, 121);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });

  test("Test Union", () => {
    testRegexCompile(
      compile(null, new Rule("a|b|c|d|e", 0)),
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(8, 3, 5, 7, 9, 11);
        p.add(5, 97, 97);
        p.add(9, 12);
        p.add(5, 98, 98);
        p.add(9, 12);
        p.add(5, 99, 99);
        p.add(9, 12);
        p.add(5, 100, 100);
        p.add(9, 12);
        p.add(5, 101, 101);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });

  test("Test Quants - a*", () => {
    testRegexCompile(
      compile(null, new Rule("a*", 0)),
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(8, 9);
        p.add(12);
        p.add(5, 97, 97);
        p.add(13, 3);
        p.add(11, 3, 4294967295, 8);
        p.add(8, 4, 8);
        p.add(14, 3);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });

  test("Test Quants - a+", () => {
    testRegexCompile(
      compile(null, new Rule("a+", 0)),
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(12);
        p.add(5, 97, 97);
        p.add(13, 2);
        p.add(10, 2, 1, 3);
        p.add(11, 2, 4294967295, 8);
        p.add(8, 3, 8);
        p.add(14, 2);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });

  test("Test Quants - a?", () => {
    testRegexCompile(
      compile(null, new Rule("a?", 0)),
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(8, 9);
        p.add(12);
        p.add(5, 97, 97);
        p.add(13, 3);
        p.add(11, 3, 0, 8);
        p.add(8, 4, 8);
        p.add(14, 3);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });

  test("Test Quants - (ab){10,20}", () => {
    testRegexCompile(
      compile(null, new Rule("(ab){10,20}", 0)),
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(12);
        p.add(5, 97, 97);
        p.add(5, 98, 98);
        p.add(13, 2);
        p.add(10, 2, 10, 3);
        p.add(11, 2, 19, 9);
        p.add(8, 3, 9);
        p.add(14, 2);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });

  test("Test Char Classes", () => {
    testRegexCompile(
      compile(null, new Rule("[a-c]", 0)),
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(6, 97, 99);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
    testRegexCompile(
      compile(null, new Rule("[a-cb-j]", 0)),
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(6, 97, 106);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
    testRegexCompile(
      compile(null, new Rule("[a-cm-q]", 0)),
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(6, 97, 99, 109, 113);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });

  test("Test Special Char Classes", () => {
    testRegexCompile(
      compile(null, new Rule(".", 0)),
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(2);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
    testRegexCompile(
      compile(null, new Rule("^.$", 0)),
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(2);
        p.add(16, 1, 0, 0, 5);
        p.add(4);
        p.add(17, 3);
        p.add(16, 0, 0, 0, 8);
        p.add(3);
        p.add(17, 6);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });

  test("Test Named Groups", () => {
    const r1 = new Rule("abcde", null, "Hello");
    const prog = compile((name) => r1, r1, new Rule("<Hello  >", 10));
    testRegexCompile(
      prog,
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(5, 97, 97);
        p.add(5, 98, 98);
        p.add(5, 99, 99);
        p.add(5, 100, 100);
        p.add(5, 101, 101);
        p.add(7, 1);
        p.add(0, 10, 1);
      }),
    );
  });

  test("Test Lookahead Assertions", () => {
    testRegexCompile(
      compile(null, new Rule("abc(?=hello)", 0)),
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(5, 97, 97);
        p.add(5, 98, 98);
        p.add(5, 99, 99);
        p.add(16, 1, 0, 0, 11);
        p.add(5, 104, 104);
        p.add(5, 101, 101);
        p.add(5, 108, 108);
        p.add(5, 108, 108);
        p.add(5, 111, 111);
        p.add(17, 5);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });

  test("Test Negative Lookahead Assertions", () => {
    const lexer = compile(null, new Rule("abc(?!hello)", 0));
    testRegexCompile(
      lexer,
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(5, 97, 97);
        p.add(5, 98, 98);
        p.add(5, 99, 99);
        p.add(16, 1, 0, 1, 11);
        p.add(5, 104, 104);
        p.add(5, 101, 101);
        p.add(5, 108, 108);
        p.add(5, 108, 108);
        p.add(5, 111, 111);
        p.add(17, 5);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });

  test("Test Negatie Lookahead Assertions", () => {
    const lexer = compile(null, new Rule("abc(?!hello)", 0));
    testRegexCompile(
      lexer,
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(5, 97, 97);
        p.add(5, 98, 98);
        p.add(5, 99, 99);
        p.add(16, 1, 0, 1, 11);
        p.add(5, 104, 104);
        p.add(5, 101, 101);
        p.add(5, 108, 108);
        p.add(5, 108, 108);
        p.add(5, 111, 111);
        p.add(17, 5);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });

  test("Test Negative Lookback Assertions", () => {
    const lexer = compile(null, new Rule("(?<!h*ell+o)abc", 0));
    testRegexCompile(
      lexer,
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(5, 97, 97);
        p.add(5, 98, 98);
        p.add(5, 99, 99);
        p.add(16, 0, 0, 1, 23);
        p.add(5, 111, 111);
        p.add(12);
        p.add(5, 108, 108);
        p.add(13, 7);
        p.add(10, 7, 1, 8);
        p.add(11, 7, 4294967295, 13);
        p.add(8, 8, 13);
        p.add(14, 7);
        p.add(5, 108, 108);
        p.add(5, 101, 101);
        p.add(8, 23);
        p.add(12);
        p.add(5, 104, 104);
        p.add(13, 17);
        p.add(11, 17, 4294967295, 22);
        p.add(8, 18, 22);
        p.add(14, 17);
        p.add(17, 5);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });

  test("Test LookBack Assertions", () => {
    const prog = compile(null, new Rule("(?<=h*ell+o)abc", 0));
    testRegexCompile(
      prog,
      Prog.with((p) => {
        p.add(8, 1);
        p.add(7, 0);
        p.add(5, 97, 97);
        p.add(5, 98, 98);
        p.add(5, 99, 99);
        p.add(16, 0, 0, 0, 23);
        p.add(5, 111, 111);
        p.add(12);
        p.add(5, 108, 108);
        p.add(13, 7);
        p.add(10, 7, 1, 8);
        p.add(11, 7, 4294967295, 13);
        p.add(8, 8, 13);
        p.add(14, 7);
        p.add(5, 108, 108);
        p.add(5, 101, 101);
        p.add(8, 23);
        p.add(12);
        p.add(5, 104, 104);
        p.add(13, 17);
        p.add(11, 17, 4294967295, 22);
        p.add(8, 18, 22);
        p.add(14, 17);
        p.add(17, 5);
        p.add(7, 1);
        p.add(0, 10, 0);
      }),
    );
  });
});
