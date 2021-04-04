import * as TSU from "@panyam/tsutils";
import { Token } from "./tokenizer";
import { Sym, Grammar } from "./grammar";

type Nullable<T> = TSU.Nullable<T>;

/**
 * A tokenizer interface used by our parser.
 */
export interface Tokenizer {
  peek(): Nullable<Token>;
  next(): Nullable<Token>;
}

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

  get debugValue(): any {
    const value = this.value;
    const out = { sym: this.sym.label } as any;
    if (this.children.length > 0) {
      out.children = this.children.map((node) => node.debugValue);
    }
    if (value != null) {
      out.value = value.debugValue || value.debugString || value;
    }
    return out;
  }
}

export abstract class Parser {
  grammar: Grammar;
  tokenizer: Tokenizer;
  constructor(grammar: Grammar) {
    this.grammar = grammar;
  }

  setTokenizer(tokenizer: Tokenizer): this {
    this.tokenizer = tokenizer;
    return this;
  }

  /**
   * Converts the token to a Terminal based on the tag value.
   */
  getSym(token: Token): Sym {
    const out = this.grammar.getSym(token.tag as string);
    if (out == null) {
      throw new Error("Invalid token: " + token.value);
    }
    return out;
  }

  /**
   * Parses the input and returns the resulting root Parse Tree node.
   */
  abstract parse(): Nullable<PTNode>;
}
