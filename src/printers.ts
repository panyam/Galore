import { LRActionType, ParseTable as LRParseTable } from "./lr";
import { LRItemGraph } from "./lritems";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function parseTableToHtml(parseTable: LRParseTable, config: any = {}): string {
  const parseTableClass = config.parseTableClass || "parseTable";
  const itemGraph: LRItemGraph | null = config.itemGraph || null;
  const symbols = config.gotoSymbolSorter
    ? [...parseTable.grammar.allSymbols].sort(config.gotoSymbolSorter)
    : parseTable.grammar.allSymbols;
  let out = `<table border = 1 class = '${parseTableClass}'>`;
  // add header row showing symbols
  out += "<thead><td></td>";
  for (const sym of symbols) {
    out += `<td class = "symHeaderCell" symID = "${sym.id}">${sym.label}</td>`;
  }

  // now each row in the parse table
  const numStates = Object.keys(parseTable.actions).length;
  for (let i = 0; i < numStates; i++) {
    out += "<tr>";
    // Show state number and optionally the items in this state
    let stateLabel = `${i}`;
    let stateTitle = "";
    if (itemGraph && i < itemGraph.itemSets.size) {
      const itemSet = itemGraph.itemSets.get(i);
      const items = itemSet.debugValue as string[];
      stateTitle = items.join("\n");
      // Show first item as a hint (the "kernel" item)
      if (items.length > 0) {
        // Extract just the production part (after the " - ")
        const firstItem = items[0];
        const match = firstItem.match(/^\d+\s*-\s*(.+)$/);
        const hint = match ? match[1] : firstItem;
        stateLabel = `<div class="stateNum">${i}</div><div class="stateHint">${escapeHtml(hint)}</div>`;
      }
    }
    // Check if this state has any conflicts
    let stateHasConflicts = false;
    for (const sym of symbols) {
      if (parseTable.getActions(i, sym).length > 1) {
        stateHasConflicts = true;
        break;
      }
    }
    const stateHeaderClass = stateHasConflicts ? "stateHeaderCell hasConflicts" : "stateHeaderCell";
    out += `<td class = "${stateHeaderClass}" stateID = "${i}" title="${escapeHtml(stateTitle)}">${stateLabel}</td>`;
    for (const sym of symbols) {
      // Add action here
      const actions = parseTable.getActions(i, sym);
      let cellClass = " actionCell";
      if (actions.length == 0) {
        cellClass += " emptyActions";
      } else {
        if (actions.length > 1) {
          cellClass += " multipleActions";
        }
      }
      out += `<td class = "${cellClass}" stateId = ${i} symID = "${sym.id}">`;
      const lines: string[] = [];
      for (const action of actions) {
        if (action.tag == LRActionType.GOTO) {
          lines.push(`<div class = "gotoActionCell">${action.gotoState}</div>`);
        } else if (action.tag == LRActionType.ACCEPT) {
          lines.push(`<div class = "acceptActionCell">ACCEPT</div>`);
        } else if (action.tag == LRActionType.SHIFT) {
          lines.push(`<div class = "shiftActionCell">S${action.gotoState}</div>`);
        } else if (action.tag == LRActionType.REDUCE) {
          lines.push(`<div class = "reduceActionCell">R${action.rule!.id}</div>`);
        }
      }
      out += lines.join("\n");
      out += "</td>";
    }
    out += "</tr>";
  }
  out += "</thead>";
  out += "</table>";
  return out;
}
