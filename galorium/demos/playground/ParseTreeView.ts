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
  rootNodeView: PTNodeView;

  constructor(rootElement: HTMLElement, app: App, config?: TSV.ViewParams) {
    super(rootElement, config);
    this.app = app;
  }

  protected loadChildViews(): void {
    super.loadChildViews();
    this.rootSVGElement = TSU.DOM.createSVGNode("svg", {
      parent: this.rootElement,
      attr: {
        class: "ptreeRootSVG",
      },
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
    this.rootSVGElement.innerHTML = "";
    this.rootNodeView = new PTNodeView(this.root, this.rootSVGElement);
    const rootBBox = this.rootNodeView.rootElem.getBBox();
    this.rootSVGElement.setAttribute("width", "" + rootBBox.width);
    this.rootSVGElement.setAttribute("height", "" + rootBBox.height);
  }
}

class PTNodeView {
  headerElem: SVGGraphicsElement;
  textElem: SVGTextElement;
  tspanElem: SVGTSpanElement;
  headerBorderElem: SVGGraphicsElement;
  rootElem: SVGGraphicsElement;
  childContainer: SVGGraphicsElement;
  linesToChildren: SVGPathElement[];
  childViews: PTNodeView[];
  borderElem: SVGGraphicsElement;
  padding = 10;
  p2 = this.padding * 2;
  headerY = 0;
  childYGap = 20;
  textColor = "red";
  borderFillColor = "pink";
  borderOutlineColor = "white";
  headerFillColor = "pink";
  headerOutlineColor = "white";
  textOutlineColor = "red";
  textBGColor = "pink";
  lineColor = "white";
  lineWidth = 2;
  layoutHorizontal = false;
  constructor(
    public readonly node: G.PTNode,
    public readonly container: SVGGraphicsElement,
    public parent: PTNodeView | null = null,
  ) {
    this.rootElem = TSU.DOM.createSVGNode("svg", {
      parent: container,
      attrs: {
        class: "nodeContainer",
        nodeId: node.id,
      },
    });
    this.borderElem = TSU.DOM.createSVGNode("rect", {
      attrs: {
        class: "nodeBorderView",
        nodeId: node.id,
        fill: this.borderFillColor,
        stroke: this.borderOutlineColor,
      },
      parent: this.rootElem,
    });
    this.headerElem = TSU.DOM.createSVGNode("svg", {
      attrs: { class: "nodeHeaderView", nodeId: node.id },
      parent: this.rootElem,
    });
    this.headerBorderElem = TSU.DOM.createSVGNode("rect", {
      attrs: {
        class: "nodeHeaderBorderView",
        nodeId: node.id,
        fill: this.headerFillColor,
        stroke: this.headerOutlineColor,
      },
      parent: this.headerElem,
    });
    this.textElem = TSU.DOM.createSVGNode("text", {
      attrs: { class: "nodeTextView", nodeId: node.id },
      parent: this.headerElem,
    });
    this.tspanElem = TSU.DOM.createSVGNode("tspan", {
      text: this.node.sym.label,
      attrs: { class: "nodeTSpanView", fill: this.textColor, nodeId: node.id, style: "alignment-baseline: hanging" },
      parent: this.textElem,
    });

    this.textElem.setAttribute("x", "" + this.padding);
    this.textElem.setAttribute("y", "" + this.padding);
    const textElemBBox = this.textElem.getBBox();
    this.headerBorderElem.setAttribute("width", "" + (textElemBBox.width + this.p2));
    this.headerBorderElem.setAttribute("height", "" + (textElemBBox.height + this.p2));
    this.headerBorderElem.setAttribute("rx", "5");
    this.headerBorderElem.setAttribute("ry", "5");

    // create all children
    this.childViews = node.children.map((childNode) => new PTNodeView(childNode, this.rootElem, this));
    this.linesToChildren = node.children.map((childNode) => {
      return TSU.DOM.createSVGNode("path", {
        attrs: { class: "lineToParent", stroke: this.lineColor, nodeId: childNode.id },
        parent: this.rootElem,
      });
    });

    this.refreshLayout();
  }

  totalChildWidth = 0;
  totalChildHeight = 0;
  childIndent = 30;
  refreshLayout(): void {
    this.totalChildWidth = 0;
    this.totalChildHeight = 0;
    const headerBBox = this.headerElem.getBBox();
    if (this.layoutHorizontal) {
      const childY = this.headerY + this.childYGap + headerBBox.height;
      let maxHeight = 0;
      for (let i = 0; i < this.childViews.length; i++) {
        const childView = this.childViews[i];
        const bbox = childView.rootElem.getBBox();
        maxHeight = Math.max(maxHeight, bbox.height);
        childView.rootElem.setAttribute("y", "" + childY);
        if (i > 0) this.totalChildWidth += this.p2;
        childView.rootElem.setAttribute("x", "" + this.totalChildWidth);
        this.totalChildWidth += bbox.width;
      }
      // layout headerElem in the middle
      const headerX = Math.max(0, (this.totalChildWidth - headerBBox.width) / 2);
      this.headerElem.setAttribute("x", "" + headerX);
      this.headerElem.setAttribute("y", "" + this.headerY);
    } else {
      let maxWidth = 0;
      const childX = this.childIndent;
      this.totalChildHeight = headerBBox.height;
      for (let i = 0; i < this.childViews.length; i++) {
        const childView = this.childViews[i];
        const bbox = childView.rootElem.getBBox();
        maxWidth = Math.max(maxWidth, bbox.height);
        childView.rootElem.setAttribute("x", "" + childX);
        this.totalChildHeight += this.p2;
        childView.rootElem.setAttribute("y", "" + this.totalChildHeight);
        this.totalChildHeight += bbox.height;
      }
      // this.headerElem.setAttribute("y", "" + this.headerY);
    }
    for (let i = 0; i < this.childViews.length; i++) {
      this.updateLineToChild(i);
    }
  }

  get location(): [number, number] {
    const bb = this.rootElem.getBBox();
    return [bb.x, bb.y];
  }

  updateLineToChild(index: number): void {
    const childView = this.childViews[index];
    const lineToChild = this.linesToChildren[index];
    // And now the parent connector
    const [x, y] = this.location;
    const bcr = this.rootElem.getBoundingClientRect();
    const headerBCR = this.headerElem.getBoundingClientRect();
    const childBCR = childView.rootElem.getBoundingClientRect();
    const childHeaderBCR = childView.headerElem.getBoundingClientRect();

    if (this.layoutHorizontal) {
      const headerX = headerBCR.x - bcr.x;
      const headerY = headerBCR.y - bcr.y;
      const childX = childBCR.x - bcr.x;
      const childY = childBCR.y - bcr.y;
      const childHeaderX = childHeaderBCR.x - bcr.x;
      const childHeaderY = childHeaderBCR.y - bcr.y;
      const childWidth = childBCR.width;
      const childHeaderWidth = childHeaderBCR.width;
      const pathComps = [
        `M ${headerX + headerBCR.width / 2} ${headerY + headerBCR.height}`,
        `L ${childHeaderX + childHeaderWidth / 2} ${childY}`,
        `V ${childHeaderY}`,
      ];
      lineToChild.setAttribute("d", pathComps.join(" "));
    } else {
    }
  }

  get headerBBox(): SVGRect {
    return this.headerElem.getBBox();
  }
}
