import * as TSU from "@panyam/tsutils";
import { Grammar, Sym, Str, Rule } from "./grammar";

type NumMap<T> = TSU.NumMap<T>;
type StringMap<T> = TSU.StringMap<T>;
type Nullable<T> = TSU.Nullable<T>;

const defaultKeyFunc = (x: any) => x.key;

export class Trie<T> {
  protected keyFunc: (t: T) => string;
  readonly root: TrieNode<T> = new TrieNode();

  constructor(keyFunc: (t: T) => string) {
    this.keyFunc = keyFunc;
  }

  add(values: T[], fromIndex = 0): TrieNode<T> {
    // we are at the bottom
    let curr = this.root;
    for (let i = fromIndex; i < values.length; i++) {
      const key = this.keyFunc(values[i]);
      if (curr.children.has(key)) {
        curr = curr.children.get(key)!;
      } else {
        const newNode = new TrieNode<T>();
        newNode.value = values[i];
        newNode.parent = curr;
        curr.children.set(key, newNode);
        curr = newNode;
      }
    }
    curr.isLeaf = true;
    return curr;
  }

  get debugValue(): any {
    return this.root.debugValue;
  }
}

export class TrieNode<T> {
  isLeaf = false;
  value: Nullable<T> = null;
  parent: Nullable<TrieNode<T>> = null;
  children = new Map<string, TrieNode<T>>();

  get debugValue(): any {
    const out = { value: this.value, children: {} as any } as any;
    if (this.isLeaf) out["isLeaf"] = true;
    for (const [key, value] of this.children.entries()) {
      out.children[key] = value.debugValue;
    }
    return out;
  }
}

export class IDSet<T extends { id: number }> {
  protected _entries: T[] = [];
  protected _entriesByKey: StringMap<T> = {};
  protected keyFunc: (t: T) => string;

  constructor(keyFunc: (t: T) => string = defaultKeyFunc) {
    this.keyFunc = keyFunc;
  }

  clear(): void {
    this._entries = [];
    this._entriesByKey = {};
  }

  /**
   * Removes all entries that match a predict.
   */
  remove(predicate: (t: T) => boolean): boolean {
    const e2: T[] = [];
    this._entriesByKey = {};
    let modified = false;
    for (let l = 0; l < this._entries.length; l++) {
      const e = this._entries[l];
      if (!predicate(e)) {
        // keep it if predicate failes
        e.id = e2.length;
        e2.push(e);
        this._entriesByKey[this.keyFunc(e)] = e;
      } else {
        modified = true;
      }
    }
    this._entries = e2;
    return modified;
  }

  get entries(): ReadonlyArray<T> {
    return this._entries;
  }

  get(id: number): T {
    TSU.assert(id >= 0 && id < this._entries.length);
    return this._entries[id];
  }

  getByKey(key: string): Nullable<T> {
    return this._entriesByKey[key] || null;
  }

  ensure(entry: T, throwIfExists = false): T {
    // see if this itemset exists
    if (this.has(entry)) {
      if (throwIfExists) throw new Error(`Entry ${this.keyFunc(entry)} already exists`);
      return this._entriesByKey[this.keyFunc(entry)];
    } else {
      this._entriesByKey[this.keyFunc(entry)] = entry;
      entry.id = this._entries.length;
      this._entries.push(entry);
    }
    return entry;
  }

  has(entry: T): boolean {
    return this.keyFunc(entry) in this._entriesByKey;
  }

  get size(): number {
    return this._entries.length;
  }
}

export class SymbolSet {
  readonly grammar: Grammar;
  readonly enforceSymbolType: Nullable<boolean>;
  entries = new Set<number>();
  hasNull = false;

  constructor(grammar: Grammar, enforceSymbolType: Nullable<boolean> = true) {
    this.grammar = grammar;
    this.enforceSymbolType = enforceSymbolType;
  }

  get debugString(): string {
    return "<" + this.labels().sort().join(", ") + ">";
  }

  labels(skipAux = false): string[] {
    const out: string[] = [];
    for (const i of this.entries) {
      const exp = this.grammar.getSymById(i);
      TSU.assert(exp != null);
      if (!skipAux || !exp.isAuxiliary) out.push(exp.label);
    }
    if (this.hasNull) out.push("");
    return out;
  }

  addFrom(another: SymbolSet, includeNull = true): number {
    return another.addTo(this, includeNull);
  }

  addTo(another: SymbolSet, includeNull = true): number {
    const before = another.entries.size;
    for (const termid of this.entries) {
      another.entries.add(termid);
    }
    if (includeNull) {
      another.hasNull = this.hasNull || another.hasNull;
    }
    return another.entries.size - before;
  }

