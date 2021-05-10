import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { Sym, Grammar, Rule } from "./grammar";
import { PTNode, Parser as ParserBase } from "./parser";
import { printGrammar } from "./utils";

type StringMap<T> = TSU.StringMap<T>;
type Nullable<T> = TSU.Nullable<T>;

export class ParseTable {
  readonly grammar: Grammar;
  protected entries: Map<number, Map<number, Rule[]>>;

  constructor(grammar: Grammar) {
    this.grammar = grammar;
    this.refresh();
  }

  refresh(): this {
    this.entries = new Map();
    this.grammar.followSets.refresh();
    this.grammar.forEachRule(null, (rule, index) => {
      this.processRule(rule, index);
    });
    const printed = printGrammar(this.grammar, false);
    const t1 = this.grammar.cycles;
    const t2 = this.grammar.leftRecursion;
    return this;
  }

  get count(): number {
    let c = 0;
    for (const nt of this.entries.values()) {
      for (const term of nt.values()) {
        c += term.length;
      }
    }
    return c;
  }

  ensureEntry(nt: Sym, term: Sym): Rule[] {
    TSU.assert(!nt.isTerminal && term.isTerminal);
    let entriesForNT = this.entries.get(nt.id) as Map<number, Rule[]>;
    if (!entriesForNT) {
      entriesForNT = new Map();
      this.entries.set(nt.id, entriesForNT);
    }
    let entries = entriesForNT.get(term.id) as Rule[];
    if (!entries) {
      entries = [];
      entriesForNT.set(term.id, entries);
    }
    return entries;
  }

  add(nt: Sym, term: Sym, entry: Rule): boolean {
    const entries = this.ensureEntry(nt, term);
    if (entries.findIndex((e) => e.equals(entry)) < 0) {
      entries.push(entry);
    }
    return entries.length == 1;
  }

  get(nt: Sym, term: Sym): Rule[] {
    return this.ensureEntry(nt, term);
  }

  forEachEntry(visitor: (nonterm: Sym, term: Sym, items: Rule[]) => boolean | void): void {
    for (const ntId of this.entries.keys()) {
      const ntMap = this.entries.get(ntId) || null;
      TSU.assert(ntMap != null);
      const nonterm = this.grammar.getSymById(ntId);
      TSU.assert(nonterm != null);
      for (const termId of ntMap.keys()) {
        const term = this.grammar.getSymById(termId);
        TSU.assert(term != null);
        const items = ntMap.get(termId) || [];
        if (visitor(nonterm, term, items) == false) return;
      }
    }
  }

  get debugValue(): StringMap<StringMap<string[]>> {
    const out: StringMap<StringMap<string[]>> = {};
    this.forEachEntry((nt, term, items) => {
      out[nt.label] = out[nt.label] || {};
      out[nt.label][term.label] = out[nt.label][term.label] || [];
      const entries = out[nt.label][term.label];
      for (const item of items) {
        entries.push(item.debugString);
      }
    });
    return out;
  }

  processRule(rule: Rule, index: number): void {
    const firstSets = this.grammar.firstSets;
    // Rule 1
    // For each a in First(rule) add A -> rule to M[A,a]
    let ruleIsNullable = false;
    firstSets.forEachTermIn(rule.rhs, 0, (term) => {
      if (term == null) {
        ruleIsNullable = true;
      } else {
        this.add(rule.nt, term, rule);
      }
    });

    // Rule 2
    // if rule is nullable then A -> rule to M[A,b] for each b in Follow(A)
    // Also if EOF in Follow(A) then add A -> Rule to M[A,Eof]
    // const nullables = this.followSets.nullables;
    // const nullable = rule.isString ? nullables.isStrNullable(rule as Str) : nullables.isNullable((rule as Sym).value);
    if (ruleIsNullable) {
      this.grammar.followSets.forEachTerm(rule.nt, (term) => {
        TSU.assert(term != null, "Follow sets cannot have null");
        this.add(rule.nt, term, rule);
      });
    }
  }
}

