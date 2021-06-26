import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { Sym, Grammar, Rule } from "./grammar";
import {
  PTNode,
  SimpleParser as ParserBase,
  BeforeAddingChildCallback,
  RuleReductionCallback,
  NextTokenCallback,
} from "./parser";
import { IDSet } from "./sets";

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

export class LRItemSet {
  id = 0;
  readonly itemGraph: LRItemGraph;
  protected _key: Nullable<string> = null;
  readonly values: number[];

  constructor(ig: LRItemGraph, ...entries: number[]) {
    this.itemGraph = ig;
    this.values = entries;
  }

  // A way to cache the key of this item set.
  // Keys help make the comparison of two sets easy.
  get key(): string {
    if (this._key == null) {
      this._key = this.revalKey();
    }
    return this._key;
  }

  protected revalKey(): string {
    this.values.sort();
    return this.values.join("/");
  }

  has(itemId: number): boolean {
    return this.values.indexOf(itemId) >= 0;
  }

  equals(another: LRItemSet): boolean {
    return this.key == another.key;
  }

  add(itemId: number): this {
    if (!this.has(itemId)) {
      this.values.push(itemId);
      this._key = null;
    }
    return this;
  }

  get size(): number {
    return this.values.length;
  }

  get debugString(): string {
    return this.debugValue.join("\n");
  }

  get debugValue(): any {
    const items = this.values.map((v: number) => this.itemGraph.items.get(v));
    // sort them by rule
    items.sort((i1, i2) => i1.compareTo(i2));
    return items.map((i) => i.debugString);
  }
}

export class LR1ItemSet extends LRItemSet {
  private _lookaheads: NumMap<Sym[]> = {};

  copy(): LR1ItemSet {
    const out = new LR1ItemSet(this.itemGraph, ...this.values);
    out._lookaheads = { ...this._lookaheads };
    return out;
  }

  /**
   * Adds a new look ahead symbol for a given item.
   */
  addLookAhead(item: LRItem, sym: Sym): boolean {
    if (!(item.id in this._lookaheads)) {
      this._lookaheads[item.id] = [];
    }
    for (const s of this._lookaheads[item.id]) if (s == sym) return false;
    this._key = null;
    this._lookaheads[item.id].push(sym);
    this._lookaheads[item.id].sort((s1, s2) => s1.id - s2.id);
    return true;
  }

  /**
   * Key also here includes the look ahead symbols.
   */
  protected revalKey(): string {
    this.values.sort();
    return this.values
      .map((itemId) => {
        const la = this._lookaheads[itemId] || [];
        return itemId + "[" + la.map((s) => s.id).join(",") + "]";
      })
      .join("/");
  }

  /**
   * Gets the lookahead symbols for a given item.
   */
  getLookAheads(item: LRItem): ReadonlyArray<Sym> {
    return this._lookaheads[item.id] || [];
  }

  get debugValue(): any {
    const items = this.values.map((v: number) => this.itemGraph.items.get(v));
    // sort them by rule
    items.sort((i1, i2) => i1.compareTo(i2));
    // then append the look aheads
    return items.map((item) => {
      const las = this.getLookAheads(item)
        .map((s) => s.label)
        .sort((s1, s2) => s1.localeCompare(s2))
        .join(", ");
      return `${item.debugString} / ( ${las} )`;
    });
  }
}

export abstract class LRItemGraph {
  // List of all unique LRItems that can be used in this item graph.
  // Note that since the same Item can reside in multiple sets only
  // one is created via the newItem method and it is referred
  // everwhere it is needed.

  /**
   * Using IDed sets of Items and ItemSets.
   * This ensures that only one copy of an item exists
   * "by value".
   */
  items: IDSet<LRItem>;
  itemSets: IDSet<LRItemSet>;

  // Goto sets for a set and a given transition out of it
  gotoSets: NumMap<NumMap<LRItemSet>> = {};

  abstract closure(itemSet: LRItemSet): LRItemSet;
  abstract startSet(): LRItemSet;

