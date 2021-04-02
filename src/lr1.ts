import * as TSU from "@panyam/tsutils";
import { Sym, Rule } from "./grammar";
import { LRItem, LRItemSet, LRItemGraph } from "./lrbase";
import { LR0Item } from "./lr0";

export class LR1Item extends LR0Item {
  readonly lookahead: Sym;
  constructor(lookahead: Sym, rule: Rule, position = 0) {
    super(rule, position);
    this.lookahead = lookahead;
  }

  copy(): LR1Item {
    return new LR1Item(this.lookahead, this.rule, this.position);
  }

  advance(): LRItem {
    TSU.assert(this.position < this.rule.rhs.length);
    return new LR1Item(this.lookahead, this.rule, this.position + 1);
  }

  get key(): string {
    return this.rule.id + ":" + this.position + ":" + this.lookahead.id;
  }

  compareTo(another: this): number {
    let diff = super.compareTo(another);
    if (diff == 0) diff = this.lookahead.id - another.lookahead.id;
    return diff;
  }

  equals(another: this): boolean {
    return this.compareTo(another) == 0;
  }

  get debugString(): string {
    const pos = this.position;
    const pre = this.rule.rhs.syms.slice(0, pos).join(" ");
    const post = this.rule.rhs.syms.slice(pos).join(" ");
    return `${this.rule.nt.label} -> ${pre} . ${post}` + "   /   " + this.lookahead.label;
  }
}

export class LR1ItemGraph extends LRItemGraph {
  /**
   * Overridden to create LR1ItemSet objects with the start state
   * also including the EOF marker as the lookahead.
   *
   * StartSet = closure({S' -> . S, $})
   */
  startItem(): LRItem {
    return this.items.ensure(new LR1Item(this.grammar.Eof, this.grammar.augStartRule, 0));
  }

  /**
   * Computes the closure of this item set and returns a new
   * item set.
   */
  closure(itemSet: LRItemSet): LRItemSet {
    const out = new LRItemSet(this, ...itemSet.values);
    for (let i = 0; i < out.values.length; i++) {
      const itemId = out.values[i];
      const item = this.items.get(itemId) as LR1Item;
      // Evaluate the closure
      // Cannot do anything past the end
      if (item.position >= item.rule.rhs.length) continue;
      const B = item.rule.rhs.syms[item.position];
      if (B.isTerminal) continue;

      const suffix = item.rule.rhs.copy().append(item.lookahead);
      this.grammar.firstSets.forEachTermIn(suffix, item.position + 1, (term) => {
        if (term != null) {
          // For each rule [ B -> beta, term ] add it to
          // our list of items if it doesnt already exist
          const bRules = this.grammar.rulesForNT(B);
          for (const br of bRules) {
            const newItem = this.items.ensure(new LR1Item(term, br, 0));
            out.add(newItem.id);
          }
        }
      });
    }
    return out.size == 0 ? out : this.itemSets.ensure(out);
  }
}
