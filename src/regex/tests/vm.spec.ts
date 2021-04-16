const util = require("util");
import * as TSU from "@panyam/tsutils";
import { Rule } from "../core";
import { parse } from "../parser";
import { Prog } from "../vm";
import { Tape } from "../../tape";
import { InstrDebugValue, Compiler, VM } from "../pikevm";

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
    const prog = compile(null, new Rule("abcde", 0));
    const tape = new Tape("abcdeabcde");
    const vm = new VM(prog);
    let next = vm.match(tape);
    while (next != null) {
      console.log("Match: ", next, `Token: '${tape.substring(next.start, next.end)}'`);
      next = vm.match(tape);
    }
  });
});
