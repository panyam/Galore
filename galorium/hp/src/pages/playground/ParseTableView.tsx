
import * as React from "react"
import * as G from "galore";
import "./styles/ParseTableView.scss"
import { BaseComponent } from "./contexts";
import * as configs from "./configs";
import * as events from "./events";

export class ParseTableView extends BaseComponent {
  headerElement: HTMLDivElement;
  parser: G.Parser;
  state = {html: ""} as any

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
    let symbols = [...this.parser.grammar.allSymbols].sort(this.gotoSymbolSorter);
    const out = G.Printers.parseTableToHtml(this.parser.parseTable, {
      gotoSymbolSorter: this.gotoSymbolSorter,
      classPrefix: "",
    });
    this.setState({html: out})
  }


  render() {
    const val = {
      __html: this.state.html
    };
    return (
      <div dangerouslySetInnerHTML={val}
      />
    );
  }
}
