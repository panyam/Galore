import * as TSU from "@panyam/tsutils";
import { Rule } from "./grammar";
import { LRItem, LRItemSet, LRItemGraph } from "./lrbase";

export class LR0Item implements LRItem {
  id = 0;
  readonly rule: Rule;
  readonly position: number;
  constructor(rule: Rule, position = 0) {
    this.rule = rule;
    this.position = position;
  }

  advance(): LRItem {
    TSU.assert(this.position < this.rule.rhs.length);
    return new LR0Item(this.rule, this.position + 1);
  }

  copy(): LRItem {
    return new LR0Item(this.rule, this.position);
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
    return `${rule.nt} -> ${pre} . ${post}`;
  }
}

export class LR0ItemGraph extends LRItemGraph {
  protected startItem(): LRItem {
    return this.items.ensure(new LR0Item(this.grammar.augStartRule));
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
            const newItem = this.items.ensure(new LR0Item(rule, 0));
            out.add(newItem.id);
          }
        }
      }
    }
    return out.size == 0 ? out : this.itemSets.ensure(out);
  }
}
