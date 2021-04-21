import { Regex, Union, Rule } from "./core";
import { parse } from "./parser";
import { Prog, Match } from "./vm";
import { Compiler, VM } from "./pikevm";
import { Tape } from "../tape";

export class Lexer {
  // Stores named rules
  // Rules are a "regex", whether literal or not
  allRules: Rule[] = [];
  externs = new Set<string>();
  variables = new Map<string, Regex>();
  vm: VM;
  compiler: Compiler = new Compiler((name) => {
    let out = this.variables.get(name) || null;
    if (out == null) out = this.findRuleByValue(name)?.expr || null;
    if (out == null) throw new Error(`Invalid regex reference: ${name}`);
    return out;
  });

  getVar(name: string): Regex | null {
    return this.variables.get(name) || null;
  }

  addExtern(name: string): this {
    this.externs.add(name);
    return this;
  }

  addVar(name: string, regex: string | Regex): this {
    if (typeof regex === "string") {
      regex = parse(regex);
    }
    let currValue = this.variables.get(name) || null;
    if (currValue == null) {
      currValue = regex;
    } else {
      currValue = new Union(currValue, regex);
    }
    this.variables.set(name, regex);
    return this;
  }

  findRulesByRegex(pattern: string): Rule[] {
    return this.allRules.filter((r) => r.pattern == pattern);
  }

  findRuleByValue(value: any): Rule | null {
    return this.allRules.find((r) => r.tokenType == value) || null;
  }

  addRule(rule: Rule): this {
    const old = this.allRules.findIndex((r) => r.tokenType == rule.tokenType);
    if (old >= 0) {
      const oldRule = this.allRules[old];
      if (oldRule.pattern != rule.pattern) {
        rule = new Rule(oldRule.pattern + "|" + rule.pattern, oldRule.tokenType, oldRule.priority, oldRule.isGreedy);
        this.allRules[old] = rule;
      }
    } else {
      this.allRules.push(rule);
    }
    rule.expr = parse(rule.pattern);
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
