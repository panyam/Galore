import { Rule } from "./core";
import { parse } from "./parser";
import { Prog } from "./vm";
import { Compiler, VM } from "./pikevm";

export class Lexer {
  // Stores named rules
  // Rules are a "regex", whether literal or not
  allRules: Rule[] = [];
  rulesByName = new Map<string, Rule>();
  vm: VM;
  compiler: Compiler = new Compiler((name) => {
    const out = this.rulesByName.get(name) || null;
    if (out == null) throw new Error(`Invalid regex reference: ${name}`);
    return out;
  });

  add(...rules: Rule[]): this {
    for (const rule of rules) {
      let index = this.allRules.findIndex((r) => r.pattern == rule.pattern);
      if (index >= 0) {
        throw new Error(`Regex '${rule.pattern}' already registered as ${rule.tokenType}`);
      }
      index = this.allRules.length;
      if (rule.name.trim().length > 0) {
        this.rulesByName.set(rule.name, rule);
      }
      rule.expr = parse(rule.pattern);
      this.allRules.push(rule);
    }
    return this;
  }

  compile(): Prog {
    const prog = this.compiler.compileRules(this.allRules);
    this.vm = new VM(prog);
    return prog;
  }
}
