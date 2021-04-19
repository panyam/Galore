const util = require("util");
import fs from "fs";
import * as TSU from "@panyam/tsutils";
import { Regex, Rule } from "../core";
import { parse } from "../parser";
import { Prog, Instr } from "../vm";
import { Tape } from "../../tape";
import { InstrDebugValue, Compiler, VM, Thread } from "../pikevm";

function compile(exprResolver: null | ((name: string) => Rule), ...patterns: (Rule | string)[]): Prog {
  const out = new Compiler(exprResolver, (expr: Regex, prog: Prog, start: number, length: number) => {
    const instr = prog.instrs[start];
    if (instr.comment.length == 0) instr.comment = expr.toString;
  });
  const rules = patterns.map((pattern, index) => {
    const rule = typeof pattern === "string" ? new Rule(pattern, index) : pattern;
    rule.expr = parse(rule.pattern);
    return rule;
  });
  return out.compile(rules);
}

class ThreadNode {
  // List of all offsets and tapeIndexes encountered
  level = 0;
  entries: [number, number, number][] = [];
  parent: TSU.Nullable<ThreadNode> = null;
  children: TSU.NumMap<ThreadNode> = {};
  constructor(public readonly thread: Thread) {}
}

class VMTracer {
  trace: string[] = [];
  allThreadNodes: TSU.NumMap<ThreadNode> = {};
  threadStepped(thread: Thread, tapeIndex: number, gen: number): void {
    const threadNode = this.ensureThread(thread);
    threadNode.entries.push([thread.offset, tapeIndex, gen]);
  }

  ensureThread(thread: Thread): ThreadNode {
    if (!(thread.id in this.allThreadNodes)) {
      this.allThreadNodes[thread.id] = new ThreadNode(thread);
    }
    const threadNode = this.allThreadNodes[thread.id];
    if (thread.parentId >= 0) {
      // parent *must* exist
      TSU.assert(thread.parentId in this.allThreadNodes, `Parent node ${thread.parentId} not found`);
      const parentNode: ThreadNode = this.allThreadNodes[thread.parentId];
      if (!(thread.id in parentNode.children)) {
        threadNode.parent = parentNode;
        parentNode.children[thread.id] = threadNode;
        threadNode.level = parentNode.level + 1;
      }
    }
    return threadNode;
  }

  threadDequeued(thread: Thread, tapeIndex: number): void {
    this.trace.push(
      `Popping Thread (ID: ${thread.id}, Offset: ${thread.offset}, Parent: ${thread.parentId}), TapeIndex: ${tapeIndex}`,
    );
  }

  threadQueued(thread: Thread, tapeIndex: number): void {
    this.ensureThread(thread);
    this.trace.push(
      `Pushing Thread (ID: ${thread.id}, Offset: ${thread.offset}, Parent: ${thread.parentId}), TapeIndex: ${tapeIndex}`,
    );
  }
}

function indentStr(level: number, ch = "  "): string {
  let out = "";
  for (let l = 0; l < level; l++) out += ch;
  return out;
}

function layoutThreadNodes(input: string, threadNodes: TSU.NumMap<ThreadNode>): string {
  let table = "<table border = 1><thead>";
  // render table heading - input starts at column 2
  table += "<td></td>";
  for (let i = 0; i <= input.length; i++) {
    if (i == input.length) {
      table += `<td class = "inputCharCell">EOF</td>`;
    } else {
      table += `<td class = "inputCharCell">${i}<br/>"${input[i]}"</td>`;
    }
  }
  table += "</thead><tbody>";
  // one row per thread node in topological order starting at thread 0
  const root = threadNodes[0];
  function visit(node: ThreadNode): void {
    table += "<tr>";
    const indent = node.parent == null ? "" : indentStr(node.parent.level, "&nbsp&nbsp&nbsp") + "|___";
    table += `  <td class = 'threadIdCell'>${indent}${node.thread.id} (${node.thread.parentId})</td>`;
    const tds = [] as string[];
    for (let i = 0; i < input.length; i++) tds.push("");
    // Now print out entries
    for (const [offset, ti, gen] of node.entries) {
      tds[ti] += `${offset} - ${gen}<br/>`;
    }
    for (let i = 0; i < input.length; i++)
      table += `  <td class = threadInstrsCell id = "threadInstrs_${node.thread.id}_${i}">${tds[i]}</td>\n`;
    table += "</tr>\n";

    // And the children
    for (const childId in node.children) {
      visit(node.children[childId]);
    }
  }

  visit(root);
  // Layout body
  table += "</tbody></table>";
  return table;
}

