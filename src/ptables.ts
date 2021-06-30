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

/**
 * A SLR parse table maker.
 */
export function makeSLRParseTable(grammar: Grammar): [ParseTable, LRItemGraph] {
  const ig = makeSLRAutomaton(grammar);
  return [makeParseTableFromLA(ig, grammar), ig];
}

export function makeSLRAutomaton(grammar: Grammar): LRItemGraph {
  const ig = new LR0ItemGraph(grammar).refresh();
  for (const itemSet of ig.itemSets.entries) {
    evalLASetsForSLRItem(grammar, ig, itemSet);
  }
  return ig;
}

/**
 * For a given LR(0) Item in the LR0 automaton evaluates the lookahead set
 * for an SLR1 parse table.
 *
 * The SLR lookahead is:
 *
 *    SLRLA(q, A -> w) = Follow(A)
 *
 * @param grammar
 * @param ig
 * @param itemSet
 */
export function evalLASetsForSLRItem(grammar: Grammar, ig: LRItemGraph, itemSet: LRItemSet): void {
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

/**
 * A canonical LR1 parse table maker.
 */
export function makeLRParseTable(grammar: Grammar): [ParseTable, LRItemGraph] {
  const ig = new LR1ItemGraph(grammar).refresh();
  const parseTable = makeParseTableFromLA(ig, grammar);
  return [parseTable, ig];
}

/**
 * A LALR(1) parse table maker using Bermudez and Logothetis' (1989)
 *  "Simple computation of LALR(1) lookahead sets" method.
 */
export function makeLALRParseTable(grammar: Grammar): [ParseTable, LRItemGraph] {
  // const [parseTable, ig] = makeSLRParseTable(grammar);
  const [parseTable, ig] = makeSLRParseTable(grammar);

  if (!parseTable.hasConflicts) {
    return [parseTable, ig];
  }

  // This is a really simple method compared to DeRemer and Penello's method
  // (based on relations).
  //
  // 1. First transform the grammar G into G' that is based on around the LR0
  // item graph
  const g2 = grammarFromLR0ItemGraph(ig, grammar);

  // Reverse of goto sets in the LR automaton to track predecessor states.
  const prevSets: TSU.NumMap<TSU.NumMap<Set<number>>> = {};

  for (const startState in ig.gotoSets) {
    for (const symId in ig.gotoSets[startState]) {
      const nextSet = ig.gotoSets[startState][symId];
      if (!(nextSet.id in prevSets)) {
        prevSets[nextSet.id] = {};
      }
      if (!(symId in prevSets[nextSet.id])) {
        prevSets[nextSet.id][symId] = new Set();
      }
      prevSets[nextSet.id][symId].add(startState as any as number);
    }
  }

  // For conflict states upgrade lookahead sets based on union of follow
  // sets of G2 for the corresponding sets
  // LALRLA(q, A -> w) =
  for (const startState in parseTable.conflictActions) {
    // So here we have a startState where a symbol was extraneously added
    // into the look ahead set.   So here recompute the lookahead set
    // for this state
    const itemSet = ig.itemSets.get(startState as any as number);
    evalLASetsForLALRItem(grammar, g2, ig, itemSet, prevSets);
  }

  // Now that all look aheads have been recomputed - recreate
  // the parse table
  return [makeParseTableFromLA(ig, grammar), ig];
}

/**
 * Shared parse table creator for SLR/LR/LALR grammars that have lookahead
 * in the LR0 automaton.
 */
export function makeParseTableFromLA(ig: LRItemGraph, grammar: Grammar): ParseTable {
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
 * For a given LR(0) Item in the LR0 automaton evaluates the lookahead set
 * for an LALR1 parse table.
 *
 * The LALR lookahead is:
 *
 *    LALRLA(q, A -> w) = {t | [r:t] in Follow[p: A], Go[p: w] = q }
 *
 * Here [r: t] refers to a state in the augmented grammar transformed from the original
 * grammar where the nonterminals and terminals are based on the transitions in the
 * LR(0) automaton.  This augmented grammar is also passed in as a parameter.
 *
 * @param grammar     - Original grammar
 * @param augGrammar  - Augmented grammar
 * @param ig          - LR0 Automaton
 * @param itemSet     - The item set in the automaton (ie a particular state)
 *                      for which lookahead sets are to be computed.
 * @param prevSets    - A mapping where prevSets[stateI][symId] is a list of
 *                      states X1,X2...Xn where where the transition
 *                      X1[symId] = stateI, X2[symId] = stateI ...
 *                      Xn[symId] = stateI
 */
export function evalLASetsForLALRItem(
  grammar: Grammar,
  augGrammar: Grammar,
  ig: LRItemGraph,
  itemSet: LRItemSet,
  prevSets: TSU.NumMap<TSU.NumMap<Set<number>>>,
): void {
  // find p going backwards from q spelling w
  function findP(rule: Rule, i: number, currState: number, states: Set<number>): void {
    if (i < 0) {
      // we have reached the end - currState is P
      // Ensure there is a transition from currState on rule.nt
      const transitions: TSU.NumMap<LRItemSet> = ig.gotoSets[currState];
      TSU.assert((transitions[rule.nt.id] || null) != null, "Transition on rule.nt missing from start state");
      states.add(currState);
    } else {
      const sym = rule.rhs.syms[i];
      const prevStates = prevSets[currState][sym.id] || null;
      TSU.assert(prevStates != null, "Prev set should not be null");
      prevStates.forEach((nextState) => findP(rule, i - 1, nextState, states));
    }
  }

  itemSet.clearLookAheads();
  // Look for transitions from this set
  for (const itemId of itemSet.values) {
    const item = ig.items.get(itemId);
    const rule = item.rule;
    if (item.position >= rule.rhs.length) {
      // Here we have rule of the form A -> w in state q
      //
      // For this state we compute LALR lookaheads as:
      //
      // LALRLA(q, A -> w) = {t | [r:t] in Follow[p: A], Go[p: w] = q }
      const pSet = new Set<number>();
      findP(rule, rule.rhs.length - 1, itemSet.id, pSet);
      pSet.forEach((p) => {
        // Now find the NT [p: A] in the augmented grammar
        const pALabel = `[${p}:${rule.nt.label}]`;
        const pA = augGrammar.getSym(pALabel);
        TSU.assert(pA != null, "Augmented grammar symbol [p:A] not found");
        augGrammar.followSets.forEachTerm(pA, (term) => {
          if (term != null && term != augGrammar.Eof) {
            TSU.assert(term.isTerminal);
            // This term is in the form [r: T] in the augmented grammar.
            // Get the T from this and add to the look ahead set
            const label = term.label.substring(term.label.indexOf(":") + 1, term.label.length - 1).trim();
            const T = grammar.getSym(label);
            TSU.assert(T != null, `T (${label}) in [r:T] cannot be null`);
            itemSet.addLookAhead(item, T);
          }
        });
      });
    }
  }
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
    if (pi == 0 && g.startSymbol == sym && g.startSymbol != newSym && !sym.isTerminal) {
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
