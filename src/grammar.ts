import * as TSU from "@panyam/tsutils";
import { allMinimalCycles } from "./graph";
import { IDSet, SymbolSet, FirstSets, FollowSets, NullableSet } from "./sets";

type StringMap<T> = TSU.StringMap<T>;
type Nullable<T> = TSU.Nullable<T>;

/**
 * Symbols represent both terminals and non-terminals in our system.
 * Chosing a convention of using a single class to represent both instead
 * of a base class with Term and NonTerm children has the following effects:
 * 1. We can change the type of a literal when doing things like reading
 *    a grammar DSL when we dont konw if a symbol is a term or non-term
 *    until *all* the declarations have been read and parsed.
 * 2. The down side of this we would need more explicit isTerm checks
 *    but we would have done that anyway by calling getTerm and getNT
 *    verions of the getSym method.
 */
export class Sym {
  isAuxiliary = false;
  auxType: string | null = null;
  precedence = 1;
  assocLeft = true;

  private static idCounter = -1;

  /**
   * An ID assigned to indicate order of "creation" of this symbol in the grammar.
   */
  creationId = -1;

  /**
   * ID unique across all expression within the grammar.
   */
  id: number;

  /**
   * Creates a new symbol in the grammar.
   *
   * @param   grammar     Grammar this symbol belongs to.
   * @param   label       Label for the symbol.
   * @param   isTerminal  Whether the symbol is a terminal or not.
   * @param   id          ID unique across all expression within the
   *                      grammar.
   */
  constructor(
    public readonly grammar: Grammar,
    public readonly label: string,
    public isTerminal: boolean,
    id: Nullable<number> = null,
  ) {
    this.isTerminal = isTerminal;
    this.label = label;
    if (id == null) {
      this.id = Sym.idCounter--;
    } else {
      this.id = id;
    }
  }

  compareTo(another: this): number {
    return this.label.localeCompare(another.label);
  }

  equals(another: this): boolean {
    return this.label == another.label;
  }

  toString(): string {
    return this.label;
  }
}

export class Str {
  syms: Sym[];

  constructor(...syms: Sym[]) {
    this.syms = syms || [];
  }

  append(...lits: Sym[]): this {
    for (const l of lits) this.syms.push(l);
    return this;
  }

  extend(...strs: Str[]): this {
    for (const s of strs) this.append(...s.syms);
    return this;
  }

  copy(): Str {
    return new Str(...this.syms);
  }

  add(lit: Sym): void {
    this.syms.push(lit);
  }

  isTerminal(index: number): boolean {
    return this.syms[index].isTerminal;
  }

  get length(): number {
    return this.syms.length;
  }

  toString(): string {
    return this.syms.map((s) => s.toString()).join(" ");
  }

  slice(startIndex: number, endIndex: number): Str {
    return new Str(...this.syms.slice(startIndex, endIndex));
  }

  splice(index: number, numToDelete: number, ...itemsToAdd: Sym[]): Str {
    this.syms.splice(index, numToDelete, ...itemsToAdd);
    return this;
  }

  compareTo(another: this): number {
    for (let i = 0; i < this.syms.length && i < another.syms.length; i++) {
      const diff = this.syms[i].compareTo(another.syms[i]);
      if (diff != 0) return diff;
    }
    return this.syms.length - another.syms.length;
  }

  equals(another: this): boolean {
    return this.compareTo(another) == 0;
  }

  /**
   * Returns true if another string is a substring within
   * this string at the given offset.
   */
  containsAt(offset: number, another: Str): boolean {
    let i = 0;
    for (; i < another.length && offset + i < this.syms.length; i++) {
      if (!this.syms[offset + i].equals(another.syms[i])) return false;
      // if (this.cardinalities[i] != another.cardinalities[i]) return false;
    }
    return i == another.length;
  }

  get debugString(): string {
    return this.syms.map((lit) => lit.label).join(" ");
  }
}

export class RuleAction {
  constructor(public value: string | number) {}

  get isFunction(): boolean {
    return typeof this.value === "string";
  }

  get isChildPosition(): boolean {
    return typeof this.value === "number";
  }
}

export class Rule {
  id: number;
  constructor(public nt: Sym, public rhs: Str, public action: RuleAction | null = null) {
    if (nt.isTerminal) {
      throw new Error("Cannot add rules to a terminal");
    }
  }