  has(term: Sym): boolean {
    return this.entries.has(term.id);
  }

  add(term: Sym): this {
    TSU.assert(
      this.enforceSymbolType == null || this.enforceSymbolType == term.isTerminal,
      `Terminal types being enforced: ${this.enforceSymbolType}`,
    );
    this.entries.add(term.id);
    return this;
  }

  delete(term: Sym): boolean {
    return this.entries.delete(term.id);
  }

  get size(): number {
    return this.entries.size + (this.hasNull ? 1 : 0);
  }
}

/**
 * Tells which non terminals are nullables.
 */
export class NullableSet {
  readonly grammar: Grammar;
  entries: Set<number>;
  private visited: any;

  constructor(grammar: Grammar) {
    this.grammar = grammar;
    this.refresh();
  }

  get nonterms(): Sym[] {
    const out: Sym[] = [];
    this.entries.forEach((id) => {
      const e = this.grammar.getSymById(id);
      TSU.assert(e != null && !e.isTerminal);
      out.push(e);
    });
    return out;
  }

  refresh(): void {
    // Nuke entries cache.  Will force isNullable to recompute.
    this.entries = new Set();
    this.visited = {};

    let beforeCount = 0;
    do {
      beforeCount = this.entries.size;
      this.grammar.nonTerminals.forEach((nt) => this.visit(nt));
    } while (beforeCount != this.entries.size);
  }

  protected visit(nt: Sym): void {
    for (const rule of this.grammar.rulesForNT(nt)) {
      if (this.isStrNullable(rule.rhs)) {
        this.add(nt);
        break;
      }
    }
  }

  isNullable(nt: Sym): boolean {
    return !nt.isTerminal && this.entries.has(nt.id);
  }

  isStrNullable(str: Str, fromIndex = 0, toIndex: Nullable<number> = null): boolean {
    if (toIndex == null) {
      toIndex = str.length - 1;
    }
    for (let i = fromIndex; i <= toIndex; i++) {
      if (!this.isNullable(str.syms[i])) {
        return false;
      }
    }
    return true;
  }

  add(nt: Sym): void {
    TSU.assert(!nt.isTerminal);
    this.entries.add(nt.id);
  }
}

class SymSymbolSets {
  readonly grammar: Grammar;
  entries: NumMap<SymbolSet> = {};
  private _count = 0;

  constructor(grammar: Grammar) {
    this.grammar = grammar;
  }

  refresh(): void {
    this.entries = {};
    this._count = 0;
  }

  forEachTerm(nt: Sym, visitor: (x: Nullable<Sym>) => boolean | void): void {
    const entries = this.entriesFor(nt);
    entries.entries.forEach((x) => {
      const term = this.grammar.getSymById(x);
      TSU.assert(term != null && term.isTerminal);
      visitor(term);
    });
    if (entries.hasNull) visitor(null);
  }

  get debugValue(): any {
    const out = {} as any;
    for (const x in this.entries) out[this.grammar.getSymById(x as any)!.label] = this.entries[x].debugString;
    return out;
  }

  get count(): number {
    let c = 0;
    for (const x in this.entries) c += this.entries[x].size;
    return c;
    // TSU.assert(c == this._count, "Count mismatch")
    // return this._count;
  }

  entriesFor(sym: Sym): SymbolSet {
    if (sym.id in this.entries) {
      return this.entries[sym.id];
    } else {
      const out = new SymbolSet(this.grammar);
      this.entries[sym.id] = out;
      return out;
    }
  }

  /**
   * Add the null symbol into this set of terminals for a given expression.
   */
  addNull(nt: Sym): boolean {
    const entries = this.entriesFor(nt);
    if (entries.hasNull) return false;
    entries.hasNull = true;
    return true;
  }

  /**
   * Add a Null, term or another expression to the set of terminals
   * for a given expression.  If source is an expression then all
   * of the source expression's terminal symbosl are added to exp's
   * term set.
   */
  add(nt: Sym, source: Sym, includeNull = true): boolean {
    if (nt.isTerminal) {
      TSU.assert(false, "Should not be here");
    }
    const entries = this.entriesFor(nt);
    if (source.isTerminal) {
      if (entries.has(source)) return false;
      // console.log(`Adding Term(${term.label}) to Set of ${exp.id}`);
      entries.add(source);
      this._count++;
    } else {
      const srcEntries = this.entriesFor(source);
      const destEntries = this.entriesFor(nt);
      const count = srcEntries.addTo(destEntries, includeNull);
      this._count += count;
    }
    return true;
  }
}

/**
 * For each symbol maps its label to a list of terminals that
 * start that non terminal.
 */
