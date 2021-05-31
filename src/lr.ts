import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { Sym, Grammar, Rule } from "./grammar";
import {
  PTNode,
  Parser as ParserBase,
  BeforeAddingChildCallback,
  RuleReductionCallback,
  NextTokenCallback,
} from "./parser";
import { LRItemGraph } from "./lritems";

type Nullable<T> = TSU.Nullable<T>;
type NumMap<T> = TSU.NumMap<T>;
type StringMap<T> = TSU.StringMap<T>;

export enum LRActionType {
  ACCEPT,
  SHIFT,
  REDUCE,
  GOTO, // can *ONLY* be valid for non-terms
}

export class LRAction {
  // Type of action
  tag: LRActionType;

  // Next state to go to after performing the action (if valid).
  gotoState: Nullable<number> = null;

  // The rule to be used for a reduce action
  rule: Nullable<Rule> = null;

  toString(): string {
    if (this.tag == LRActionType.ACCEPT) return "Acc";
    else if (this.tag == LRActionType.SHIFT) {
      return "S" + this.gotoState!;
    } else if (this.tag == LRActionType.REDUCE) {
      return "R " + this.rule!.id;
    } else {
      return "" + this.gotoState!;
    }
  }

  equals(another: LRAction): boolean {
    return this.tag == another.tag && this.gotoState == another.gotoState && this.rule == another.rule;
  }

  static Shift(goto: number): LRAction {
    const out = new LRAction();
    out.tag = LRActionType.SHIFT;
    out.gotoState = goto;
    return out;
  }

  static Reduce(rule: Rule): LRAction {
    const out = new LRAction();
    out.tag = LRActionType.REDUCE;
    out.rule = rule;
    return out;
  }

  static Goto(gotoState: number): LRAction {
    const out = new LRAction();
    out.tag = LRActionType.GOTO;
    out.gotoState = gotoState;
    return out;
  }

  static Accept(): LRAction {
    const out = new LRAction();
    out.tag = LRActionType.ACCEPT;
    return out;
  }
}

/**
 * A parsing table for LR parsers.
 */
export class ParseTable {
  readonly grammar: Grammar;
  // Records which actions have conflicts
  conflictActions: NumMap<StringMap<boolean>> = {};

  /**
   * Maps symbol (by id) to the action;
   */
  actions: NumMap<NumMap<LRAction[]>> = {};

  constructor(grammar: Grammar) {
    this.grammar = grammar;
  }

  /**
   * Gets the action for a given sym from a given state.
   */
  getActions(stateId: number, next: Sym, ensure = false): LRAction[] {
    let l1: NumMap<LRAction[]>;
    if (stateId in this.actions) {
      l1 = this.actions[stateId];
    } else if (ensure) {
      l1 = this.actions[stateId] = {};
    } else {
      return [];
    }

    if (next.id in l1) {
      return l1[next.id];
    } else if (ensure) {
      return (l1[next.id] = []);
    }
    return [];
  }

  addAction(stateId: number, next: Sym, action: LRAction): void {
    const actions = this.getActions(stateId, next, true);
    if (actions.findIndex((ac) => ac.equals(action)) < 0) {
      actions.push(action);
    }
    if (actions.length > 1) {
      this.conflictActions[stateId] = this.conflictActions[stateId] || {};
      this.conflictActions[stateId][next.label] = true;
    }
  }

  get debugValue(): any {
    const out: any = {};
    for (const fromId in this.actions) {
      out[fromId] = {};
      for (const symId in this.actions[fromId]) {
        const sym = this.grammar.getSymById(symId as any)!;
        const actions = this.actions[fromId][sym.id] || [];
        if (actions.length > 0) {
          out[fromId][sym.label] = actions.map((a) => a.toString());
        }
      }
    }
    return out;
  }
}

export class ParseStack {
  readonly parseTable: ParseTable;
  // A way of marking the kind of item that is on the stack
  // true => isStateId
  // false => isSymbolId
  readonly stateStack: number[] = [];
  readonly nodeStack: PTNode[] = [];
  constructor(g: Grammar, parseTable: ParseTable) {
    this.parseTable = parseTable;
    TSU.assert(g.startSymbol != null, "Start symbol not selected");
  }

  push(state: number, node: PTNode): void {
    this.stateStack.push(state);
    this.nodeStack.push(node);
  }

  /**
   * Gets the nth item from the top of the stack.
   */
  top(nth = 0): [number, PTNode] {
    return [this.stateStack[this.stateStack.length - 1 - nth], this.nodeStack[this.nodeStack.length - 1 - nth]];
  }

