import "./styles/ParseTreeView.scss";

import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import { App } from "./app";
import * as events from "./events";
import * as G from "galore";

export class ParseTreeView extends TSV.View {
  readonly app: App;
  root: G.PTNode;
  rootSVGElement: SVGGraphicsElement;
  nodeViews = new Map<number, SVGGraphicsElement>();
  nodeHeaderViews = new Map<number, SVGGraphicsElement>();
  nodeChildrenViews = new Map<number, SVGGraphicsElement>();

  constructor(rootElement: HTMLElement, app: App, config?: TSV.ViewParams) {
    super(rootElement, config);
    this.app = app;
  }

  protected loadChildViews(): void {
    super.loadChildViews();
    this.rootSVGElement = TSU.DOM.createSVGNode("svg", {
      parent: this.rootElement,
    });
  }

  eventHubChanged(): void {
    console.log("here: ", this.eventHub);
    this.eventHub?.on(events.InputParsed, (evt) => {
      this.root = evt.payload;
      console.log("Parsed Tree Result: ", evt.payload);
      this.refreshView();
    });
  }

  refreshView(): void {
    this.nodeViews = new Map<number, SVGGraphicsElement>();
    this.nodeHeaderViews = new Map<number, SVGGraphicsElement>();
    this.nodeChildrenViews = new Map<number, SVGGraphicsElement>();
    this.rootSVGElement.innerHTML = "";
    this.processNode(this.root, this.rootSVGElement);
  }

  processNode(node: G.PTNode, container: SVGGraphicsElement): SVGGraphicsElement {
    const view = this.ensureNodeView(node, container);
    const headerView = this.nodeHeaderViews.get(node.id)!;

    // do all children
    let left = 0;
    let maxHeight = 0;
    let totalWidth = 0;
    let prevChild: SVGGraphicsElement;
    for (const child of node.children) {
      const childView = this.processNode(child, view);
      const bbox = childView.getBBox();
      totalWidth += bbox.width;
      maxHeight = Math.max(maxHeight, bbox.height);
      left += bbox.width;
      childView.setAttribute("x", "" + left);
    }

    // layout container and header
    return view;
  }

  ensureNodeView(node: G.PTNode, container: SVGGraphicsElement): SVGGraphicsElement {
    // create the new view
    if (!this.nodeViews.has(node.id)) {
      const nodeView = TSU.DOM.createSVGNode("svg", {
        parent: container,
        attrs: {
          class: "nodeContainer",
          nodeId: node.id,
        },
      });
      this.nodeViews.set(node.id, nodeView);
      this.nodeHeaderViews.set(
        node.id,
        TSU.DOM.createSVGNode("svg", { attrs: { class: "nodeHeaderView" }, parent: nodeView }),
      );
    }
    return this.nodeViews.get(node.id)!;
  }
}
