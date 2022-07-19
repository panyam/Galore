
import * as React from "react"
import * as G from "galore";
import "./styles/InputView.scss"
import { BaseComponent } from "./contexts";
import * as configs from "./configs";
import * as events from "./events";

import { render } from "react-dom";
import AceEditor from "react-ace";
import * as ace from "ace-builds";
import "ace-builds/src-noconflict/mode-markdown";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

export class InputArea extends BaseComponent {
  parser: G.Parser;
  parserType = ""
  inputEditor = React.createRef<InputEditor>();

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
              this.parse();
            },
          });
  }

  render() {
    return (
      <div id = "inputAreaParent" className = "windowChild">
        <div className = "inputHeaderArea">
          <button className = "parseButton"
                  onClick={() => this.parse()}>Parse</button>
        </div>
        <div className = "inputEditorArea">
          <InputEditor ref= {this.inputEditor}/>
        </div>
      </div>
    )
  }

  get codeEditor(): AceEditor {
    return this.inputEditor.current!.aceEditor.current!;
  }

  parse(): void {
    const input = this.codeEditor.editor.getValue();
    const startTime = performance.now();
    const ptree = this.parser.parse(input);
    const endTime = performance.now();
    this.eventHub?.emit(events.Log, this, "Input Parsed in " + (endTime - startTime) + "ms");
    this.eventHub?.emit(events.InputParsed, this, ptree);
  }

  setContents(val: any): void {
    this.codeEditor.editor.setValue(val);
    this.codeEditor.editor.clearSelection();
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
}

export class InputEditor extends React.Component {
  aceEditor = React.createRef<AceEditor>();
  render() {
    return (<AceEditor
        mode="java"
        theme="monokai"
        onChange={this.onChange.bind(this)}
        name="UNIQUE_ID_OF_DIV"
        editorProps={{ $blockScrolling: true }}
        ref={this.aceEditor}
      />)
  }

  onChange() {
  }
}