  constructor(public readonly grammar: Grammar) {
    this.items = new IDSet();
    this.itemSets = new IDSet();
  }

  protected startItem(): LRItem {
    const startSymbol = this.grammar.startSymbol;
    TSU.assert(startSymbol != null, "Start symbol must be set");
    TSU.assert((this.grammar.augStartRule || null) != null, "Grammar is not augmented");
    return this.items.ensure(new LRItem(this.grammar.augStartRule));
  }

  reset(): void {
    this.grammar.refresh();
    this.gotoSets = {};
    this.items.clear();
    this.itemSets.clear();
    this.startSet();
  }

  refresh(): this {
    this.reset();
    this.grammar.refresh();
    this.evalGotoSets();
    return this;
  }

  /**
   * Computes all the goto sets used to create the graph of items.
   */
  protected evalGotoSets(): void {
    const out = this.itemSets;
    for (let i = 0; i < out.size; i++) {
      const currSet = out.get(i);
      // This will also include the null symbol since Grammar
      // adds Null and Eof symbols automatically
      for (const sym of this.grammar.allSymbols) {
        if (sym != this.grammar.Null) {
          const gotoSet = this.goto(currSet, sym);
          if (gotoSet.size > 0) {
            this.setGoto(currSet, sym, gotoSet);
          }
        }
      }
    }
  }

  /**
   * Computes the GOTO set of this ItemSet for a particular symbol transitioning
   * out of this item set.
   */
  goto(itemSet: LRItemSet, sym: Sym): LRItemSet {
    const out = this.newItemSet() as LR1ItemSet;
    for (const itemId of itemSet.values) {
      const item = this.items.get(itemId);
      // see if item.position points to "sym" in its rule
      const rule = item.rule;
      if (item.position < rule.rhs.length) {
        if (rule.rhs.syms[item.position] == sym) {
          // advance the item and add it
          this.advanceItemAndAdd(item, itemSet, out);
        }
      }
    }
    // compute the closure of the new set
    return this.closure(out);
  }

  protected advanceItemAndAdd(itemToAdvance: LRItem, fromItemSet: LRItemSet, toItemSet: LRItemSet): void {
    const newItem = this.items.ensure(itemToAdvance.advance());
    toItemSet.add(newItem.id);
  }

  protected newItemSet(...items: LRItem[]): LRItemSet {
    return new LRItemSet(this, ...items.map((item) => item.id));
  }

  get size(): number {
    return this.itemSets.size;
  }

  protected ensureGotoSet(fromSet: LRItemSet): NumMap<LRItemSet> {
    if (!(fromSet.id in this.gotoSets)) {
      this.gotoSets[fromSet.id] = {};
    }
    return this.gotoSets[fromSet.id];
  }

  setGoto(fromSet: LRItemSet, sym: Sym, toSet: LRItemSet): void {
    const entries = this.ensureGotoSet(fromSet);
    entries[sym.id] = toSet;
  }

  getGoto(fromSet: LRItemSet, sym: Sym): Nullable<LRItemSet> {
    return (this.gotoSets[fromSet.id] || {})[sym.id] || null;
  }

  forEachGoto(itemSet: LRItemSet, visitor: (sym: Sym, nextSet: LRItemSet) => boolean | void): void {
    const gotoSet = this.gotoSets[itemSet.id] || {};
    for (const symid in gotoSet) {
      const sym = this.grammar.getSymById(symid as any) as Sym;
      const next = gotoSet[symid];
      if (visitor(sym, next) == false) break;
    }
  }

  gotoSetFor(itemSet: LRItemSet): NumMap<LRItemSet> {
    return this.gotoSets[itemSet.id] || {};
  }

  get debugValue(): any {
    const out = {} as any;
    this.itemSets.entries.forEach((iset) => {
      out[iset.id] = { items: [], goto: {} };
      out[iset.id]["items"] = iset.debugValue;
      const g = this.gotoSets[iset.id];
      for (const symid in g) {
        const sym = this.grammar.getSymById(symid as any)!;
        out[iset.id]["goto"] = out[iset.id]["goto"] || {};
        out[iset.id]["goto"][sym.label] = g[symid].id;
      }
    });
    return out;
  }
}