export class ParseStack {
  readonly grammar: Grammar;
  readonly parseTable: ParseTable;
  readonly stack: [Sym, PTNode][];
  readonly docNode: PTNode;
  readonly rootNode: PTNode;
  constructor(g: Grammar, parseTable: ParseTable) {
    this.grammar = g;
    this.parseTable = parseTable;
    this.stack = [];
    TSU.assert(g.startSymbol != null, "Start symbol not selected");
    this.docNode = this.push(g.Eof, new PTNode(new Sym(g, "<DOC>", false)));
    this.rootNode = this.push(g.startSymbol);
    this.docNode.add(this.rootNode);
  }

  get debugString(): string {
    return "Stack: [" + this.stack.map((x) => x[0].label).join(", ") + "]";
  }

  push(sym: Sym, node: Nullable<PTNode> = null): PTNode {
    if (!node) node = new PTNode(sym);
    this.stack.push([sym, node]);
    return node;
  }

  top(): [Sym, PTNode] {
    return this.stack[this.stack.length - 1];
  }

  pop(): [Sym, PTNode] {
    if (this.stack.length == 0) {
      TSU.assert(false, "Stacks are empty");
    }
    return this.stack.pop()!;
  }

  get isEmpty(): boolean {
    return this.stack.length == 0;
  }
}

export class Parser extends ParserBase {
  parseTable: ParseTable;
  stack: ParseStack;
  constructor(grammar: Grammar, parseTable?: ParseTable) {
    super(grammar);
    this.parseTable = parseTable || new ParseTable(grammar);
    this.stack = new ParseStack(this.grammar, this.parseTable);
  }

  /**
   * Parses the input and returns the resulting root Parse Tree node.
   */
  protected parseInput(input: TLEX.Tape): Nullable<PTNode> {
    const tokenbuffer = this.tokenbuffer;
    const stack = this.stack;
    const g = this.grammar;
    let token: Nullable<TLEX.Token>;
    let topItem: Sym;
    let topNode: PTNode;
    do {
      token = tokenbuffer.peek(input);
      [topItem, topNode] = stack.top();
      const nextSym = token == null ? g.Eof : this.getSym(token);
      const nextValue = token == null ? null : token.value;
      if (topItem.isTerminal) {
        if (topItem == nextSym) {
          // Something must happen here to stack symbol to build
          // the parse tree
          this.consumeTokenAndPop(input, nextSym, token!);
        } else {
          this.processInvalidToken(nextSym, token);
        }
      } else {
        const entries = this.parseTable.get(topItem, nextSym);
        if (entries.length != 1) {
          console.log("TopItem: ", topItem);
          console.log("nextSym: ", nextSym);
          this.processInvalidReductions(topNode, topItem, nextSym, nextValue, entries);
        } else {
          const [sym, ptnode] = this.stack.pop();
          TSU.assert(ptnode == topNode);
          TSU.assert(sym == entries[0].nt);
          TSU.assert(ptnode.sym == sym);
          this.popSymAndPushRule(ptnode, entries[0]);
        }
      }
      [topItem, topNode] = stack.top(); // Update top pointer
    } while (topItem != g.Eof); // !stack.isEmpty);
    return stack.rootNode;
  }

  popSymAndPushRule(parentNode: PTNode, rule: Rule): void {
    // This needs to match so we can push its children
    for (let i = rule.rhs.syms.length - 1; i >= 0; i--) {
      const sym = rule.rhs.syms[i];
      const node = this.stack.push(sym);
      parentNode.add(node, 0);
    }
  }
  consumeTokenAndPop(tape: TLEX.Tape, nextSym: Sym, nextToken: TLEX.Token): void {
    const [sym, ptnode] = this.stack.top();
    TSU.assert(sym == nextSym);
    TSU.assert(ptnode.sym == nextSym);
    ptnode.value = nextToken.value;
    console.log("Consuming token: ", nextToken);
    this.tokenbuffer.next(tape);
    this.stack.pop();
  }

  processInvalidToken(nextSym: Sym, nextValue: any): boolean {
    throw new Error("Invalid token: " + nextSym.label);
    return true;
  }

  processInvalidReductions(topNode: PTNode, currSym: Sym, nextSym: Sym, nextValue: any, entries: Rule[]): boolean {
    throw new Error(`Invalid # reductions ${entries.length} found ${currSym.label} -> ${nextSym.label}`);
    return true;
  }
}
