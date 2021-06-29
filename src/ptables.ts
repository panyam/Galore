import * as TSU from "@panyam/tsutils";
import { Grammar, Str, Sym, Rule } from "./grammar";
import { LRAction, ParseTable } from "./lr";
import { LRItem, LRItemSet, LRItemGraph, LR0ItemGraph, LR1ItemGraph } from "./lritems";
import { Goto } from "./tests/utils";

export function newParseTable(g: Grammar, type = "lr1"): [ParseTable, LRItemGraph] {
  switch (type) {
    case "lr1":
      return makeLRParseTable(g);
    case "lalr":
      return makeLALRParseTable(g);
  }
  return makeSLRParseTable(g);
}

export function makeSLRParseTable(grammar: Grammar): [ParseTable, LRItemGraph] {
  const ig = new LR0ItemGraph(grammar).refresh();
  for (const itemSet of ig.itemSets.entries) {
    // Look for transitions from this set
    for (const itemId of itemSet.values) {
      const item = ig.items.get(itemId);
      const rule = item.rule;
      if (item.position >= rule.rhs.length) {
        // if sym is in follows(nt) then add the rule
        // Reduce nt -> rule for all sym in follows(nt)
        grammar.followSets.forEachTerm(rule.nt, (term) => {
          if (term != null) {
            TSU.assert(term.isTerminal);
            itemSet.addLookAhead(item, term);
          }
        });
      }
    }
  }
  return [makeParseTableFromLA(ig, grammar), ig];
}

/**
 * A canonical LR1 parse table maker.
 */
export function makeLRParseTable(grammar: Grammar): [ParseTable, LRItemGraph] {
  const ig = new LR1ItemGraph(grammar).refresh();
  const parseTable = makeParseTableFromLA(ig, grammar);
  return [parseTable, ig];
}

/**
 * Shared parse table creator for SLR/LR/LALR grammars that have lookahead
 * in the LR0 automaton.
 */
function makeParseTableFromLA(ig: LRItemGraph, grammar: Grammar): ParseTable {
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
        // We have nt -> rule DOT / t
        // AND nt != S'
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
  return parseTable;
}

/**
 * A LALR(1) parse table maker using Bermudez and Logothetis' (1989)
 *  "Simple computation of LALR(1) lookahead sets" method.
 */
export function makeLALRParseTable(grammar: Grammar): [ParseTable, LRItemGraph] {
  // const [parseTable, ig] = makeSLRParseTable(grammar);
  const ig = new LR0ItemGraph(grammar).refresh();
  const parseTable = new ParseTable(grammar);

  // This is a really simple method compared to DeRemer and Penello's method
  // (based on relations).
  //
  // 1. First transform the grammar G into G' that is based on around the LR0
  // item graph
  const g2 = grammarFromLR0ItemGraph(ig, grammar);

  return [parseTable, ig];
}

/**
 * For a grammar G and its LR0 ItemGraph, IG, returns a transformed grammar G'
 * that is based along the transitions of IG.
 *
 * For this new Grammar G' we have:
 *
 * NonTerminals N' =  { [p: A] | if Go[p: A] is defined },
 * Terminals T' =  { [p: t] | if Go[p: t] is defined },
 * Start Symbol S' = [ Start : S ]
 * Productions P' =  { [p1 : A ] -> [p1 : X1][p2 : X2]...[pn : Xn], if
 *                            [p1 : A] is in N'         AND
 *                            [pi : Xi] is in N' U T'   AND
 *                            A -> X1 X2 .. An is in P (of original grammar G)
 */
export function grammarFromLR0ItemGraph(ig: LR0ItemGraph, g: Grammar): Grammar {
  const g2 = new Grammar();

  function ensureG2Sym(pi: number, sym: Sym): Sym {
    const newSymLabel = `[${pi}:${sym.label}]`;
    const newSym = g2.ensureSym(new Sym(g2, newSymLabel, sym.isTerminal), false);
    if (!sym.isTerminal && g.startSymbol == sym) {
      // this *MUST* be the start state
      TSU.assert(pi == 0, "Start symbol transition can only happen from start state");
      g2.startSymbol = newSym;
    }
    return newSym;
  }

  // Create N', T' and S'
  for (const startState in ig.gotoSets) {
    // transitions is a Map of symId -> ItemSet
    const transitions: TSU.NumMap<LRItemSet> = ig.gotoSets[startState];
    for (const symId in transitions) {
      const sym = g.getSymById(symId as any as number)!;
      ensureG2Sym(startState as any as number, sym);
    }
  }

  function buildRuleFrom(startSet: number, A: Sym, rule: Rule): Str {
    // Str to be built up for the production in the transformed grammar
    //    -   [P1:X1][P2:X2]...[Pn:Xn]
    let pi = startSet;
    const newSyms = rule.rhs.syms.map((xi, index) => {
      const nextSym = ensureG2Sym(pi, xi);
      const transitions: TSU.NumMap<LRItemSet> = ig.gotoSets[pi];
      const nextSet = transitions[xi.id] || null;
      TSU.assert(nextSet != null, "Next set transition *must* be valid");
      pi = nextSet.id;
      return nextSym;
    });
    return new Str(...newSyms);
  }

  for (const startState in ig.gotoSets) {
    // from P1 - for every transition that is a non terminal A
    // find an equivalent chain of transition starting from P1 where we have
    // [P1:X1][P2:X2]...[Pn:Xn]
    // for All A -> X1X2...Xn in G
    const transitions: TSU.NumMap<LRItemSet> = ig.gotoSets[startState];
    for (const symId in transitions) {
      const startSym = g.getSymById(symId as any as number)!;
      const p1 = startState as any as number;
      if (!startSym.isTerminal) {
        const newA = ensureG2Sym(p1, startSym);
        g.forEachRule(startSym, (rule, index) => {
          const newRHS = buildRuleFrom(p1, startSym, rule);
          const newRule = new Rule(newA, newRHS);
          g2.addRule(newRule);
        });
      }
    }
  }
  // Do another pass to evaluate P'
  return g2;
}
