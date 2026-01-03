import * as TSU from "@panyam/tsutils";
import * as React from "react"
import * as G from "galore";
import "./styles/GrammarView.scss"
import { BaseComponent } from "./contexts";
import * as configs from "./configs";
import * as events from "./events";

import { render } from "react-dom";
import AceEditor from "react-ace";
import * as ace from "ace-builds";
import "ace-builds/src-noconflict/mode-markdown";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";


export class GrammarArea extends BaseComponent {
  parser: G.Parser;
  parserTypeSelect = React.createRef<HTMLSelectElement>();
  grammarSelect = React.createRef<HTMLSelectElement>();
  aceEditor = React.createRef<AceEditor>();

  componentDidMount() {
    this.codeEditor.editor.commands.addCommand({
            name: "saveDocument",
            bindKey: { win: "Ctrl-s", mac: "Command-s" },
            exec: (editor: ace.Ace.Editor) => {
              alert("TODO - Saving Grammar");
            },
          });

    this.codeEditor.editor.commands.addCommand({
            name: "compileGrammar",
            bindKey: { win: "Ctrl-enter", mac: "Command-enter" },
            exec: (editor: ace.Ace.Editor) => {
              this.compile();
            },
          });
    setTimeout(() => this.populateGrammars(), 0);
  }

  render() {
    return (
      <div className = "grammarAreaParent">
        <div className = "grammarHeaderArea">
          <button className = "saveButton">Save</button>
          <button className = "saveAsButton">Save As</button>
          <button className = "compileButton" onClick={this.compile.bind(this)}>Compile</button>
          <span style={{color: "white"}}> Type: </span>
          <select className = "parserTypeSelect"
                  ref = {this.parserTypeSelect}>
            <option value="slr">SLR</option>
            <option value="lalr">LALR</option>
            <option value="lr1">LR1</option>
          </select>
          <span style={{color: "white"}}>Grammar: </span>
          <select id = "grammarSelect"
                  ref = {this.grammarSelect}
                  onChange={this.onGrammarChanged.bind(this)}>
            <option value="json">JSON</option>
            <option value="javascript">Javascript</option>
            <option value="C">C</option>
          </select>
        </div>
        <div className = "grammarEditorArea">
          <AceEditor
              mode="java"
              theme="monokai"
              onChange={this.onContentsChanged.bind(this)}
              name="UNIQUE_ID_OF_DIV"
              ref={this.aceEditor}
              editorProps={{ $blockScrolling: true }}
            />
        </div>
      </div>
    )
  }

  get codeEditor(): AceEditor {
    return this.aceEditor.current!;
  }

  setContents(val: any): void {
    const lines = val
      .trim()
      .split("\n")
      .map((l: string) => l.trim());
    this.codeEditor.editor.setValue(lines.join("\n"));
    this.codeEditor.editor.clearSelection();
    this.compile();
  }

  get parserType(): string {
    return this.parserTypeSelect.current!.value || "";
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
    this.grammarSelect.current!.innerHTML = html;
    this.onGrammarChanged();
  }

  compile() {
    console.log("Compiling");
    const g = this.codeEditor.editor.getValue();
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
    const gname = this.grammarSelect.current!.value;
    const g = configs.builtinGrammars.find((x) => x.name == gname);
    this.setContents(g?.grammar);
    this.eventHub?.emit(events.GrammarSelected, this, { name: gname, grammar: this.parser.grammar });
  }

  onContentsChanged(): void {
  }
}
