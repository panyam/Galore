const util = require("util");
import { Parser, LRAction, ParseTable, LRItemGraph } from "./lr";

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