  get debugString(): string {
    return `${this.nt.label} -> ${this.rhs.debugString}`;
  }

  equals(another: this): boolean {
    return this.compareTo(another) == 0;
  }

  compareTo(another: this): number {
    TSU.assert(!isNaN(this.id));
    const diff = this.nt.compareTo(another.nt);
    if (diff == 0) {
      this.rhs.compareTo(another.rhs);
    }
    return diff;
  }
}

export class Grammar {
  public startSymbol: Nullable<Sym> = null;
  modified = true;
  protected symbolSet = new IDSet<Sym>((s) => s.label);
  protected allRules: Rule[] = [];
  protected _rulesForNT: Nullable<StringMap<Rule[]>> = null;
  protected _followSets: Nullable<FollowSets> = null;

  /**
   * Prefix used for auxiliary symbols.
   */
  auxNTPrefix: string;

  readonly Null: Sym;
  readonly Eof: Sym;
  private _AugStartRule: Rule;
  private _hasNull = false;

  /**
   * A way of creating Grammars with a "single expresssion".
   */
  static make(callback: (g: Grammar) => void): Grammar {
    const g = new Grammar();
    callback(g);
    return g;
  }

  constructor(config?: any) {
    config = config || {};
    this.auxNTPrefix = config.auxNTPrefix || "$";
    this.Null = this.newTerm("");
    this.Eof = this.newTerm("$end");
  }

  rulesForNT(nt: Sym): Rule[] {
    TSU.assert(!nt.isTerminal);
    if (this._rulesForNT == null) {
      this._rulesForNT = {};
      for (const rule of this.allRules) {
        if (!(rule.nt.label in this._rulesForNT)) {
          this._rulesForNT[rule.nt.label] = [];
        }
        this._rulesForNT[rule.nt.label].push(rule);
      }
    }
    if (!(nt.label in this._rulesForNT)) {
      this._rulesForNT[nt.label] = [];
    }
    return this._rulesForNT[nt.label];
  }

  get nullables(): NullableSet {
    return this.firstSets.nullables;
  }

  get firstSets(): FirstSets {
    return this.followSets.firstSets;
  }

  get followSets(): FollowSets {
    if (this.modified || this._followSets == null) {
      this.refresh();
    }
    TSU.assert(this._followSets != null);
    return this._followSets;
  }

  get augStartRule(): Rule {
    return this._AugStartRule;
  }

  augmentStartSymbol(label = "$accept"): this {
    TSU.assert(this._AugStartRule == null, "Ensure this grammar has not yet been augmented.");
    TSU.assert(this.startSymbol != null, "Start symbol not yet set");
    const augSym = this.newNT(label);
    this._AugStartRule = new Rule(augSym, new Str(this.startSymbol));
    this.addRule(this._AugStartRule, 0);
    return this;
  }

  refresh(): this {
    this.symbolSet.entries.forEach((s, i) => (s.id = i));
    this._rulesForNT = null;
    this.allRules.forEach((rule, i) => {
      rule.id = i;
    });
    this._followSets = new FollowSets(this);
    this.modified = false;
    return this;
  }

  addTerminals(...terminals: string[]): void {
    for (const t of terminals) {
      this.newTerm(t);
    }
  }

  get terminals(): ReadonlyArray<Sym> {
    return this.symbolSet.entries.filter((x) => x.isTerminal);
  }

  get allNonTerminals(): ReadonlyArray<Sym> {
    return this.symbolSet.entries.filter((x) => !x.isTerminal);
  }

  get nonTerminals(): ReadonlyArray<Sym> {
    return this.symbolSet.entries.filter((x) => !x.isTerminal && !x.isAuxiliary);
  }

  get auxNonTerminals(): ReadonlyArray<Sym> {
    return this.symbolSet.entries.filter((x) => x.isAuxiliary);
  }

  get allSymbols(): ReadonlyArray<Sym> {
    return this.symbolSet.entries;
  }

  /**
   * A way to quickly iterate through all non-terminals.
   */
  forEachNT(visitor: (nt: Sym) => void | boolean | undefined | null): void {
    for (const sym of this.symbolSet.entries) {
      if (sym.isTerminal) continue;
      if (visitor(sym) == false) return;
    }
  }

