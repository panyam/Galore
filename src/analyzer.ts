import * as TSU from "@panyam/tsutils";
import { Str, Sym, Rule, Grammar } from "./grammar";
import { SymbolSet, Trie, TrieNode } from "./sets";

/**
 * Returns symbols that do not derive any terminal strings or symbols
 * that cannot be reached from the Start symbol and a grammar with
 * these symbols removed.
 */
export function removeUselessSymbols(g: Grammar, fromSymbol: TSU.Nullable<Sym> = null): void {
  // Remove all symbols not deriving terminals
  const derives_terminal = g.terminalDerivingSymbols;
  // g.removeSymbols((s) => !derives_terminal.has(s));
  g.removeRules(
    (r) => !derives_terminal.has(r.nt) || r.rhs.syms.findIndex((s) => !s.isTerminal && !derives_terminal.has(s)) >= 0,
  );
  g.refresh();
  const reachable_symbols = g.reachableSymbols(fromSymbol);
  // g.removeSymbols((s) => !s.isTerminal && !reachable_symbols.has(s));
  g.removeRules(
    (r) => !reachable_symbols.has(r.nt) || r.rhs.syms.findIndex((s) => !s.isTerminal && !reachable_symbols.has(s)) >= 0,
  );
  g.refresh();

  // Remove all non reachable symbols
  // g.removeSymbols((s) => !reachable_symbols.has(s));
}

/**
 * Expands productions that can result in null productions.
 */
export function expandNullProductions(grammar: Grammar, str: Str, results?: TSU.StringMap<Str>): TSU.StringMap<Str> {
  results = results || {};
  if (str.length > 0) {
    const nullables = grammar.nullables;
    const key = str.toString();
    if (!(key in results)) {
      results[key] = str;
      str.syms.forEach((sym, index) => {
        if (nullables.isNullable(sym)) {
          // then create a new rule without this string in each position
          const newStr = str.copy().splice(index, 1);
          expandNullProductions(grammar, newStr, results);
        }
      });
    }
  }
  return results;
}

/**
 * Removes null productions for either a single non terminal or all non
 * terminals (if nt is null) from the given grammar.
 *
 * A -> ? B C
 *
 * will be replaced with:
 *
 * A -> C
 * A -> B C
 */
export function removeNullProductions(grammar: Grammar, nt: TSU.Nullable<Sym> = null): void {
  if (nt == null) {
    grammar.forEachNT((nt) => removeNullProductions(grammar, nt));
  } else {
    const results: TSU.StringMap<Str> = {};
    grammar.rulesForNT(nt).forEach((r) => expandNullProductions(grammar, r.rhs, results));
    // Remove all existing rules of nt
    grammar.removeRules((r) => r.nt == nt);
    // and add the new rules
    for (const key in results) {
      grammar.add(nt, results[key]);
    }
    // TODO - Do this for all non terms except the start symbol?
    grammar.removeRules((r) => r.nt == nt && r.rhs.length == 0);
  }
}

export function removeCycles(grammar: Grammar): void {
  removeNullProductions(grammar);
  /*
  while (true) {
    const cycles = grammar.cycles;
    if (cycles.length == 0) break;
    for (const [start_sym,any] of cycles) {
      // Find all non terminals in this cycle
      const cycle_symbols = new SymbolSet(grammar);
      for (const [sym for sym, rule] in cycle])

      // Find the union of all production of all
      // non terminals in cycle_symbols
      prod_union = []
      for sym in cycle_symbols:
          for prod in self.productionsFor(sym):
              if prod.rhs.numSymbols != 1 or prod.rhs[0].symbol not in cycle_symbols:
                  prod_union.append(prod)

      # For each non term in the cycle, add all productions in
      # prod_union and remove all productions of the form:
      # M -> N where M and N are BOTH in cycle_symbols
      for rule, sym in cycle:
          prodlist = self.productions[sym]
          for index, prod in self.productionsFor(sym, indexed=True, reverse=True):
              if prod.rhs.numSymbols == 1 or prod.rhs[0].symbol in cycle_symbols:
                  prodlist.removeProduction(index)

          for prod in prod_union:
              prodlist.addProduction(prod.copy(self))
    }
  }
  */
}

/**
 * Returns true if a given symbol has direct left recursion. false otherwise.
 */
