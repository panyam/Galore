const util = require("util");
import * as TSU from "@panyam/tsutils";
import { Rule } from "../core";
import { parse } from "../parser";
import { Prog, Instr } from "../vm";
import { Tape } from "../../tape";
import { InstrDebugValue, Compiler, VM, Thread } from "../pikevm";

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

function compile(exprResolver: null | ((name: string) => Rule), ...patterns: (Rule | string)[]): Prog {
  const out = new Compiler(exprResolver);
  const rules = patterns.map((pattern, index) => {
    const rule = typeof pattern === "string" ? new Rule(pattern, index) : pattern;
    rule.expr = parse(rule.pattern);
    return rule;
  });
  return out.compile(rules);
}

class VMTracer {
  trace: string[] = [];
  threadDequeued(thread: Thread, tapeIndex: number): void {
    this.trace.push(
      `Popping Thread (ID: ${thread.id}, Offset: ${thread.offset}, Parent: ${thread.parentId}), TapeIndex: ${tapeIndex}`,
    );
  }

  threadQueued(thread: Thread, tapeIndex: number): void {
    this.trace.push(
      `Pushing Thread (ID: ${thread.id}, Offset: ${thread.offset}, Parent: ${thread.parentId}), TapeIndex: ${tapeIndex}`,
    );
  }
}

function testInput(prog: Prog, input: string, expectedTokens: string[], debug = false): void {
  const tape = new Tape(input);
  const vm = new VM(prog);
  const tracer = new VMTracer();
  if (debug || expectedTokens.length == 0) {
    console.log(
      "Prog: \n",
      `${prog.debugValue(InstrDebugValue).join("\n")}`,
      "\n",
      "\n",
      "Input: ",
      input,
      "\n",
      "Expected Tokens: ",
      expectedTokens,
    );
    vm.tracer = tracer;
  }
  const found = [] as string[];
  let next = vm.match(tape);
  while (next != null && next.end > next.start) {
    found.push(tape.substring(next.start, next.end));
    next = vm.match(tape);
  }
  if (debug || expectedTokens.length == 0) {
    console.log("VM Tracer: ");
    console.log(tracer.trace.join("\n"));
    console.log("Found Tokens: ", found);
  }
  expect(found).toEqual(expectedTokens);
}

describe("VM Tests", () => {
  test("Test Chars", () => {
    const prog = compile(null, "abcde");
    testInput(prog, "abcdeabcde", ["abcde", "abcde"]);
  });

  test("Test Chars Classes", () => {
    const prog = compile(null, "[a-e]");
    testInput(prog, "abcdeabcde", ["a", "b", "c", "d", "e", "a", "b", "c", "d", "e"]);
  });

  test("Test a*", () => {
    const prog = compile(null, "a*");
    testInput(prog, "aaaaa", ["aaaaa"]);
  });

  test("Test a{3}", () => {
    const prog = compile(null, "a{3}");
    testInput(prog, "aaaaaa", ["aaa", "aaa"]);
  });

  test("Test (a|b)*", () => {
    const prog = compile(null, "(a|b)*");
    testInput(prog, "abbbaaaba", ["abbbaaaba"]);
  });

  test("Test (a|b){0, 10}?", () => {
    const prog = compile(null, "(a|b){0,2}?");
    testInput(prog, "abbbaaaba", ["ab", "bb", "aa", "ab", "a"]);
  });

  test("Test a,b,c,d,e", () => {
    const prog = compile(null, "a", "b", "c", "d", "e");
    testInput(prog, "edcbaabcde", ["e", "d", "c", "b", "a", "a", "b", "c", "d", "e"]);
  });

  test("Test a*?", () => {
    const prog = compile(null, "a*?", "aa");
    testInput(prog, "aaaaa", ["a", "a", "a", "a", "a"]);
  });

  test("Test Comments", () => {
    const prog = compile(null, `/\\*.*?\\*/`, `[ \t\n\r]+`);
    // const prog = compile(null, `/\*.*\*/`, `\"(?<!\\\\)\"`, "//.*$");
    testInput(
      prog,
      `/* hello comment in one line */   /** How about multi line?
              
              */  `,
      ["/* hello comment in one line */", "   ", "/** How about multi line?\n              \n              */", "  "],
    );
  });
});