  pop(): [number, PTNode] {
    const out = this.top();
    this.stateStack.pop();
    this.nodeStack.pop();
    return out;
  }

  /**
   * Pop N items from the stack.
   */
  popN(n = 1): void {
    const L = this.stateStack.length;
    this.stateStack.splice(L - n, n);
    this.nodeStack.splice(L - n, n);
  }

  get isEmpty(): boolean {
    return this.stateStack.length == 0 || this.nodeStack.length == 0;
  }
}

export class Parser extends ParserBase {
  parseTable: ParseTable;
  stack: ParseStack;
  itemGraph: LRItemGraph;

  /**
   * Whether to flatten parse tree nodes with a single child.
   */
  flatten: boolean;
  beforeAddingChildNode: BeforeAddingChildCallback;
  onReduction: RuleReductionCallback;
  onNextToken: NextTokenCallback;

  constructor(config: any = {}) {
    super();
    this.flatten = config.flatten || false;
    this.beforeAddingChildNode = config.beforeAddingChildNode;
    this.onReduction = config.onReduction;
    this.onNextToken = config.onNextToken;
  }

  initialize(parseTable: ParseTable, itemGraph: LRItemGraph): this {
    this.parseTable = parseTable;
    this.itemGraph = itemGraph;
    return this;
  }

  /**
   * Parses the input and returns the resulting root Parse Tree node.
   */
  protected parseInput(input: TLEX.Tape): Nullable<PTNode> {
    this.stack = new ParseStack(this.grammar, this.parseTable);
    this.stack.push(0, new PTNode(this.grammar.augStartRule.nt));
    const tokenbuffer = this.tokenbuffer;
    const stack = this.stack;
    const g = this.grammar;
    let output: Nullable<PTNode> = null;
    while (tokenbuffer.peek(input) != null || !stack.isEmpty) {
      let token = tokenbuffer.peek(input);
      if (token && this.onNextToken) token = this.onNextToken(token);
      const nextSym = token == null ? g.Eof : this.getSym(token);
      const nextValue = token == null ? null : token.value;
      let [topState, topNode] = stack.top();
      const actions = this.parseTable.getActions(topState, nextSym);
      if (actions == null || actions.length == 0) {
        // TODO - use a error handler here
        throw new TLEX.ParseError(
          token?.start || 0,
          `Unexpected token at state (${topState}): ${token?.tag} ('${nextSym.label}')`,
        );
      }

      const action = this.resolveActions(actions, stack, tokenbuffer);
      if (action.tag == LRActionType.ACCEPT) {
        break;
      } else if (action.tag == LRActionType.SHIFT) {
        tokenbuffer.next(input);
        const newNode = new PTNode(nextSym, nextValue);
        stack.push(action.gotoState!, newNode);
      } else {
        // reduce
        TSU.assert(action.rule != null, "Nonterm and ruleindex must be provided for a reduction action");
        const ruleLen = action.rule.rhs.length;
        // pop this many items off the stack and create a node
        // from this
        let newNode = new PTNode(action.rule.nt);
        for (let i = ruleLen - 1; i >= 0; i--) {
          const childNode: TSU.Nullable<PTNode> = stack.top(i)[1];
          if (this.beforeAddingChildNode) {
            for (const node of this.beforeAddingChildNode(newNode, childNode)) {
              newNode.add(node);
            }
          } else {
            if (childNode != null) {
              newNode.add(childNode);
            }
          }
        }
        // Pop ruleLen number of items off the stack
        stack.popN(ruleLen);
        [topState, topNode] = stack.top();
        const newAction = this.resolveActions(this.parseTable.getActions(topState, action.rule.nt), stack, tokenbuffer);
        TSU.assert(newAction != null, "Top item does not have an action.");
        if (this.onReduction) {
          newNode = this.onReduction(newNode, action.rule);
        }
        stack.push(newAction.gotoState!, newNode);
        output = newNode;
      }
    }
    // It is possible that here no reductions have been done!
    return output;
  }

  /**
   * Pick an action among several actions based on several factors (eg curr parse stack, tokenbuffer etc).
   */
  resolveActions(actions: LRAction[], stack: ParseStack, tokenbuffer: TLEX.TokenBuffer): LRAction {
    if (actions.length > 1) {
      throw new Error("Multiple actions found.");
    }
    return actions[0];
  }
}
