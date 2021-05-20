import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { Sym, Grammar, Rule } from "./grammar";

type Nullable<T> = TSU.Nullable<T>;

/**
 * As the parse tree is built, nodes are created and added to parents bottom up.
 * This method is called before a child node is added to its parent.  The
 * node's left-most siblings have already been added this point.
 *
 * This method is an opportunity to filter or transfor the node or even adding
 * other nodes to the parent's child list.  Note that at this point the parent
 * has *NOT* been added to its parent.
 *
 * In order to filter out the node, return null.  Otherwise return a
 * PTNode instance for the actual node to be added to the parent.
 */
export type BeforeAddingChildCallback = (parent: PTNode, child: PTNode) => TSU.Nullable<PTNode>;

/**
 * This method is called when after a rule has been reduced.  At this time
 * all the children have already been reduced (and called with this method).
 * Now is the opportunity for the parent node reduction to perform custom
 * actions.  Note that this method cannot modify the stack.  It can only be
 * used to perform things like AST building or logging etc.
 */
export type RuleReductionCallback = (node: PTNode, rule: Rule) => PTNode;

/**
 * This method is called as soon as the next token is received from the tokenizer.
 * This allows one to filter out tokens or even transform them based on any other
 * context being maintained.
 */
export type NextTokenCallback = (token: TLEX.Token) => TSU.Nullable<TLEX.Token>;

export class PTNode {
  readonly sym: Sym;
  parent: Nullable<PTNode> = null;
  value: any;
  readonly children: PTNode[];
  constructor(sym: Sym, value: any = null, ...children: PTNode[]) {
    this.sym = sym;
    this.value = value;
    this.children = children || [];
  }

  get childCount(): number {
    return this.children.length;
  }

  childAt(index: number): PTNode {
    if (index < 0) return this.children[this.children.length + index];
    return this.children[index];
  }

  get reprString(): string {
    /*
    let out = `Node(${this.sym.label}, {this.value}`;
    if (this.children.length > 0) out += ", " + this.children.map((c) => c.reprString).join(", ");
    out += ")";
    return out;
    */
    return this.debugValue(false).join("\n");
  }

  get isTerminal(): boolean {
    return this.sym.isTerminal;
  }

  add(node: PTNode, index = -1): this {
    if (this.isTerminal) {
      throw new Error(`Cannot add children (${node.sym.label}) to a terminal node: ${this.sym.label}`);
    }
    node.parent = this;
    if (index < 0) {
      this.children.push(node);
    } else {
      this.children.splice(index, 0, node);
    }
    return this;
  }

  splice(index: number, numToDelete: number, ...nodes: PTNode[]): this {
    for (const node of nodes) node.parent = this;
    this.children.splice(index, numToDelete, ...nodes)
    return this;
  }

  debugValue(raw = true): any {
    if (raw) {
      const out: any = [this.sym.label];
      if (this.value) out.push(this.value);
      if (this.children.length > 0) out.push(this.children.map((c) => c.debugValue(raw)));
      return out;
    } else {
      const out: any[] = [];
      const value = this.value;
      out.push(this.value == null ? this.sym.label : this.sym.label + " - " + this.value);
      this.children.forEach((node) => (node.debugValue(raw) as string[]).forEach((l) => out.push("  " + l)));
      return out;
    }
  }
}

export abstract class Parser {
  grammar: Grammar;
  tokenbuffer: TLEX.TokenBuffer;

  setGrammar(grammar: Grammar): this {
    TSU.assert((grammar.augStartRule || null) != null, "Grammar's start symbol has not been augmented");
    this.grammar = grammar;
    return this;
  }

  setTokenizer(tokenizer: TLEX.NextTokenFunc): this {
    this.tokenbuffer = new TLEX.TokenBuffer(tokenizer);
    return this;
  }

  /**
   * Converts the token to a Terminal based on the tag value.
   */
  getSym(token: TLEX.Token): Sym {
    const out = this.grammar.getSym(token.tag as string);
    if (out == null) {
      throw new Error("Invalid token tag: " + token.tag + ", Value: " + token.value);
    }
    return out;
  }

  parse(input: string | TLEX.Tape): Nullable<PTNode> {
    if (typeof input === "string") {
      input = new TLEX.Tape(input);
    }
    return this.parseInput(input);
  }

  /**
   * Parses the input and returns the resulting root Parse Tree node.
   */
  protected abstract parseInput(input: TLEX.Tape): Nullable<PTNode>;
}
