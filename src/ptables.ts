import * as TSU from "@panyam/tsutils";
import { Grammar } from "./grammar";
import { LRAction, ParseTable, LR0Item, LR0ItemGraph, LR1Item, LR1ItemGraph } from "./lr";

export function makeSLRParseTable(grammar: Grammar): [ParseTable, LR0ItemGraph] {
  const ig = new LR0ItemGraph(grammar).refresh();
  const parseTable = new ParseTable(grammar);
  for (const itemSet of ig.itemSets.entries) {
    // Look for transitions from this set
    for (const itemId of itemSet.values) {
      const item = ig.items.get(itemId);
      const rule = item.rule;
      if (item.position < rule.rhs.length) {
        // possibilities of shift
        const sym = rule.rhs.syms[item.position];
        if (sym.isTerminal) {
          const nextSet = ig.getGoto(itemSet, sym);
          if (nextSet) {
            parseTable.addAction(itemSet, sym, LRAction.Shift(nextSet));
          }
        }
      } else {
        // if sym is in follows(nt) then add the rule
        // Reduce nt -> rule for all sym in follows(nt)
        grammar.followSets.forEachTerm(rule.nt, (term) => {
          if (term != null) {
            TSU.assert(term.isTerminal);
            parseTable.addAction(itemSet, term, LRAction.Reduce(rule));
          }
        });
      }
    }

    // Now create GOTO entries for (State,X) where X is a non-term
    ig.forEachGoto(itemSet, (sym, next) => {
      if (sym != null && !sym.isTerminal) {
        parseTable.addAction(itemSet, sym, LRAction.Goto(next));
      }
    });

    // If this state contains the augmented item, S' -> S .
    // then add accept
    if (itemSet.has(ig.items.ensure(new LR0Item(grammar.augStartRule, 1)).id)) {
      parseTable.addAction(itemSet, grammar.Eof, LRAction.Accept());
    }
  }
  return [parseTable, ig];
}

/**
 * A canonical LR1 parse table maker.
 */
export function makeLRParseTable(grammar: Grammar): [ParseTable, LR1ItemGraph] {
  const ig = new LR1ItemGraph(grammar).refresh();
  const parseTable = new ParseTable(grammar);
  for (const itemSet of ig.itemSets.entries) {
    // Look for transitions from this set
    for (const itemId of itemSet.values) {
      const item = ig.items.get(itemId) as LR1Item;
      const rule = item.rule;
      if (item.position < rule.rhs.length) {
        // possibilities of shift
        const sym = rule.rhs.syms[item.position];
        if (sym.isTerminal) {
          const nextSet = ig.getGoto(itemSet, sym);
          if (nextSet) {
            parseTable.addAction(itemSet, sym, LRAction.Shift(nextSet));
          }
        }
      } else if (!rule.nt.equals(grammar.augStartRule.nt)) {
        // ensure nt != S'
        // if we have nt -> rule DOT / t
        // Reduce nt -> rule for t
        parseTable.addAction(itemSet, item.lookahead, LRAction.Reduce(rule));
      }
    }

    // Now create GOTO entries for (State,X) where X is a non-term
    ig.forEachGoto(itemSet, (sym, next) => {
      if (sym != null && !sym.isTerminal) {
        parseTable.addAction(itemSet, sym, LRAction.Goto(next));
      }
    });

    // If this state contains the augmented item, S' -> S . / $
    // then add accept
    if (itemSet.has(ig.items.ensure(new LR1Item(grammar.Eof, grammar.augStartRule, 1)).id)) {
      parseTable.addAction(itemSet, grammar.Eof, LRAction.Accept());
    }
  }
  return [parseTable, ig];
}
