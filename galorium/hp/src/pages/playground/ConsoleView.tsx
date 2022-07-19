import * as TSU from "@panyam/tsutils";
import * as React from "react"
import "./styles/ConsoleView.scss"
import { BaseComponent } from "./contexts";
import { render } from "react-dom";
import AceEditor from "react-ace";
import * as ace from "ace-builds";
import * as configs from "./configs";
import * as events from "./events";

export class ConsoleArea extends BaseComponent {
  parserType = ""
  consoleLogArea = React.createRef<HTMLDivElement>();
  eventHubChanged() {
    this.eventHub.on(events.Log, (evt: any) => {
      this.add(evt.payload);
    });
  }

  render() {
    return (
      <div className = "consoleAreaParent windowChild">
        <div className = "consoleHeaderArea">
          <button className = "clearButton" onClick={() => this.clear()}>Clear</button>
        </div>
        <div ref={this.consoleLogArea} className = "consoleLogArea"></div>
      </div>
    )
  }

  add(line: string): void {
    const parent = this.consoleLogArea.current!;
    TSU.DOM.createNode("div", {
      parent: parent,
      attrs: {
        class: "consoleLogItem",
      },
      text: line,
    });
    // scroll to bottom
    parent.scrollTop = parent.scrollHeight - parent.clientHeight;
  }

  clear(): void {
    this.consoleLogArea.current!.textContent = "\n";
  }
}
