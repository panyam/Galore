import * as React from "react"
import "./styles/composer.scss";
import * as Styles from "../commonstyles"
import * as GL from "golden-layout";
import { BaseComponent } from "./contexts"
import { GrammarArea } from "./GrammarView"
import { NormalizedGrammarArea } from "./NormalizedGrammarView"
import { ConsoleArea } from "./ConsoleView"
import { InputArea } from "./InputView"
import { ParseTableView } from "./ParseTableView"
import { ParseTreeView } from "./ParseTreeView"
import * as configs from "./configs";

const LAYOUT_STATE_KEY = "galorium:savedState";

// markup
export default class IndexPage extends BaseComponent {
  inputArea = React.createRef<InputArea>()
  desktopDiv= React.createRef<HTMLDivElement>()
  statusBarDiv= React.createRef<HTMLDivElement>()
  grammarAreaDiv = React.createRef<HTMLDivElement>()
  normalizedGrammarAreaDiv = React.createRef<HTMLDivElement>()
  inputAreaDiv = React.createRef<HTMLDivElement>()
  consoleAreaDiv = React.createRef<HTMLDivElement>()
  ptreeAreaDiv = React.createRef<HTMLDivElement>()
  ptableAreaDiv = React.createRef<HTMLDivElement>()

  render() {
    return (
      <main style={Styles.pageStyles}>
        <title>Galore Playground</title>
        <link type="text/css" rel="stylesheet" href="https://golden-layout.com/files/latest/css/goldenlayout-base.css" />
        <link type="text/css" rel="stylesheet" href="https://golden-layout.com/files/latest/css/goldenlayout-dark-theme.css" />
        /* "overflow-x: auto" */
        <h2 style={Styles.headingStyles}><span id = "scoreTitleHeading">Galore Playground</span></h2>
        <div className="desktopArea" ref={this.desktopDiv}></div>
        <div className="statusBar" ref = {this.statusBarDiv}>Welcome!</div>
        <div ref = {this.grammarAreaDiv} className = "windowChild">
          <GrammarArea />
        </div>
        <div ref = {this.normalizedGrammarAreaDiv} className = "windowChild">
          <NormalizedGrammarArea />
        </div>
        <div ref = {this.inputAreaDiv} className = "windowChild">
          <InputArea ref = {this.inputArea}/>
        </div>
        <div ref = {this.ptableAreaDiv} className = "windowChild"> <ParseTableView /> </div>
        <div ref = {this.ptreeAreaDiv} className = "windowChild"> <ParseTreeView /> </div>
        <div ref = {this.consoleAreaDiv} className = "windowChild"> <ConsoleArea /> </div>
      </main>
    )
  }

  componentDidMount() {
    const savedState = localStorage.getItem(LAYOUT_STATE_KEY);
    let inputContents = "";
    const desktopDiv = this.desktopDiv.current!
    const grammarAreaDiv = this.grammarAreaDiv.current!
    const normalizedGrammarAreaDiv = this.normalizedGrammarAreaDiv.current!
    const inputAreaDiv = this.inputAreaDiv.current!
    const consoleAreaDiv = this.consoleAreaDiv.current!
    const ptreeAreaDiv = this.ptreeAreaDiv.current!
    const ptableAreaDiv = this.ptableAreaDiv.current!

    const myLayout = new GL.GoldenLayout(
      configs.defaultGLConfig,
      // savedState == null ? configs.defaultGLConfig : JSON.parse(savedState),
      desktopDiv,
    );
    const resizeObserver = new ResizeObserver(() => {
      (myLayout as any).updateSize();
    });
    resizeObserver.observe(desktopDiv);
    myLayout.registerComponent("grammarArea", (container, componentState: any) => {
      const elem = container.getElement();
      elem.appendChild(grammarAreaDiv);
    });
    myLayout.registerComponent("normalizedGrammarArea", (container, componentState) => {
      const elem = container.getElement();
      elem.appendChild(normalizedGrammarAreaDiv);
    });
    myLayout.registerComponent("inputArea", (container, componentState: any) => {
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
      localStorage.setItem(LAYOUT_STATE_KEY, state);
      console.log("Saving State: ", state);
    });
    myLayout.init();

    this.inputArea.current!.setContents(inputContents);
  }
}