export class LRItem {
  id = 0;
  readonly rule: Rule;
  readonly position: number;
  constructor(rule: Rule, position = 0) {
    this.rule = rule;
    this.position = position;
  }

  advance(): LRItem {
    TSU.assert(this.position < this.rule.rhs.length);
    return new LRItem(this.rule, this.position + 1);
  }

  copy(): LRItem {
    return new LRItem(this.rule, this.position);
  }

  /**
   * TODO - Instead of using strings as keys, can we use a unique ID?
   * If we assume a max limit on number of non terminals in our grammar
   * and a max limit on the number of rules per non terminal and a
   * max limit on the size of each rule then we can uniquely identify
   * a rule and position for a non-terminal by a single (64 bit) number
   *
   * We can use the following bitpacking to nominate this:
   *
   * <padding 16 bits><nt id 16 bits><ruleIndex 16 bits><position 16 bits>
   */
  get key(): string {
    TSU.assert(!isNaN(this.rule.id), "Rule's ID is not yet set.");
    return this.rule.id + ":" + this.position;
  }

  compareTo(another: this): number {
    let diff = this.rule.id - another.rule.id;
    if (diff == 0) diff = this.position - another.position;
    return diff;
  }

  equals(another: this): boolean {
    return this.compareTo(another) == 0;
  }

  get debugString(): string {
    const rule = this.rule;
    const pos = this.position;
    const pre = rule.rhs.syms.slice(0, pos).join(" ");
    const post = rule.rhs.syms.slice(pos).join(" ");
    return `${rule.id}  -  ${rule.nt} -> ${pre} • ${post}`;
  }
}

export class LR0ItemGraph extends LRItemGraph {
  /**
   * Creates the set for the grammar.  This is done by creating an
   * augmented rule of the form S' -> S (where S is the start symbol of
   * the grammar) and creating the closure of this starting rule, ie:
   *
   * StartSet = closure({S' -> . S})
   */
  startSet(): LRItemSet {
    const startItem = this.startItem();
    const newset = this.newItemSet(startItem);
    return this.closure(newset);
  }

  /**
   * Computes the closure of a given item set and returns a new
   * item set.
   */
  closure(itemSet: LRItemSet): LRItemSet {
    const out = new LRItemSet(this, ...itemSet.values);
    for (let i = 0; i < out.values.length; i++) {
      const itemId = out.values[i];
      const item = this.items.get(itemId)!;
      const rule = item.rule;
      // Evaluate the closure
      // Cannot do anything past the end
      if (item.position < rule.rhs.length) {
        const sym = rule.rhs.syms[item.position];
        if (!sym.isTerminal) {
          for (const rule of this.grammar.rulesForNT(sym)) {
            const newItem = this.items.ensure(new LRItem(rule, 0));
            out.add(newItem.id);
          }
        }
      }
    }
    return out.size == 0 ? out : this.itemSets.ensure(out);
  }
}

export class LR1ItemGraph extends LRItemGraph {
  /**
   * Overridden to create LR1ItemSet objects with the start state
   * also including the EOF marker as the lookahead.
   *
   * StartSet = closure({S' -> . S, $})
   */
  startSet(): LRItemSet {
    const startItem = this.startItem();
    const newset = this.newItemSet(startItem);
    newset.addLookAhead(startItem, this.grammar.Eof);
    return this.closure(newset);
  }

  /**
   * Overridden to create LR1 item sets so we can associate lookahead
   * symbols for each item in the set.
   */
  protected newItemSet(...items: LRItem[]): LR1ItemSet {
    return new LR1ItemSet(this, ...items.map((item) => item.id));
  }