function testInput(
  prog: Prog,
  input: string,
  expectedTokens: [string, number][],
  debug = false,
  reportFile: TSU.Nullable<string> = null,
): void {
  const tape = new Tape(input);
  const vm = new VM(prog);
  const tracer = new VMTracer();
  if (debug) {
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
  const found = [] as [string, number][];
  let next = vm.match(tape);
  while (next != null && next.end > next.start) {
    found.push([tape.substring(next.start, next.end), next.matchIndex]);
    next = vm.match(tape);
  }
  if (debug) {
    console.log("VM Tracer: ");
    // console.log(tracer.trace.join("\n"));
    console.log("Found Tokens: ", found);
    const reportHtml = `<html>
        <head>
          <style>
            .threadInstrsCell  { padding-left: 10px; padding-right: 10px; vertical-align: top; }
            .inputCharCell { font-weight: bold; text-align: center; }
            .threadIdCell { font-weight: bold; text-align: left; vertical-align: top; }
          </style>
        </head>
        <body>${layoutThreadNodes(input, tracer.allThreadNodes)}</body>
       </html>`;
    if (reportFile != null) {
      if (reportFile.trim().length > 0) {
        fs.writeFileSync(reportFile, reportHtml);
      } else {
        console.log(reportHtml);
      }
    }
  }
  expect(found).toEqual(expectedTokens);
}

describe("VM Tests", () => {
  test("Test Chars", () => {
    const prog = compile(null, "abcde");
    testInput(prog, "abcdeabcde", [
      ["abcde", 0],
      ["abcde", 0],
    ]);
  });

  test("Test Chars Classes", () => {
    const prog = compile(null, "[a-e]");
    testInput(prog, "abcdeabcde", [
      ["a", 0],
      ["b", 0],
      ["c", 0],
      ["d", 0],
      ["e", 0],
      ["a", 0],
      ["b", 0],
      ["c", 0],
      ["d", 0],
      ["e", 0],
    ]);
  });

  test("Test a*", () => {
    const prog = compile(null, "a*");
    testInput(prog, "aaaaa", [["aaaaa", 0]]);
  });

  test("Test a{3}", () => {
    const prog = compile(null, "a{3}");
    testInput(prog, "aaaaaa", [
      ["aaa", 0],
      ["aaa", 0],
    ]);
  });

  test("Test (a|b)*", () => {
    const prog = compile(null, "(a|b)*");
    testInput(prog, "abbbaaaba", [["abbbaaaba", 0]]);
  });

  test("Test (a|b){0, 10}?", () => {
    const prog = compile(null, "(a|b){0,2}?");
    testInput(prog, "abbbaaaba", [
      ["ab", 0],
      ["bb", 0],
      ["aa", 0],
      ["ab", 0],
      ["a", 0],
    ]);
  });

  test("Test a,b,c,d,e", () => {
    const prog = compile(null, "a", "b", "c", "d", "e");
    testInput(prog, "edcbaabcde", [
      ["e", 4],
      ["d", 3],
      ["c", 2],
      ["b", 1],
      ["a", 0],
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 3],
      ["e", 4],
    ]);
  });

  test("Test a*?", () => {
    const prog = compile(null, "a*?", "aa");
    testInput(prog, "aaaaa", [
      ["a", 0],
      ["a", 0],
      ["a", 0],
      ["a", 0],
      ["a", 0],
    ]);
  });

  test("Test Comments", () => {
    const prog = compile(null, `/\\*.*?\\*/`, `[ \t\n\r]+`);
    // const prog = compile(null, `/\*.*\*/`, `\"(?<!\\\\)\"`, "//.*$");
    testInput(
      prog,
      `/* hello comment in one line */   /** How about multi line?
              
              */  `,
      [
        ["/* hello comment in one line */", 0],
        ["   ", 1],
        ["/** How about multi line?\n              \n              */", 0],
        ["  ", 1],
      ],
      false,
      "/tmp/test.html",
    );
  });

  test("Test (a|b){0, 10}(a|b){5,10}", () => {
    const prog = compile(null, "(a){0, 10}(a|b){5,10}");
    testInput(prog, "abbbaaaba", [["abbbaaaba", 0]], false, "/tmp/test.html");
  });

  test("Test Lines", () => {
    const prog = compile(
      null,
      new Rule("^ *a*", 0, 20),
      new Rule("b*$", 1, 15),
      new Rule(`[ \t\n\r]+`, 2, 10),
      new Rule(".", 3, 0),
    );
    testInput(
      prog,
      `
      aaaaabcdefgh
      bbbbb
      xhzy bbb ccc
    `,
      [],
      true,
      "/tmp/testlines.html",
    );
  });
});
