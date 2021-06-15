import * as TSU from "@panyam/tsutils";
import * as dsl from "../dsl";
import { LRItemSet, LRItem, LR0ItemGraph } from "../lr";
import { Grammar } from "../grammar";
import { verifyItemGraphs } from "./utils";

function From(ig: LR0ItemGraph, ...entries: [string, number, number][]): LRItemSet {
  const items = entries.map(([label, ri, pos]) => ig.items.ensure(new LRItem(ig.grammar.getRule(label, ri), pos)).id);
  const set = new LRItemSet(ig, ...items);
  return ig.itemSets.ensure(set);
}

export function expectItemSet(g: Grammar, set: LRItemSet, entries: [string, number, number][]): void {
  const ig = set.itemGraph;
  expect(set.size).toBe(entries.length);
  for (const [sym, index, pos] of entries) {
    const nt = g.getSym(sym);
    TSU.assert(nt != null, "Cannot find symbol: " + sym);
    expect(set.has(ig.items.ensure(new LRItem(g.getRule(nt, index), pos)).id)).toBe(true);
  }
}

const g1 = dsl
  .load(
    `
  E -> E PLUS T | T ;
  T -> T STAR F | F ;
  F -> OPEN E CLOSE | id ;
`,
  )[0]
  .augmentStartSymbol("E1");

describe("LRItem", () => {
  test("Test Equality", () => {
    const ig = new LR0ItemGraph(g1);
    const set1 = From(ig, ["E", 0, 0], ["E", 0, 0]);
    expect(set1.size).toBe(2);
  });

  test("Test Advance", () => {
    const ig = new LR0ItemGraph(g1).refresh();
    const E = g1.getSym("E")!;
    const rule = g1.getRule(E, 1);
    const l1 = ig.items.ensure(new LRItem(rule));
    const l1a = ig.items.ensure(new LRItem(rule));
    expect(l1.equals(l1a)).toBe(true);
    expect(l1.key).toEqual(`${rule.id}:0`);
    const l2 = l1.advance();
    expect(l2.rule.equals(l1.rule)).toBe(true);
    expect(l2.position).toEqual(l1.position + 1);
    expect(() => l2.advance()).toThrowError();
  });
});

describe("LRItemSet", () => {
  test("Test Closure", () => {
    const ig = new LR0ItemGraph(g1).refresh();
    verifyItemGraphs(ig, {
      "0": {
        items: [
          "0  -  E1 ->  • E",
          "1  -  E ->  • E PLUS T",
          "2  -  E ->  • T",
          "3  -  T ->  • T STAR F",
          "4  -  T ->  • F",
          "5  -  F ->  • OPEN E CLOSE",
          "6  -  F ->  • id",
        ],
        goto: { E: 1, T: 2, F: 3, OPEN: 4, id: 5 },
      },
      "1": {
        items: ["0  -  E1 -> E • ", "1  -  E -> E • PLUS T"],
        goto: { PLUS: 6 },
      },
      "2": {
        items: ["2  -  E -> T • ", "3  -  T -> T • STAR F"],
        goto: { STAR: 7 },
      },
      "3": { items: ["4  -  T -> F • "], goto: {} },
      "4": {
        items: [
          "1  -  E ->  • E PLUS T",
          "2  -  E ->  • T",
          "3  -  T ->  • T STAR F",
          "4  -  T ->  • F",
          "5  -  F ->  • OPEN E CLOSE",
          "5  -  F -> OPEN • E CLOSE",
          "6  -  F ->  • id",
        ],
        goto: { E: 8, T: 2, F: 3, OPEN: 4, id: 5 },
      },
      "5": { items: ["6  -  F -> id • "], goto: {} },
      "6": {
        items: [
          "1  -  E -> E PLUS • T",
          "3  -  T ->  • T STAR F",
          "4  -  T ->  • F",
          "5  -  F ->  • OPEN E CLOSE",
          "6  -  F ->  • id",
        ],
        goto: { T: 9, F: 3, OPEN: 4, id: 5 },
      },
      "7": {
        items: ["3  -  T -> T STAR • F", "5  -  F ->  • OPEN E CLOSE", "6  -  F ->  • id"],
        goto: { F: 10, OPEN: 4, id: 5 },
      },
      "8": {
        items: ["1  -  E -> E • PLUS T", "5  -  F -> OPEN E • CLOSE"],
        goto: { PLUS: 6, CLOSE: 11 },
      },
      "9": {
        items: ["1  -  E -> E PLUS T • ", "3  -  T -> T • STAR F"],
        goto: { STAR: 7 },
      },
      "10": { items: ["3  -  T -> T STAR F • "], goto: {} },
      "11": { items: ["5  -  F -> OPEN E CLOSE • "], goto: {} },
    });
  });
});