  /**
   * Computes the closure of this item set and returns a new
   * item set.
   */
  closure(itemSet: LR1ItemSet): LR1ItemSet {
    const out = itemSet.copy();
    for (let i = 0; i < out.values.length; i++) {
      const itemId = out.values[i];
      const item = this.items.get(itemId) as LRItem;
      // Evaluate the closure
      // Cannot do anything past the end
      if (item.position >= item.rule.rhs.length) continue;
      const rhs = item.rule.rhs;
      const B = rhs.syms[item.position];
      if (B.isTerminal) continue;

      for (const lookahead of out.getLookAheads(item)) {
        const suffix = rhs.copy().append(lookahead);
        this.grammar.firstSets.forEachTermIn(suffix, item.position + 1, (term) => {
          if (term != null) {
            // For each rule [ B -> beta, term ] add it to
            // our list of items if it doesnt already exist
            const bRules = this.grammar.rulesForNT(B);
            for (const br of bRules) {
              const newItem = this.items.ensure(new LRItem(br, 0));
              out.add(newItem.id);
              out.addLookAhead(newItem, term);
            }
          }
        });
      }
    }
    return out.size == 0 ? out : (this.itemSets.ensure(out) as LR1ItemSet);
  }

  protected advanceItemAndAdd(itemToAdvance: LRItem, fromItemSet: LR1ItemSet, toItemSet: LR1ItemSet): void {
    super.advanceItemAndAdd(itemToAdvance, fromItemSet, toItemSet);
    const newItem = this.items.ensure(itemToAdvance.advance());
    // copy over the look aheads
    for (const laSym of fromItemSet.getLookAheads(itemToAdvance)) {
      toItemSet.addLookAhead(newItem, laSym);
    }
  }
}

/**
 * A parsing table for LR parsers.
 */
export class ParseTable {
  // Records which actions have conflicts
  conflictActions: NumMap<StringMap<boolean>> = {};

  /**
   * Maps symbol (by id) to the action;
   */
  actions: NumMap<NumMap<LRAction[]>> = {};

  constructor(public readonly grammar: Grammar) {}

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

  addAction(stateId: number, next: Sym, action: LRAction): this {
    const actions = this.getActions(stateId, next, true);
    if (actions.findIndex((ac) => ac.equals(action)) < 0) {
      actions.push(action);
    }
    if (actions.length > 1) {
      this.conflictActions[stateId] = this.conflictActions[stateId] || {};
      this.conflictActions[stateId][next.label] = true;
    }
    return this;
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
  // A way of marking the kind of item that is on the stack
  // true => isStateId
  // false => isSymbolId
  readonly stateStack: number[] = [];
  readonly nodeStack: PTNode[] = [];

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
  stack: ParseStack;

  beforeAddingChildNode: BeforeAddingChildCallback;
  onReduction: RuleReductionCallback;
  onNextToken: NextTokenCallback;

  constructor(public readonly parseTable: ParseTable, config: any = {}) {
    super();
    this.beforeAddingChildNode = config.beforeAddingChildNode;
    this.onReduction = config.onReduction;
    this.onNextToken = config.onNextToken;
  }

  get grammar(): Grammar {
    return this.parseTable.grammar;
  }

  /**
   * Parses the input and returns the resulting root Parse Tree node.
   */
  protected parseInput(input: TLEX.Tape): Nullable<PTNode> {
    let idCounter = 0;
    this.stack = new ParseStack();
    this.stack.push(0, new PTNode(idCounter++, this.grammar.augStartRule.nt, null));
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
        const newNode = new PTNode(idCounter++, nextSym, nextValue);
        stack.push(action.gotoState!, newNode);
      } else {
        // reduce
        TSU.assert(action.rule != null, "Nonterm and ruleindex must be provided for a reduction action");
        const ruleLen = action.rule.rhs.length;
        // pop this many items off the stack and create a node
        // from this
        let newNode = new PTNode(idCounter++, action.rule.nt, null);
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
   * Pick an action among several actions based on several factors (eg
   * curr parse stack, tokenbuffer etc).
   */
  resolveActions(actions: LRAction[], stack: ParseStack, tokenbuffer: TLEX.TokenBuffer): LRAction {
    if (actions.length > 1) {
      throw new Error("Multiple actions found.");
    }
    return actions[0];
  }
}
