import * as TSU from "@panyam/tsutils";
import * as React from "react"
import * as G from "galore";
import "./styles/NormalizedGrammarView.scss"
import { BaseComponent } from "./contexts";
import * as configs from "./configs";
import * as events from "./events";

import { render } from "react-dom";
import AceEditor from "react-ace";
import * as ace from "ace-builds";
import "ace-builds/src-noconflict/mode-markdown";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

export class NormalizedGrammarArea extends BaseComponent {
  grammar: G.Grammar;
  aceEditor = React.createRef<AceEditor>();

  render() {
    return (<div id = "normalizedGrammarAreaParent" className = "windowChild">
      <div className = "grammarEditorArea">
        <AceEditor
            mode="java"
            theme="monokai"
            name="UNIQUE_ID_OF_DIV"
            ref={this.aceEditor}
            editorProps={{ $blockScrolling: true }}
          />
      </div>
    </div>)
  }

  get codeEditor(): AceEditor {
    return this.aceEditor.current!;
  }

  componentDidMount() {
    ace.config.set("basePath", "https://unpkg.com/ace-builds@1.4.12/src-noconflict");
    this.codeEditor.editor.setTheme("ace/theme/monokai");
    this.codeEditor.editor.session.setMode("ace/mode/markdown");
    this.codeEditor.editor.setReadOnly(true);
  }

  eventHubChanged(): void {
    console.log("here: ", this.eventHub);
    this.eventHub?.on(events.GrammarParsed, (evt) => {
      this.grammar = evt.payload;
      this.codeEditor.editor.setValue(this.grammar.debugValue.join("\n"));
    });
  }
}
