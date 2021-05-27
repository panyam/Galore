import "./styles/NormalizedGrammarView.scss";
import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import * as TLEX from "tlex";
import * as G from "galore";
import { App } from "./app";
import * as ace from "ace-builds";
import * as events from "./events";

export class NormalizedGrammarView extends TSV.View {
  readonly app: App;
  editorElement: HTMLDivElement;
  codeEditor: ace.Ace.Editor;
  grammar: G.Grammar;

  constructor(rootElement: HTMLElement, app: App, config?: TSV.ViewParams) {
    super(rootElement, config);
    this.app = app;
  }

  protected loadChildViews(): void {
    super.loadChildViews();
    ace.config.set("basePath", "https://unpkg.com/ace-builds@1.4.12/src-noconflict");
    this.editorElement = this.find(".grammarEditorArea") as HTMLDivElement;
    this.codeEditor = ace.edit(this.editorElement);
    this.codeEditor.setTheme("ace/theme/monokai");
    this.codeEditor.session.setMode("ace/mode/markdown");
    this.codeEditor.setReadOnly(true);
  }

  eventHubChanged(): void {
    console.log("here: ", this.eventHub);
    this.eventHub?.on(events.GrammarChanged, (evt) => {
      this.grammar = evt.payload;
      this.codeEditor.setValue(this.grammar.debugValue.join("\n"));
    });
  }
}
