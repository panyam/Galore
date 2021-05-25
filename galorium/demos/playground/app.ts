import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import "./styles/composer.scss";
import * as GL from "golden-layout";
import { InputView } from "./InputView";
import { GrammarView } from "./GrammarView";

/**
 * The app that drives the viewer and the editor.
 */
export class App {
  constructor() {
    const desktopDiv = document.querySelector("#desktopArea") as HTMLDivElement;
    const grammarAreaDiv = document.querySelector("#grammarArea") as HTMLElement;
    const ptreeAreaDiv = document.querySelector("#ptreeArea") as HTMLElement;
    const ptableAreaDiv = document.querySelector("#ptableArea") as HTMLElement;
    const consoleAreaDiv = document.querySelector("#consoleArea") as HTMLElement;
    const inputAreaDiv = document.querySelector("#inputArea") as HTMLElement;

    const savedState = localStorage.getItem("savedState");
    const myLayout = new GL.GoldenLayout(savedState == null ? defaultGLConfig : JSON.parse(savedState), desktopDiv);
    const resizeObserver = new ResizeObserver(() => {
      (myLayout as any).updateSize();
    });
    resizeObserver.observe(desktopDiv);
    myLayout.registerComponent("grammarArea", (container, componentState) => {
      const elem = container.getElement();
      elem.appendChild(grammarAreaDiv);
      new GrammarView(grammarAreaDiv, this);
    });
    myLayout.registerComponent("inputArea", (container, componentState) => {
      const elem = container.getElement();
      elem.appendChild(inputAreaDiv);
      new InputView(inputAreaDiv, this);
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
  }
}

//
const defaultGLConfig: any = {
  content: [
    {
      type: "row",
      content: [
        {
          type: "column",
          content: [
            {
              type: "component",
              componentName: "grammarArea",
              title: "Grammar",
            },
            {
              type: "component",
              componentName: "inputArea",
              title: "Input",
            },
          ],
        },
        {
          type: "column",
          content: [
            {
              type: "column",
              content: [
                {
                  type: "row",
                  content: [
                    {
                      type: "component",
                      componentName: "ptreeArea",
                      title: "Parse Tree",
                    },
                    {
                      type: "component",
                      componentName: "ptableArea",
                      title: "Parse Table",
                    },
                  ],
                },
                {
                  type: "stack",
                  content: [
                    {
                      title: "Console",
                      type: "component",
                      componentName: "consoleArea",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
