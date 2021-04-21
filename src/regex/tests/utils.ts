const util = require("util");
import * as fs from "fs";
import * as TSU from "@panyam/tsutils";
import { Regex, Rule } from "../core";
import { parse } from "../parser";
import { Prog } from "../vm";
import { Lexer } from "../lexer";
import { Compiler, VM, Thread } from "../pikevm";

// Read lexer tokens from contents.
// Our lexer spec is very simple.  Just a bunch
// of rules where each line is either empty or a comment or
// a spec of the form:
//
// <name> := regex_string
//
// <name> is either an IDENT or an IDENT!
//
// Where the latter form denotes a variable.
export function newLexer(contents: string): Lexer {
  const lexer = new Lexer();
  const lines = contents.split("\n");
  lines.forEach((line, index) => {
    line = line.trim();
    if (line.length == 0 || line.startsWith("#")) return;
    const eqIndex = line.indexOf(":=");
    let error = true;
    if (eqIndex >= 0) {
      let name = line.substring(0, eqIndex).trim();
      const value = line.substring(eqIndex + 2).trim();
      const isExtern = name[0] == "*";
      const isVar = name[0] == "!" || isExtern;
      if (isVar) name = name.substring(1);
      const isGreedy = name[name.length - 1] != "?";
      if (!isGreedy) name = name.substring(0, name.length - 1);
      if (name.length > 0 && (isExtern || value.length > 0)) {
        error = false;
        if (isExtern) {
          lexer.addExtern(name);
        }
        if (isVar) {
          lexer.addVar(name, value);
        } else {
          const rule = new Rule(value, name, 10, isGreedy);
          lexer.addRule(rule);
        }
      }
    }
    if (error) {
      throw new Error(`Invalid line (#${index}): "${line}"`);
    }
  });
  return lexer;
}

export function compile(exprResolver: null | ((name: string) => Regex), ...patterns: (Rule | string)[]): Prog {
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

export class ThreadNode {
  // List of all offsets and tapeIndexes encountered
  level = 0;
  entries: [number, number, number][] = [];
  parent: TSU.Nullable<ThreadNode> = null;
  children: TSU.NumMap<ThreadNode> = {};
  constructor(public readonly thread: Thread) {}
}

export class VMTracer {
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

export function indentStr(level: number, ch = "  "): string {
  let out = "";
  for (let l = 0; l < level; l++) out += ch;
  return out;
}

export function layoutThreadNodes(input: string, threadNodes: TSU.NumMap<ThreadNode>): string {
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
