import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import "./styles/composer.scss";
import * as GL from "golden-layout";
import { InputView } from "./InputView";
import { ParseTableView } from "./ParseTableView";
import { ParseTreeView } from "./ParseTreeView";
import { GrammarView } from "./GrammarView";
import * as configs from "./configs";

/**
 * The app that drives the viewer and the editor.
 */
export class App {
  grammarView: GrammarView;
  inputView: InputView;
  parseTableView: ParseTableView;
  parseTreeView: ParseTreeView;
  grammarSelect: HTMLSelectElement;
  eventHub: TSU.Events.EventHub;

  constructor() {
    this.eventHub = new TSU.Events.EventHub();
    const desktopDiv = document.querySelector("#desktopArea") as HTMLDivElement;
    const grammarAreaDiv = document.querySelector("#grammarArea") as HTMLElement;
    const inputAreaDiv = document.querySelector("#inputArea") as HTMLElement;
    const ptreeAreaDiv = document.querySelector("#ptreeArea") as HTMLElement;
    const ptableAreaDiv = document.querySelector("#ptableArea") as HTMLElement;
    const consoleAreaDiv = document.querySelector("#consoleArea") as HTMLElement;

    this.grammarView = new GrammarView(grammarAreaDiv, this);
    this.grammarView.eventHub = this.eventHub;

    this.inputView = new InputView(inputAreaDiv, this);
    this.inputView.eventHub = this.eventHub;

    this.parseTableView = new ParseTableView(ptableAreaDiv, this);
    this.parseTableView.eventHub = this.eventHub;

    this.parseTreeView = new ParseTreeView(ptreeAreaDiv, this);
    this.parseTreeView.eventHub = this.eventHub;

    this.grammarSelect = document.querySelector("#grammarSelect") as HTMLSelectElement;

    const savedState = localStorage.getItem("savedState");
    const myLayout = new GL.GoldenLayout(
      configs.defaultGLConfig,
      // savedState == null ? configs.defaultGLConfig : JSON.parse(savedState),
      desktopDiv,
    );
    const resizeObserver = new ResizeObserver(() => {
      (myLayout as any).updateSize();
    });
    resizeObserver.observe(desktopDiv);
    myLayout.registerComponent("grammarArea", (container, componentState) => {
      const elem = container.getElement();
      elem.appendChild(grammarAreaDiv);
    });
    myLayout.registerComponent("inputArea", (container, componentState) => {
      const elem = container.getElement();
      elem.appendChild(inputAreaDiv);
    });
    myLayout.registerComponent("ptreeArea", (container, componentState) => {
      const elem = container.getElement();
      elem.appendChild(ptreeAreaDiv);
    });
    myLayout.registerComponent("ptableArea", (container, componentState) => {
      const elem = container.getElement();
      elem.appendChild(ptableAreaDiv);
    });
    myLayout.registerComponent("consoleArea", (container, componentState) => {
      const elem = container.getElement();
      elem.appendChild(consoleAreaDiv);
    });
    myLayout.on("stateChanged", function () {
      var state = JSON.stringify(myLayout.toConfig());
      localStorage.setItem("savedState", state);
      console.log("Saving State: ", state);
    });
    myLayout.init();

    this.populateGrammars();
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
    this.onGrammarChanged();
  }

  onGrammarChanged(): void {
    const gname = this.grammarSelect.value;
    const g = configs.builtinGrammars.find((x) => x.name == gname);
    this.grammarView.setContents(g?.grammar);
  }
}
