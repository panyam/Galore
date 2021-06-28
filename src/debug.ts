const util = require("util");
import { Parser, LRAction, ParseTable } from "./lr";
import { LRItemGraph } from "./lritems";

export function logParserDebug(parser: Parser, itemGraph?: LRItemGraph): void {
  const g = parser.grammar;
  const ptable = parser.parseTable;
  console.log(
    "===============================\nGrammar (as default): \n",
    g.debugValue.map((x, i) => `${i + 1}  -   ${x}`),
    "===============================\nGrammar (as Bison): \n",
    g.debugValue.map((x, i) => `${x.replace("->", ":")} ; \n`).join(""),
    "===============================\nParseTable: \n",
    util.inspect(mergedDebugValue(ptable, itemGraph), {
      showHidden: false,
      depth: null,
      maxArrayLength: null,
      maxStringLength: null,
    }),
    "===============================\nConflicts: \n",
    ptable.conflictActions,
  );
}

export function mergedDebugValue(ptable: ParseTable, itemGraph?: LRItemGraph): any {
  const merged = {} as any;
  const ptabDV = ptable.debugValue;
  const igDV = itemGraph?.debugValue;
  for (const stateId in ptabDV) {
    const actions = ptabDV[stateId];
    if (itemGraph) {
      const items = igDV[stateId];
      merged[stateId] = { items: items["items"], actions: actions, goto: items["goto"] };
    } else {
      merged[stateId] = actions;
    }
  }
  return merged;
}