  /**
   * A iterator across all the rules for either all non terminals in this grammar
   * for a single non terminal (if the nt value is non null).
   *
   * @param visitor
   */
  forEachRule(nt: Nullable<Sym>, visitor: (rule: Rule, index: number) => void | boolean | undefined | null): boolean {
    const rules = nt == null ? this.allRules : this.rulesForNT(nt) || [];
    for (let i = 0; i < rules.length; i++) {
      if (visitor(rules[i], i) == false) return false;
    }
    return true;
  }

  getRule(nt: string | Sym, index: number): Rule {
    if (typeof nt === "string") nt = this.getSym(nt)!;
    TSU.assert(nt != null);
    return this.rulesForNT(nt)[index];
  }

  /**
   * Return the the index of a rule if it already exists to prevent duplicates.
   */
  findRule(nt: Sym, production: Str): number {
    return this.rulesForNT(nt).findIndex((r) => r.nt == nt && r.rhs.equals(production));
  }

  /**
   * Adds a new rule to a particular non terminal of the grammar
   * Each rule represents a production of the form:
   *
   * name -> A B C D;
   *
   * Null production can be represented with an empty exps list.
   */
  add(nt: string | Sym, production: Str, action: RuleAction | null = null): Rule {
    let nonterm: Nullable<Sym> = null;
    if (typeof nt === "string") {
      nonterm = this.getSym(nt);
      if (nonterm == null) {
        // create it
        nonterm = this.newNT(nt);
      }
    } else {
      nonterm = this.ensureSym(nt);
    }
    return this.addRule(new Rule(nonterm, production, action));
  }

  /**
   * Add a rule directly.
   */
  addRule(rule: Rule, index = -1): Rule {
    if (this.findRule(rule.nt, rule.rhs) >= 0) {
      throw new Error("Duplicate rule: " + rule.debugString);
    }
    rule.id = this.allRules.length;
    if (rule.rhs.length == 0) this._hasNull = true;
    if (index < 0) {
      this.allRules.push(rule);
    } else {
      this.allRules.splice(index, 0, rule);
    }
    this._rulesForNT = null;
    // this.rulesForNT(rule.nt).push(rule);
    this.modified = true;
    return rule;
  }

  /**
   * Removes all rules from the grammar which match the given predicate.
   */
  removeRules(pred: (r: Rule) => boolean): boolean {
    this.allRules = this.allRules.filter((r) => !pred(r));
    this._rulesForNT = null;
    this.modified = true;
    return true;
  }

  /**
   * Removes all symbols from the grammar and all of its productions which match
   * a particular predicate.
   */
  removeSymbols(pred: (s: Sym) => boolean): boolean {
    let modified = false;
    const newRules: Rule[] = [];
    this.allRules.forEach((r) => {
      if (pred(r.nt)) return;
      // if it was already a null production then leave it
      if (r.rhs.length == 0) {
        newRules.push(r);
      } else {
        const newRhs = new Str(...r.rhs.syms.filter((s) => !pred(s)));
        modified = modified || r.rhs.length != newRhs.length;
        if (newRhs.length > 0) {
          newRules.push(new Rule(r.nt, newRhs));
        }
      }
    });
    this.allRules = newRules;
    modified = this.symbolSet.remove(pred) || modified;
    this.modified = this.modified || modified;
    return modified;
  }

  /**
   * Gets or creates a terminal with the given label.
   * The grammar acts as a factory for terminal symbols
   * so that we can reuse symbols instead of having
   * users create new symbols each time.
   *
   * This also ensures that users are not able mix terminal
   * and non terminal labels.
   */
  getSymById(id: number): Nullable<Sym> {
    // if (id == Grammar.AUG_SYM_ID) return this._AugStartRule?.nt || null;
    // else if (id == this.Eof.id) return this.Eof;
    // else if (id == this.Null.id) return this.Null;
    return this.symbolSet.get(id);
  }

  getSym(label: string): Nullable<Sym> {
    // if (this._AugStartRule && label == this._AugStartRule.nt.label) return this._AugStartRule.nt;
    return this.symbolSet.getByKey(label);
  }

  ensureSym(sym: Sym, throwIfExists = false): Sym {
    const sym2 = this.symbolSet.ensure(sym, throwIfExists);
    if (sym == sym2) {
      if (sym2.creationId < 0) {
        sym2.creationId = this.symbolSet.size;
      }
    } else {
      TSU.assert(!throwIfExists, "Should have already thrown error");
    }
    return sym2;
  }

