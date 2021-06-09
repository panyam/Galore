import { LRActionType, ParseTable as LRParseTable } from "./lr";

export function parseTableToHtml(parseTable: LRParseTable, config: any = {}): string {
  const itemGraph = parseTable.itemGraph;
  const classPrefix = config.classPrefix || "";
  const symbols = config.gotoSymbolSorter
    ? [...parseTable.grammar.allSymbols].sort(config.gotoSymbolSorter)
    : parseTable.grammar.allSymbols;
  let out = "<table border = 1 class = '${classPrefix}parseTable'>";
  // add header row showing symbols
  out += "<thead><td></td>";
  for (const sym of symbols) {
    out += `<td class = "${classPrefix}symHeaderCell" symID = "${sym.id}">${sym.label}</td>`;
  }

  // now each row in the parse table
  const numStates = parseTable.itemGraph.itemSets.size;
  for (let i = 0; i < numStates; i++) {
    out += "<tr>";
    out += `<td class = "${classPrefix}stateHeaderCell" stateID = "${i}">${i}</td>`;
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
      out += `<td class = "${classPrefix}${cellClass}" stateId = ${i} symID = "${sym.id}">`;
      const lines: string[] = [];
      for (const action of actions) {
        if (action.tag == LRActionType.GOTO) {
          lines.push(`<div class = "${classPrefix}gotoActionCell">${action.gotoState}</div>`);
        } else if (action.tag == LRActionType.ACCEPT) {
          lines.push(`<div class = "${classPrefix}acceptActionCell">ACCEPT</div>`);
        } else if (action.tag == LRActionType.SHIFT) {
          lines.push(`<div class = "${classPrefix}shiftActionCell">S${action.gotoState}</div>`);
        } else if (action.tag == LRActionType.REDUCE) {
          lines.push(`<div class = "${classPrefix}reduceActionCell">R${action.rule!.id}</div>`);
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
