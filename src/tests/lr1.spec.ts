import { EBNFParser } from "../ebnf";
import { LR1ItemGraph } from "../lr";

/*
function From(ig: LR1ItemGraph, ...entries: [string, string, number, number][]): LRItemSet {
  const items = entries.map(([term, label, ri, pos]) => {
    const item = new LR1Item(ig.grammar.getSym(term)!, ig.grammar.getSym(label)!, ri, pos);
    return ig.items.ensure(item).id;
  });
  const set = new LRItemSet(ig, ...items);
  return ig.itemSets.ensure(set);
}

export function expectItemSet(g: Grammar, set: LRItemSet, entries: [string, string, number, number][]): void {
  const ig = set.itemGraph;
  expect(set.size).toBe(entries.length);
  for (const [term, sym, index, pos] of entries) {
    const nt = g.getSym(sym);
    const la = g.getSym(term)!;
    assert(nt != null, "Cannot find symbol: " + sym);
    expect(set.has(ig.items.ensure(new LR1Item(la, nt, index, pos)).id)).toBe(true);
  }
}
*/

const g3 = new EBNFParser(`
  S -> C C ;
  C -> c C | d ;
`).grammar.augmentStartSymbol("S1");

describe("LR1ItemGraph", () => {
  test("Test1", () => {
    const ig = new LR1ItemGraph(g3).refresh();
    // ig.itemSets.forEach((set, index) => console.log("Set ", index, "\n", set.debugString));
    expect(ig.size).toBe(10);
    /*
    // Set 0
    expect(ig.hasItemSet(From(ig, ["S1", 0, 0], ["S", 0, 0], ["S", 1, 0], ["L", 0, 0], ["L", 1, 0], ["R", 0, 0])));

    // Set 1
    expect(ig.hasItemSet(From(ig, ["S1", 0, 1])));

    // Set I2
    expect(ig.hasItemSet(From(ig, ["S", 0, 1], ["R", 0, 1])));

    // Set 3
    expect(ig.hasItemSet(From(ig, ["S", 1, 1])));

    // Set 4
    expect(ig.hasItemSet(From(ig, ["L", 0, 1], ["R", 0, 0], ["L", 0, 0], ["L", 1, 0])));

    // Set 5
    expect(ig.hasItemSet(From(ig, ["L", 1, 1])));

    // Set 6
    expect(ig.hasItemSet(From(ig, ["S", 0, 2], ["R", 0, 0], ["L", 0, 0], ["L", 1, 0])));

    // Set 7
    expect(ig.hasItemSet(From(ig, ["L", 0, 2])));

    // Set 8
    expect(ig.hasItemSet(From(ig, ["R", 0, 1])));

    // Set 9
    expect(ig.hasItemSet(From(ig, ["S", 0, 3])));
   */
  });
});