  /**
   * Ensures that a terminal by a given name exists (creating if
   * necessary).  If a terminal already exists by this label then
   * an error is thrown.
   *
   * The grammar acts as a factory for terminal and non terminal symbols
   * so that we can reuse symbols instead of having users create new
   * symbols each time.  This also ensures that users are not able mix
   * terminal and non terminal labels.
   */
  T(label: string, throwIfExists = false): Sym {
    let t = this.getSym(label);
    if (t != null) {
      if (throwIfExists) throw new Error(`Terminal ${label} is already exists`);
      if (!t.isTerminal) throw new Error(`Symbol (${label}) already exists as a non-terminal`);
    } else {
      t = new Sym(this, label, true);
      t = this.ensureSym(t, true);
    }
    return t;
  }

  /**
   * Ensures that a non term by a given name exists (creating if
   * necessary).  If a terminal already exists by this label then
   * an error is thrown.
   *
   * The grammar acts as a factory for terminal and non terminal symbols
   * so that we can reuse symbols instead of having users create new
   * symbols each time.  This also ensures that users are not able mix
   * terminal and non terminal labels.
   */
  NT(label: string, isAuxiliary = false, throwIfExists = false): Sym {
    let nt = this.getSym(label);
    if (nt != null) {
      if (throwIfExists) throw new Error(`Non-terminal ${label} is already exists`);
      if (nt.isTerminal) throw new Error(`Symbol (${label}) already exists as a terminal`);
    } else {
      nt = new Sym(this, label, false);
      nt.isAuxiliary = isAuxiliary;
      nt = this.ensureSym(nt, true);
      if (!isAuxiliary && this.startSymbol == null) {
        this.startSymbol = nt;
      }
    }
    return nt;
  }

  /**
   * Creates a terminal with the given label if one does not
   * already exist.
   */
  newTerm(label: string): Sym {
    return this.T(label, true);
  }

  /**
   * Creates a non terminal with the given label if it does not
   * already exist.
   */
  newNT(label: string, isAuxiliary = false): Sym {
    return this.NT(label, isAuxiliary, true);
  }

  /**
   * Checks if a given label is a terminal.
   */
  isTerminal(label: string): boolean {
    const t = this.getSym(label);
    return t != null && t.isTerminal;
  }

  /**
   * Checks if a given label is a non-terminal.
   */
  isNT(label: string): boolean {
    const t = this.getSym(label);
    return t != null && !t.isTerminal && !t.isAuxiliary;
  }

  /**
   * Checks if a given label is an auxiliary non-terminal.
   */
  isAuxNT(label: string): boolean {
    const t = this.getSym(label);
    return t != null && !t.isTerminal && t.isAuxiliary;
  }

  seq(...exps: (Str | string)[]): Str {
    if (exps.length == 1) {
      return this.normalizeRule(exps[0]);
    } else {
      const out = new Str();
      for (const e of exps) {
        const s = this.normalizeRule(e);
        // insert string here inline
        // A ( B C D ) => A B C D
        for (let i = 0; i < s.length; i++) {
          // out.add(s.syms[i], s.cardinalities[i]);
          out.add(s.syms[i]);
        }
      }
      return out;
    }
  }

  /**
   * Provides a union rule:
   *
   * (A | B | C | D)
   *
   * Each of A, B, C or D themselves could be strings or literals.
   */
  anyof(...rules: (Str | string)[]): Str {
    if (rules.length == 1) {
      return this.normalizeRule(rules[0]);
    } else {
      // see if there is already NT with the exact set of rules
      // reuse if it exists.  That would make this method
      // Idempotent (which it needs to be).
      return new Str(this.ensureAuxNT(...rules.map((r) => this.normalizeRule(r))));
    }
  }

  opt(exp: Str | string): Str {
    // convert to aux rule
    const out = this.anyof(exp, new Str());
    const nt = out.syms[0];
    TSU.assert(out.syms.length == 1 && nt.isAuxiliary, "NT must be an auxiliary symbol");
    nt.auxType = "opt";
    return out;
  }

