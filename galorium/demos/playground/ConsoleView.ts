import "./styles/ConsoleView.scss";

import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import { App } from "./app";
import * as events from "./events";
import * as G from "galore";

export class ConsoleView extends TSV.View {
  readonly app: App;
  headerElement: HTMLDivElement;
  consoleLogElement: HTMLDivElement;
  clearButton: HTMLButtonElement;

  constructor(rootElement: HTMLElement, app: App, config?: TSV.ViewParams) {
    super(rootElement, config);
    this.app = app;
  }

  protected loadChildViews(): void {
    super.loadChildViews();
    this.headerElement = this.find(".consoleHeaderArea") as HTMLDivElement;
    this.consoleLogElement = this.find(".consoleLogArea") as HTMLDivElement;

    this.clearButton = this.find(".clearButton") as HTMLButtonElement;
    this.clearButton.addEventListener("click", (evt) => {
      this.clear();
    });
  }

  add(line: string): void {
    TSU.DOM.createNode("div", {
      parent: this.consoleLogElement,
      attrs: {
        class: "consoleLogItem",
      },
      text: line,
    });
    // scroll to bottom
    this.consoleLogElement.scrollTop = this.consoleLogElement.scrollHeight - this.consoleLogElement.clientHeight;
  }

  clear(): void {
    this.consoleLogElement.textContent = "\n";
  }

  eventHubChanged(): void {
    this.eventHub?.on(events.Log, (evt) => {
      this.add(evt.payload);
    });
  }
}
