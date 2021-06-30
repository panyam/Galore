import "./styles/InputView.scss";

import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import { App } from "./app";
import * as ace from "ace-builds";
import * as events from "./events";
import * as G from "galore";
import * as configs from "./configs";

export class InputView extends TSV.View {
  readonly app: App;
  codeEditor: ace.Ace.Editor;
  headerElement: HTMLDivElement;
  editorElement: HTMLDivElement;
  parser: G.Parser;
  parseButton: HTMLButtonElement;

  constructor(rootElement: HTMLElement, app: App, config?: TSV.ViewParams) {
    super(rootElement, config);
    this.app = app;
  }

  protected loadChildViews(): void {
    super.loadChildViews();
    ace.config.set("basePath", "https://unpkg.com/ace-builds@1.4.12/src-noconflict");
    this.headerElement = this.find(".inputHeaderArea") as HTMLDivElement;
    this.editorElement = this.find(".inputEditorArea") as HTMLDivElement;
    this.codeEditor = ace.edit(this.editorElement);
    this.codeEditor.setTheme("ace/theme/monokai");
    this.codeEditor.session.setMode("ace/mode/markdown");

    this.parseButton = this.find(".parseButton") as HTMLButtonElement;
    this.parseButton.addEventListener("click", (evt) => {
      this.parse();
    });

    this.codeEditor.on("change", (data: any) => {
      // Called on change - invoke incremental parsing here
    });

    // add command to lazy-load keybinding_menu extension
    this.codeEditor.commands.addCommand({
      name: "saveDocument",
      bindKey: { win: "Ctrl-s", mac: "Command-s" },
      exec: (editor: ace.Ace.Editor) => {
        alert("TODO - Saving Input");
      },
    });
    this.codeEditor.commands.addCommand({
      name: "compileGrammar",
      bindKey: { win: "Ctrl-enter", mac: "Command-enter" },
      exec: (editor: ace.Ace.Editor) => {
        this.parse();
      },
    });
  }

  setContents(val: any): void {
    this.codeEditor.setValue(val);
    this.codeEditor.clearSelection();
  }

  eventHubChanged(): void {
    console.log("here: ", this.eventHub);
    this.eventHub?.on(events.ParserCompiled, (evt) => {
      this.parser = evt.payload;
      console.log("Parser compiled", evt);
    });
    this.eventHub?.on(events.GrammarSelected, (evt) => {
      const name = evt.payload.name;
      const g = configs.builtinGrammars.find((x) => x.name == name);
      this.setContents(g?.sampleInput || "");
    });
  }

  parse(): void {
    const input = this.codeEditor.getValue();
    const startTime = performance.now();
    const ptree = this.parser.parse(input);
    const endTime = performance.now();
    this.eventHub?.emit(events.Log, this, "Input Parsed in " + (endTime - startTime) + "ms");
    this.eventHub?.emit(events.InputParsed, this, ptree);
  }
}