  atleast0(exp: Str | string, leftRec = true): Str {
    const s = this.normalizeRule(exp);
    // We want to find another auxiliary NT that has the following rules:
    //    X -> exp X | ;    # if leftRec = true
    //
    //    X -> X exp | ;    # otherwise:
    let auxNT = this.findAuxNT((auxNT) => {
      const rules = this.rulesForNT(auxNT);
      if (rules.length != 2) return false;

      let which = 0;
      if (rules[0].rhs.length == 0) {
        which = 1;
      } else if (rules[1].rhs.length == 0) {
        which = 0;
      } else {
        return false;
      }

      const rule = rules[which].rhs;
      if (rule.length != 1 + exp.length) return false;
      if (rule.syms[0].equals(auxNT)) {
        return rule.containsAt(1, s);
      } else if (rule.syms[rule.length - 1].equals(auxNT)) {
        return rule.containsAt(0, s);
      }
      return false;
    });
    if (auxNT == null) {
      auxNT = this.newAuxNT();
      auxNT.auxType = leftRec ? "atleast0:left" : "atleast0";
      this.add(auxNT, new Str());
      if (leftRec) {
        this.add(auxNT, new Str(auxNT).extend(s));
      } else {
        this.add(auxNT, s.copy().append(auxNT));
      }
    }
    return new Str(auxNT);
  }

  atleast1(exp: Str | string, leftRec = true): Str {
    const s = this.normalizeRule(exp);
    // We want to find another auxiliary NT that has the following rules:
    //    X -> exp X | exp ;    # if leftRec = true
    //
    //    X -> X exp | exp ;    # otherwise:
    let auxNT = this.findAuxNT((auxNT) => {
      const rules = this.rulesForNT(auxNT);
      if (rules.length != 2) return false;

      let which = 0;
      if (rules[0].rhs.equals(s)) {
        which = 1;
      } else if (rules[1].rhs.equals(s)) {
        which = 0;
      } else {
        return false;
      }

      const rule = rules[which].rhs;
      if (rule.length != 1 + exp.length) return false;
      if (rule.syms[0].equals(auxNT)) {
        return rule.containsAt(1, s);
      } else if (rule.syms[rule.length - 1].equals(auxNT)) {
        return rule.containsAt(0, s);
      }
      return false;
    });
    if (auxNT == null) {
      auxNT = this.newAuxNT();
      auxNT.auxType = leftRec ? "atleast1:left" : "atleast1";
      this.add(auxNT, s);
      if (leftRec) {
        this.add(auxNT, new Str(auxNT).extend(s));
      } else {
        this.add(auxNT, s.copy().append(auxNT));
      }
    }
    return new Str(auxNT);
  }

  normalizeRule(exp: Str | string): Str {
    if (typeof exp === "string") {
      const lit = this.getSym(exp);
      if (lit == null) throw new Error(`Invalid symbol: '${exp}'`);
      return new Str(lit);
    } else {
      // We have an expression that needs to be fronted by an
      // auxiliarry non-terminal
      return exp;
    }
  }

  // Override this to have a different
  protected auxNTCount = 0;
  protected newAuxNTName(): string {
    return this.auxNTPrefix + this.auxNTCount++;
  }

  newAuxNT(name = ""): Sym {
    if (name == "") name = this.newAuxNTName();
    return this.newNT(name, true);
  }

  ensureAuxNT(...rules: Str[]): Sym {
    let nt = this.findAuxNTByRules(...rules);
    if (nt == null) {
      nt = this.newAuxNT();
      nt.auxType = "anyof";
      for (const rule of rules) this.add(nt, rule);
    }
    return nt;
  }

  /**
   * Find an auxiliary rule that has the same rules as the ones here.
   * This can be used to ensure duplicate rules are not created for
   * union expressions.
   */
  findAuxNT(filter: (nt: Sym) => boolean): Nullable<Sym> {
    for (const auxNT of this.symbolSet.entries) {
      if (!auxNT.isAuxiliary) continue;
      if (filter(auxNT)) return auxNT;
    }
    return null;
  }

  findAuxNTByRules(...rules: Str[]): Nullable<Sym> {
    return this.findAuxNT((auxNT) => {
      const ntRules = this.rulesForNT(auxNT);
      if (ntRules.length != rules.length) return false;
      for (let i = 0; i < ntRules.length; i++) {
        if (!ntRules[i].rhs.equals(rules[i])) return false;
      }
      return true;
    });
  }

