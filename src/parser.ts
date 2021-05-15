import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { Sym, Grammar } from "./grammar";

type Nullable<T> = TSU.Nullable<T>;

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

  debugValue(raw = true): any {
    if (raw) {
      const out: any = [this.sym.label];
      if (this.value) out.push(this.value);
      if (this.children.length > 0) out.push(this.children.map((c) => c.debugValue(raw)));
      return out;
    } else {
      const out: any[] = [];
      const value = this.value;
      out.push(this.sym.label + " - " + this.value);
      this.children.forEach((node) => (node.debugValue(raw) as string[]).forEach((l) => out.push("  " + l)));
      return out;
    }
  }
}

export abstract class Parser {
  grammar: Grammar;
  tokenbuffer: TLEX.TokenBuffer;
  constructor(grammar: Grammar) {
    this.grammar = grammar;
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
