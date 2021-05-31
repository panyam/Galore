import * as TSU from "@panyam/tsutils";
import { Sym, Grammar, Rule } from "./grammar";
import { IDSet } from "./sets";

type Nullable<T> = TSU.Nullable<T>;
type NumMap<T> = TSU.NumMap<T>;

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
  readonly grammar: Grammar;

  gotoSymbolSorter: null | ((s1: Sym, s2: Sym) => number) = null;

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

  constructor(grammar: Grammar, config: any = null) {
    config = config || {};
    this.gotoSymbolSorter = config.gotoSymbolSorter || null;
    this.grammar = grammar;
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
      let allSymbols = this.grammar.allSymbols;
      if (this.gotoSymbolSorter) {
        allSymbols = allSymbols.map((x) => x).sort(this.gotoSymbolSorter);
      }
      for (const sym of allSymbols) {
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
