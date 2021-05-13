const util = require("util");
import fs from "fs";
const JSON5 = require("json5");
import * as TSU from "@panyam/tsutils";
import { EBNFParser } from "../ebnf";
import { Str, Grammar, Rule } from "../grammar";
import { FirstSets, NullableSet, FollowSets } from "../sets";
import { ParseTable as LLParseTable } from "../ll";
import { LRAction, ParseTable, LRItemGraph } from "../lr";
import { makeSLRParseTable, makeLRParseTable } from "../ptables";
import { Parser } from "../lr";

type StringMap<T> = TSU.StringMap<T>;

export function Goto(ig: LRItemGraph, newState: number): LRAction {
  return LRAction.Goto(ig.itemSets.get(newState));
}

export function Shift(itemGraph: LRItemGraph, newState: number): LRAction {
  return LRAction.Shift(itemGraph.itemSets.get(newState));
}

export function Reduce(rule: Rule): LRAction {
  return LRAction.Reduce(rule);
}

export function listsEqual(l1: string[], l2: string[]): boolean {
  l1 = l1.sort();
  l2 = l2.sort();
  if (l1.length != l2.length) return false;
  for (let i = 0; i < l1.length; i++) {
    if (l2[i] != l1[i]) return false;
  }
  return true;
}

export function expectNullables(nullables: NullableSet, terms: string[]): void {
  const ns = nullables.nonterms.map((n) => n.label).sort();
  if (!listsEqual(ns, terms)) {
    console.log(`Nullables Expected FS[${ns}]: `, terms, ", Found: ", terms);
    TSU.assert(false);
  }
}

export function expectFSEntries(g: Grammar, fs: FirstSets | FollowSets, entries: StringMap<string[]>): void {
  for (const nt in entries) {
    const exp = g.getSym(nt);
    TSU.assert(exp != null, `Symbol {nt} does not exist`);
    const labels = fs.entriesFor(exp).labels(true).sort();
    const terms = entries[nt].sort();
    if (!listsEqual(labels, terms)) {
      console.log(`Expected FS[${nt}]: `, terms, ", Found: ", labels);
      TSU.assert(false);
    }
  }
}

export function expectRules(g: Grammar, nt: string, ...rules: (string | Str)[]): void {
  const nonterm = g.getSym(nt);
  TSU.assert(nonterm != null, `Nonterminal {nt} does not exist`);
  const ntRules = g.rulesForNT(nonterm);
  expect(ntRules.length).toBe(rules.length);
  for (let i = 0; i < rules.length; i++) {
    const eq = ntRules[i].rhs.equals(g.normalizeRule(rules[i]));
    if (!eq) {
      console.log("Expected: ", rules[i], "Found: ", ntRules[i].rhs);
      TSU.assert(false, `Rule ${i} does not match`);
    }
  }
}

export function verifyItemGraphs(ig: LRItemGraph, entries: any, debug = false): boolean {
  const foundValue = ig.debugValue;
  if (debug) console.log("ItemSets and GOTO: ", foundValue);
  expect(foundValue).toEqual(entries);
  return true;
}

export function verifyLLParseTable(
  name: string,
  g: Grammar,
  actions: StringMap<StringMap<string[]>>,
  debug = false,
): boolean {
  const ptable = new LLParseTable(g);
  const ptabValue = ptable.debugValue;
  if (debug) console.log(`${name} Actions: `, ptabValue);
  expect(actions).toEqual(ptabValue);
  return true;
}

export function logParserDebug(parser: Parser): void {
  const g = parser.grammar;
  const ptable = parser.parseTable;
  const ig = parser.itemGraph;
  console.log(
    "===============================\nGrammar (as default): \n",
    g.debugValue.map((x, i) => `${i + 1}  -   ${x}`),
    "===============================\nGrammar (as Bison): \n",
    g.debugValue.map((x, i) => `${x.replace("->", ":")} ; \n`).join(""),
    "===============================\nParseTable: \n",
    util.inspect(mergedDebugValue(ptable, ig), {
      showHidden: false,
      depth: null,
      maxArrayLength: null,
      maxStringLength: null,
    }),
    "===============================\nConflicts: \n",
    ptable.conflictActions,
  );
}

/**
 * Helper to create a grammar, and its parser.
 */
export function newParser(input: string, ptabType = "slr", config: any = null): Parser {
  const params = config == null || typeof config === "boolean" ? {} : config;
  const debug = config === true || params["debug"] || false;
  params.grammar = params.grammar || {};
  params.itemGraph = params.itemGraph || {};
  const g = new Grammar(params.grammar);
  const eparser = new EBNFParser(input, { ...(params.parser || {}), grammar: g });
  g.augmentStartSymbol();
  const ptMaker = ptabType == "lr1" ? makeLRParseTable : makeSLRParseTable;
  const [ptable, ig] = ptMaker(g, params);
  const parser = new Parser(g, ptable, ig);
  if (debug) {
    logParserDebug(parser);
    console.log("Prog: \n", `${eparser.generatedTokenizer.vm.prog.debugValue().join("\n")}`);
  }
  parser.setTokenizer(eparser.generatedTokenizer.next.bind(eparser.generatedTokenizer));
  return parser;
}

export function mergedDebugValue(ptable: ParseTable, ig: LRItemGraph): any {
  const merged = {} as any;
  const ptabDV = ptable.debugValue;
  const igDV = ig.debugValue;
  for (const stateId in ptabDV) {
    const actions = ptabDV[stateId];
    const items = igDV[stateId];
    merged[stateId] = { items: items["items"], actions: actions, goto: items["goto"] };
  }
  return merged;
}

export function testParseTable(grammarFile: string, ptablesFile: string, ptabType: "lr1" | "slr", debug = false): void {
  if (!grammarFile.startsWith("/")) {
    grammarFile = __dirname + "/" + grammarFile;
  }
  if (!ptablesFile.startsWith("/")) {
    ptablesFile = __dirname + "/" + ptablesFile;
  }
  const expectedPTables = JSON5.parse(fs.readFileSync(ptablesFile, "utf8"));
  if (debug || !(ptabType in expectedPTables)) {
    console.log(`Testing Grammar (${ptabType}): ${grammarFile}`);
  }
  const contents = fs.readFileSync(grammarFile, "utf8");
  const parser = newParser(contents, ptabType, debug);
  const foundValue = mergedDebugValue(parser.parseTable, parser.itemGraph);
  expect(expectedPTables[ptabType]).toEqual(foundValue);
}
