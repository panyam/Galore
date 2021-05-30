import "./styles/GrammarView.scss";
import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import * as TLEX from "tlex";
import * as G from "galore";
import { App } from "./app";
import * as ace from "ace-builds";
import * as events from "./events";

export class GrammarView extends TSV.View {
  readonly app: App;
  headerElement: HTMLDivElement;
  editorElement: HTMLDivElement;
  codeEditor: ace.Ace.Editor;
  parserTypeSelect: HTMLSelectElement;
  saveButton: HTMLButtonElement;
  saveAsButton: HTMLButtonElement;
  compileButton: HTMLButtonElement;
  parser: G.LR.Parser;

  constructor(rootElement: HTMLElement, app: App, config?: TSV.ViewParams) {
    super(rootElement, config);
    this.app = app;
  }

  protected loadChildViews(): void {
    super.loadChildViews();
    ace.config.set("basePath", "https://unpkg.com/ace-builds@1.4.12/src-noconflict");
    this.saveButton = this.find(".saveButton") as HTMLButtonElement;
    this.saveAsButton = this.find(".saveAsButton") as HTMLButtonElement;
    this.headerElement = this.find(".grammarHeaderArea") as HTMLDivElement;
    this.editorElement = this.find(".grammarEditorArea") as HTMLDivElement;
    this.parserTypeSelect = this.find(".parserTypeSelect") as HTMLSelectElement;
    this.codeEditor = ace.edit(this.editorElement);
    this.codeEditor.setTheme("ace/theme/monokai");
    this.codeEditor.session.setMode("ace/mode/markdown");

    this.compileButton = this.find(".compileButton") as HTMLButtonElement;
    this.compileButton.addEventListener("click", (evt) => {
      this.compile();
    });

    this.codeEditor.on("change", (data: any) => {
      // Called on change - invoke incremental parsing here
    });

    // add command to lazy-load keybinding_menu extension
    this.codeEditor.commands.addCommand({
      name: "saveDocument",
      bindKey: { win: "Ctrl-s", mac: "Command-s" },
      exec: (editor: ace.Ace.Editor) => {
        alert("TODO - Saving Grammar");
      },
    });
    this.codeEditor.commands.addCommand({
      name: "compileGrammar",
      bindKey: { win: "Ctrl-enter", mac: "Command-enter" },
      exec: (editor: ace.Ace.Editor) => {
        this.compile();
      },
    });
  }

  setContents(val: any): void {
    this.codeEditor.setValue(val);
    this.codeEditor.clearSelection();
    this.compile();
  }

  get parserType(): string {
    return this.parserTypeSelect.value;
  }

  compile(): void {
    const g = this.codeEditor.getValue();
    const startTime = performance.now();
    const [parser, tokenizer] = G.newParser(g, {
      flatten: true,
      type: this.parserType,
      onGrammarParsed: (grammar: G.Grammar) => {
        this.eventHub?.emit(events.GrammarChanged, this, grammar);
      },
    });
    const endTime = performance.now();
    this.parser = parser;
    this.eventHub?.emit(events.Log, this, "Parser Compiled in " + (endTime - startTime) + "ms");
    this.eventHub?.emit(events.ParserCompiled, this, parser);
  }
}
