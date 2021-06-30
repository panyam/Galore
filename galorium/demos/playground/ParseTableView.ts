import "./styles/ParseTableView.scss";

import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import { App } from "./app";
import * as events from "./events";
import * as G from "galore";

export class ParseTableView extends TSV.View {
  readonly app: App;
  headerElement: HTMLDivElement;
  parser: G.Parser;

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
    const itemGraph = this.parser.parseTable.itemGraph;
    let symbols = [...this.parser.grammar.allSymbols].sort(this.gotoSymbolSorter);
    const out = G.Printers.parseTableToHtml(this.parser.parseTable, {
      gotoSymbolSorter: this.gotoSymbolSorter,
      classPrefix: "",
    });
    this.rootElement.innerHTML = out;
  }
}
