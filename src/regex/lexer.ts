import { Regex, Rule } from "./core";
import { parse } from "./parser";
import { Prog, Match } from "./vm";
import { Compiler, VM } from "./pikevm";
import { Tape } from "../tape";

export class Lexer {
  // Stores named rules
  // Rules are a "regex", whether literal or not
  allRules: Rule[] = [];
  variables = new Map<string, Regex>();
  vm: VM;
  compiler: Compiler = new Compiler((name) => {
    const out = this.variables.get(name) || null;
    if (out == null) throw new Error(`Invalid regex reference: ${name}`);
    return out;
  });

  addVar(name: string, regex: string | Regex): this {
    if (typeof regex === "string") {
      regex = parse(regex);
    }
    if (this.variables.has(name)) {
      throw new Error(`Variable ${name} already exists`);
    }
    this.variables.set(name, regex);
    return this;
  }

  add(...rules: Rule[]): this {
    for (const rule of rules) {
      let index = this.allRules.findIndex((r) => r.pattern == rule.pattern);
      if (index >= 0) {
        throw new Error(`Regex '${rule.pattern}' already registered as ${rule.tokenType}`);
      }
      index = this.allRules.length;
      rule.expr = parse(rule.pattern);
      this.allRules.push(rule);
    }
    return this;
  }

  compile(): Prog {
    const prog = this.compiler.compile(this.allRules);
    this.vm = new VM(prog);
    return prog;
  }

  next(tape: Tape): Match | null {
    const m = this.vm.match(tape);
    return m;
  }
}
