import "./styles/ParseTableView.scss";

import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import { App } from "./app";
import * as events from "./events";
import * as G from "galore";

export class ParseTableView extends TSV.View {
  readonly app: App;
  headerElement: HTMLDivElement;
  parser: G.LR.Parser;

  constructor(rootElement: HTMLElement, app: App, config?: TSV.ViewParams) {
    super(rootElement, config);
    this.app = app;
  }

  protected loadChildViews(): void {
    super.loadChildViews();
    this.headerElement = this.find(".inputHeaderArea") as HTMLDivElement;
  }

  eventHubChanged(): void {
    console.log("here: ", this.eventHub);
    this.eventHub?.on(events.ParserCompiled, (evt) => {
      this.parser = evt.payload;
      console.log("Compiled Parser: ", this.parser);
      this.updateViews();
    });
  }

  gotoSymbolSorter = (s1: G.Sym, s2: G.Sym) => {
    const diff = (s1.isTerminal ? 0 : 1) - (s2.isTerminal ? 0 : 1);
    if (diff != 0) return diff;
    return s1.creationId - s2.creationId;
  };

  updateViews(): void {
    const itemGraph = this.parser.itemGraph;
    let symbols = [...this.parser.grammar.allSymbols].sort(this.gotoSymbolSorter);
    let out = "<table border = 1 class = 'parseTable'>";
    // add header row showing symbols
    out += "<thead><td></td>";
    for (const sym of symbols) {
      out += `<td class = "symHeaderCell" symID = "${sym.id}">${sym.label}</td>`;
    }

    // now each row in the parse table
    const numStates = this.parser.itemGraph.itemSets.size;
    for (let i = 0; i < numStates; i++) {
      out += "<tr>";
      out += `<td class = "stateHeaderCell" stateID = "${i}">${i}</td>`;
      for (const sym of symbols) {
        // Add action here
        const actions = this.parser.parseTable.getActions(i, sym);
        let cellClass = " actionCell";
        if (actions.length == 0) {
          cellClass += " emptyActions";
        } else {
          if (actions.length >= 0) {
            cellClass += "multipleActions";
          }
        }
        out += `<td class = "${cellClass}" stateId = ${i} symID = "${sym.id}">`;
        const lines: string[] = [];
        for (const action of actions) {
          if (action.tag == G.LR.LRActionType.GOTO) {
            lines.push(`<div class = "gotoActionCell">${action.gotoState}</div>`);
          } else if (action.tag == G.LR.LRActionType.ACCEPT) {
            lines.push(`<div class = "acceptActionCell">ACCEPT</div>`);
          } else if (action.tag == G.LR.LRActionType.SHIFT) {
            lines.push(`<div class = "shiftActionCell">S${action.gotoState}</div>`);
          } else if (action.tag == G.LR.LRActionType.REDUCE) {
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
    this.rootElement.innerHTML = out;
  }
}