  print(options: any = null): string[] {
    options = options || {};
    const ruleSep = options.ruleSep || "->";
    const includeSemiColon = options.includeSemiColon || false;
    const lambdaSymbol = options.lambdaSymbol || "";
    const out: string[] = [];
    this.forEachRule(null, (rule: Rule, index: number) => {
      let r = `${rule.nt.label} ${ruleSep} `;
      if (rule.rhs.length > 0) r += rule.rhs.debugString;
      else r += lambdaSymbol;
      if (includeSemiColon) r += " ;";
      out.push(r);
    });
    return out;
  }

  /**
   * Returns a flat list of all productions in a single list.
   */
  get debugValue(): string[] {
    const out: string[] = [];
    this.forEachRule(null, (rule: Rule, index: number) => {
      out.push(`${rule.nt.label} -> ${rule.rhs.debugString}`);
    });
    return out;
  }

  /**
   * Returns all non terminals that can derive terminals.
   */
  get terminalDerivingSymbols(): SymbolSet {
    const out = new SymbolSet(this, null);
    let nadded = -1;
    let allDerive = true;
    while (nadded != 0) {
      nadded = 0;
      for (const rule of this.allRules) {
        allDerive = true;
        for (const sym of rule.rhs.syms) {
          if (!out.has(sym)) {
            if (sym.isTerminal) {
              out.add(sym);
              nadded++;
            } else {
              allDerive = false;
            }
          }
        }
        if (allDerive && !out.has(rule.nt)) {
          out.add(rule.nt);
          nadded++;
        }
      }
    }
    return out;
  }

  /*
   * Returns all non terminal that are reachable from a given symbol.
   * If the FROM symbol is omitted then the start symbol is used.
   */
  reachableSymbols(fromSymbol: Nullable<Sym> = null): SymbolSet {
    if (fromSymbol == null) {
      fromSymbol = this._AugStartRule ? this._AugStartRule.nt : this.startSymbol;
    }
    TSU.assert(fromSymbol != null, "Start symbol does not exist");
    const reachable = new SymbolSet(this, false).add(fromSymbol);
    let queue: Sym[] = [fromSymbol];
    while (queue.length > 0) {
      const newQueue: Sym[] = [];
      for (const curr of queue) {
        for (const rule of this.rulesForNT(curr)) {
          for (const sym of rule.rhs.syms) {
            if (!sym.isTerminal && !reachable.has(sym)) {
              newQueue.push(sym);
              reachable.add(sym);
            }
          }
        }
      }
      queue = newQueue;
    }
    return reachable;
  }

  /**
   * Returns all cycles in this grammar.
   */
  get cycles(): ReadonlyArray<[Sym, any]> {
    /*
     * Returns the edge of the given nonterm
     * For a nt such that:
     *             S -> alpha1 X1 beta1 |
     *                  alpha2 X2 beta2 |
     *                  ...
     *                  alphaN XN betaN |
     *
     * S's neighbouring nodes would be Xk if all of alphak is optional
     * AND all of betak is optional
     */
    const edgeFunctor = (node: Sym): [Sym, any][] => {
      const out: [Sym, any][] = [];
      this.forEachRule(node, (rule, ruleIndex) => {
        rule.rhs.syms.forEach((s, j) => {
          if (s.isTerminal) return;
          if (this.nullables.isStrNullable(rule.rhs, 0, j - 1) && this.nullables.isStrNullable(rule.rhs, j + 1)) {
            out.push([s, [node, ruleIndex]]);
          }
        });
      });
      return out;
    };
    return allMinimalCycles(this.allNonTerminals, (val: Sym) => val.label, edgeFunctor);
  }

  /**
   * Returns a set of "Starting" non terminals which have atleast
   * one production containing left recursion.
   */
  get leftRecursion(): any {
    const edgeFunctor = (node: Sym): [Sym, any][] => {
      const out: [Sym, any][] = [];
      this.forEachRule(node, (rule, ruleIndex) => {
        rule.rhs.syms.forEach((s, j) => {
          if (s.isTerminal) return;
          out.push([s, ruleIndex]);
          // If this is symbol is not nullable then we can stop here
          return this.nullables.isNullable(s);
        });
      });
      return out;
    };
    return allMinimalCycles(this.allNonTerminals, (val: Sym) => val.id, edgeFunctor);
  }
}