export class FirstSets extends SymSymbolSets {
  readonly nullables: NullableSet;

  constructor(grammar: Grammar, nullables?: NullableSet) {
    super(grammar);
    if (!nullables) {
      nullables = new NullableSet(grammar);
    }
    this.nullables = nullables;
    this.refresh();
  }

  /**
   * For a given string return the first(str) starting at a given index.
   * Including eps if it exists.
   */
  forEachTermIn(str: Str, fromIndex = 0, visitor: (term: Nullable<Sym>) => void): void {
    // This needs to be memoized by exp.id + index
    const syms = str.syms;
    const visited = {} as any;
    let allNullable = true;
    for (let j = fromIndex; allNullable && j < syms.length; j++) {
      const symj = syms[j];
      if (symj.isTerminal) {
        visitor(symj);
        allNullable = false;
      } else {
        const nt = symj as Sym;
        this.forEachTerm(nt, (term) => {
          if (term != null && !(term.id in visited)) {
            visited[term.id] = true;
            visitor(term);
          }
        });
        if (!this.nullables.isNullable(symj as Sym)) {
          allNullable = false;
        }
      }
    }
    if (allNullable) visitor(null);
  }

  /**
   * Reevaluates the first sets of a grammar.
   * This method assumes that the grammar's nullables are fresh.
   */
  refresh(): void {
    super.refresh();
    // this.grammar.terminals.forEach((t) => this.add(t, t));

    let beforeCount = 0;
    do {
      beforeCount = this.count;
      this.grammar.forEachRule(null, (rule) => {
        this.processRule(rule);
      });
    } while (beforeCount != this.count);
  }

  processRule(rule: Rule): void {
    const nullables = this.nullables;
    let allNullable = true;
    for (const s of rule.rhs.syms) {
      // First(s) - null will be in First(nonterm)
      // Null will onlybe added if all symbols are nullable
      this.add(rule.nt, s, false);
      if (s.isTerminal || !nullables.isNullable(s as Sym)) {
        // since s is not nullable the next rule's first set
        // cannot affect nonterm's firs set
        allNullable = false;
        break;
      }
    }
    if (allNullable) this.addNull(rule.nt);
  }
}

/**
 * For each symbol maps its label to a list of terminals that
 * start that non terminal.
 */
export class FollowSets extends SymSymbolSets {
  readonly firstSets: FirstSets;

  constructor(grammar: Grammar, firstSets?: FirstSets) {
    super(grammar);
    this.firstSets = firstSets || new FirstSets(grammar);
    this.refresh();
  }

  get nullables(): NullableSet {
    return this.firstSets.nullables;
  }

  /**
   * Reevaluates the follow sets of each expression in our grammar.
   * This method assumes that the grammar's nullables and firstSets are
   * up-to-date.
   */
  refresh(): void {
    super.refresh();
    const g = this.grammar;
    TSU.assert(g.startSymbol != null, "Select start symbol of the grammar");
    this.add(g.startSymbol, g.Eof);

    // Augmented start symbol
    // const augStart = new Sym("");
    // augStart.add(new Seq(g.startSymbol, g.Eof));

    let beforeCount = 0;
    do {
      beforeCount = this.count;
      this.grammar.forEachRule(null, (rule) => this.processRule(rule));
    } while (beforeCount != this.count);
  }

  /**
   * Add Follows[source] into Follows[dest] recursively.
   */
  processRule(rule: Rule): void {
    const syms = rule.rhs.syms;
    const firstSets = this.firstSets;
    const nullables = this.firstSets.nullables;

    // Rule 1:
    //  If A -> aBb1b2b3..bn:
    //    Follow(B) = Follow(B) U { First(b1b2b3...bn) - eps }
    for (let i = 0; i < syms.length; i++) {
      const sym = syms[i];
      if (sym.isTerminal) continue;
      firstSets.forEachTermIn(rule.rhs, i + 1, (term) => {
        if (term != null) this.add(sym, term);
      });
    }

    // Rule 2:
    //  If A -> aBb1b2b3..bn:
    //    if Nullable(b1b2b3...bn):
    //      Follow(B) = Follow(B) U Follow(N)
    for (let i = syms.length - 1; i >= 0; i--) {
      if (syms[i].isTerminal) continue;

      // This needs to be memoized??
      let allNullable = true;
      for (let j = i + 1; j < syms.length; j++) {
        const symj = syms[j];
        if (symj.isTerminal || !nullables.isNullable(symj as Sym)) {
          allNullable = false;
          break;
        }
      }
      if (allNullable) {
        this.add(syms[i], rule.nt);
      }
    }
  }
}
