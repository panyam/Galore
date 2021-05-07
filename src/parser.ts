import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { Sym, Grammar } from "./grammar";

type Nullable<T> = TSU.Nullable<T>;

export class PTNode {
  readonly sym: Sym;
  parent: Nullable<PTNode> = null;
  value: any;
  readonly children: PTNode[] = [];
  constructor(sym: Sym, value: any = null) {
    this.sym = sym;
    this.value = value;
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

  get debugValue(): string[] {
    const value = this.value;
    const out: any[] = [];
    out.push(this.sym.label + " - " + this.value);
    this.children.forEach((node) => node.debugValue.forEach((l) => out.push("  " + l)));
    return out;
  }
}

export abstract class Parser {
  grammar: Grammar;
  tokenizer: TLEX.TokenBuffer;
  constructor(grammar: Grammar) {
    this.grammar = grammar;
  }

  setTokenizer(tokenizer: TLEX.NextTokenFunc): this {
    this.tokenizer = new TLEX.TokenBuffer(tokenizer);
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

  /**
   * Parses the input and returns the resulting root Parse Tree node.
   */
  abstract parse(): Nullable<PTNode>;
}