export function hasDirectLeftRecursion(sym: Sym, grammar: Grammar): boolean {
  return false;
}

/**
 * Left factors a grammar (or particular non terminals) with common prefixes.
 */
export function leftFactor(grammar: Grammar, nt: TSU.Nullable<Sym> = null): void {
  if (nt == null) {
    grammar.forEachNT((nt) => leftFactor(grammar, nt));
  } else {
    const symTrie = new Trie<Sym>((s) => s.label);
    grammar.forEachRule(nt, (rule) => {
      symTrie.add(rule.rhs.syms);
    });
    const x = symTrie.debugValue;
    // remove all rules for a nt so we can replace them new rules
    grammar.removeRules((r) => r.nt == nt);

    const lf = (curr: TrieNode<Sym>, nt: Sym, prefix: Str): void => {
      if (curr.children.size == 0) {
        // reached the end - nothing to do
        const a = 3;
        if (prefix.length > 0) grammar.add(nt, prefix.copy());
      } else if (curr.children.size == 1 && !curr.isLeaf) {
        const childNode = curr.children.values().next().value!;
        TSU.assert(childNode.value != null);
        lf(childNode, nt, prefix.append(childNode.value!));
      } else {
        // see if we need a new symbol
        const newSym = curr.children.size > 0 ? grammar.newAuxNT() : null;
        // add a rule with the prefix so far
        prefix = prefix.copy();
        grammar.add(nt, newSym == null ? prefix : prefix.append(newSym));
        if (curr.isLeaf && newSym != null) {
          // Add a null production if needed
          grammar.add(newSym, new Str());
        }
        if (newSym != null) {
          for (const child of curr.children.values()) {
            TSU.assert(child.value != null);
            lf(child, newSym, new Str(child.value));
            //
          }
        }
        // now visit child nodes but with a new prefix
        // we have a fork so create a new suffix nt
        // either a leaf or has forks or both
      }
      //
    };
    // Start for first level so we dont end up creating an unnecessary
    // aux symbol to treat the "" as a common prefix
    for (const child of symTrie.root.children.values()) {
      lf(child, nt, new Str(child.value!));
    }
  }
}

/**
 * Removes direct recursion for a given non terminal if it exists.
 * Removes direct left recursion for a particular non terminal if any.
 * For the given terminal, A, replaces the productions of the form:
 *
 *    A -> A a1 | A a2 ... | A an | b1 | b2 | b3 ... bm
 *
 * with:
 *
 *    A -> b1 A' | b2 A' | ... bm A'
 *    A' -> epsilon | a1 A' | a2 A' | ... an A'
 */
export function removeDirectLeftRecursion(grammar: Grammar, nt: TSU.Nullable<Sym> = null): void {
  if (nt == null) {
    grammar.forEachNT((nt) => removeDirectLeftRecursion(grammar, nt));
  } else {
    // Replace a rule:
    // A -> A a1 | A a2 | ... | A an | b1 | b2 ... | bm
    //
    // with
    //
    // A -> b1 A' | b2 A' | ... | bm A'
    // A' -> eps | a1 A' | a2 A' ... | an A'
    //
    // This clearly wont work for something like: A -> A A A B
    const lrecRules: Str[] = [];
    const betaRules: Str[] = [];
    grammar.rulesForNT(nt).forEach((rule) => {
      if (rule.rhs.length > 0 && rule.rhs.syms[0] == nt) {
        // Remove the left recursion symbol and add it
        lrecRules.push(rule.rhs.slice(1, rule.rhs.length));
      } else {
        betaRules.push(rule.rhs);
      }
    });
    // Nothing to do if no left recursive rules
    if (lrecRules.length == 0) return;

    // remove all rules for a nt so we can replace them new rules
    grammar.removeRules((r) => r.nt == nt);

    // Add an auxiliary symbol A'
    const auxSym = grammar.newAuxNT();

    // Add all A -> bk A' rules
    for (const rule of betaRules) {
      grammar.add(nt, rule.copy().append(auxSym));
    }

    // Add all the A' -> eps and A' -> ak A' rules
    grammar.add(auxSym, new Str()); // epsilon rule
    for (const rule of lrecRules) {
      grammar.add(auxSym, rule.copy().append(auxSym));
    }
  }
}

export function removeIndirectLeftRecursion(grammar: Grammar): void {
  TSU.assert(false, "Not yet implemented");
}
