import "./styles/GrammarView.scss";
import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import * as TLEX from "tlex";
import * as G from "galore";
import { App } from "./app";
import * as ace from "ace-builds";
import * as events from "./events";
import * as configs from "./configs";

export class GrammarView extends TSV.View {
  readonly app: App;
  headerElement: HTMLDivElement;
  editorElement: HTMLDivElement;
  codeEditor: ace.Ace.Editor;
  parserTypeSelect: HTMLSelectElement;
  saveButton: HTMLButtonElement;
  saveAsButton: HTMLButtonElement;
  compileButton: HTMLButtonElement;
  grammarSelect: HTMLSelectElement;
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
    this.grammarSelect = this.find("#grammarSelect") as HTMLSelectElement;
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
    setTimeout(() => this.populateGrammars(), 0);
  }

  populateGrammars(): void {
    let html = "";
    let defaultGrammar = null;
    for (const g of configs.builtinGrammars) {
      if (g.selected) {
        html += `<option selected='true' value="${g.name}">${g.label}</option>`;
      } else {
        html += `<option value="${g.name}">${g.label}</option>`;
      }
    }
    this.grammarSelect.innerHTML = html;
    this.grammarSelect.addEventListener("change", this.onGrammarChanged.bind(this));
    this.onGrammarChanged();
  }

  setContents(val: any): void {
    const lines = val.trim().split("\n").map((l: string) => l.trim());
    this.codeEditor.setValue(lines.join("\n"));
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
    });
    const endTime = performance.now();
    this.eventHub?.emit(events.Log, this, "Parser Compiled in " + (endTime - startTime) + "ms");
    this.eventHub?.emit(events.GrammarParsed, this, parser.grammar);
    this.parser = parser;
    this.eventHub?.emit(events.ParserCompiled, this, parser);
  }

  onGrammarChanged(): void {
    const gname = this.grammarSelect.value;
    const g = configs.builtinGrammars.find((x) => x.name == gname);
    this.setContents(g?.grammar);
    this.eventHub?.emit(events.GrammarSelected, this, {name: gname, grammar: this.parser.grammar});
  }
}
