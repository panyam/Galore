import * as TSU from "@panyam/tsutils";
import { Grammar } from "./grammar";
import { LRAction, ParseTable } from "./lr";
import { LRItem, LRItemSet, LRItemGraph, LR0ItemGraph, LR1ItemGraph } from "./lritems";

export function newParseTable(g: Grammar, type = "lr1"): [ParseTable, LRItemGraph] {
  switch (type) {
    case "lr1":
      return makeLRParseTable(g);
    case "slr":
      return makeSLRParseTable(g);
  }
  return makeSLRParseTable(g);
}

export function makeSLRParseTable(grammar: Grammar): [ParseTable, LRItemGraph] {
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
          const gotoSet = ig.getGoto(itemSet, sym);
          if (gotoSet) {
            parseTable.addAction(itemSet.id, sym, LRAction.Shift(gotoSet.id));
          }
        }
      } else {
        // if sym is in follows(nt) then add the rule
        // Reduce nt -> rule for all sym in follows(nt)
        grammar.followSets.forEachTerm(rule.nt, (term) => {
          if (term != null) {
            TSU.assert(term.isTerminal);
            parseTable.addAction(itemSet.id, term, LRAction.Reduce(rule));
          }
        });
      }
    }

    // Now create GOTO entries for (State,X) where X is a non-term
    ig.forEachGoto(itemSet, (sym, next) => {
      if (sym != null && !sym.isTerminal) {
        parseTable.addAction(itemSet.id, sym, LRAction.Goto(next.id));
      }
    });

    // If this state contains the augmented item, S' -> S .
    // then add accept
    if (itemSet.has(ig.items.ensure(new LRItem(grammar.augStartRule, 1)).id)) {
      parseTable.addAction(itemSet.id, grammar.Eof, LRAction.Accept());
    }
  }
  return [parseTable, ig];
}

/**
 * A canonical LR1 parse table maker.
 */
export function makeLRParseTable(grammar: Grammar): [ParseTable, LRItemGraph] {
  const ig = new LR1ItemGraph(grammar).refresh();
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
            parseTable.addAction(itemSet.id, sym, LRAction.Shift(nextSet.id));
          }
        }
      } else if (!rule.nt.equals(grammar.augStartRule.nt)) {
        // ensure nt != S'
        // if we have nt -> rule DOT / t
        // Reduce nt -> rule for t
        const lookaheads = itemSet.getLookAheads(item);
        for (const lookahead of lookaheads) {
          parseTable.addAction(itemSet.id, lookahead, LRAction.Reduce(rule));
        }
      }
    }

    // Now create GOTO entries for (State,X) where X is a non-term
    ig.forEachGoto(itemSet, (sym, next) => {
      if (sym != null && !sym.isTerminal) {
        parseTable.addAction(itemSet.id, sym, LRAction.Goto(next.id));
      }
    });

    // If this state contains the augmented item, S' -> S . / $
    // then add accept
    const lr1Item = ig.items.ensure(new LRItem(grammar.augStartRule, 1));
    itemSet.addLookAhead(lr1Item, grammar.Eof);
    if (itemSet.has(lr1Item.id)) {
      parseTable.addAction(itemSet.id, grammar.Eof, LRAction.Accept());
    }
  }
  return [parseTable, ig];
}

/**
 * A LALR(1) parse table maker using the DeRemer and Penello's method.
 */
export function makeLALRParseTable(grammar: Grammar): [ParseTable, LRItemGraph] {
  const [parseTable, ig] = makeSLRParseTable(grammar);

  // see if parseTable has conflicts!

  return [parseTable, ig];
}
