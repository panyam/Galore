import * as React from "react"
import * as G from "galore";
import "./styles/ParseTreeView.scss"
import { BaseComponent } from "./contexts";
import * as configs from "./configs";
import * as events from "./events";

export class ParseTreeView extends BaseComponent {
  headerElement: HTMLDivElement;
  parser: G.Parser;
  state = {html: ""} as any
  root: G.PTNode;
  rootNodeView = React.createRef<PTNodeView>();
  ptreeRootSVG = React.createRef<SVGSVGElement>();

  eventHubChanged(): void {
    console.log("here: ", this.eventHub);
    this.eventHub?.on(events.InputParsed, (evt) => {
      this.root = evt.payload;
      console.log("Parsed Tree Result: ", evt.payload);
      this.refreshView();
    });
  }

  render() {
  if (this.root) {
    return ( <svg ref = {this.ptreeRootSVG} className = "ptreeRootSVG">
      <PTNodeView ref = {this.rootNodeView} node={this.root} parent={null} />
    </svg> )
  } else {
    return ( <svg ref = {this.ptreeRootSVG} className = "ptreeRootSVG"> </svg> )
  }
  }

  refreshView(): void {
    // kick off a re render
    this.setState({})
  }

  componentDidMount() {
    // once rendered set the bbox
    const ptnodeView: PTNodeView = this.rootNodeView.current!;
    if (ptnodeView) {
      const rootBBox = ptnodeView.rootElem.current!.getBBox();
      this.ptreeRootSVG.current!.setAttribute("width", "" + rootBBox.width);
      this.ptreeRootSVG.current!.setAttribute("height", "" + rootBBox.height);
    }
  }
}

interface PTNodePropType {
  node: G.PTNode;
  parent: PTNodeView|null
};

class PTNodeView extends BaseComponent<PTNodePropType> {
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

  rootElem = React.createRef<SVGSVGElement>();
  headerElem = React.createRef<SVGSVGElement>();
  headerBorderElem = React.createRef<SVGRectElement>();
  textElem = React.createRef<SVGTextElement>();
  tspanElem = React.createRef<SVGTSpanElement>();
  linesToChildren: React.RefObject<LineToChild>[];
  childViews: React.RefObject<PTNodeView>[];
  borderElem = React.createRef<SVGRectElement>();

  render() {
    const node = (this.props as PTNodePropType).node;
    // create all children
    this.childViews = node.children.map((childNode) => {
        const out = React.createRef<PTNodeView>();
        <PTNodeView ref={out} node={childNode} parent = {this} />
        return out;
    });

    this.linesToChildren = node.children.map((childNode) => {
      const out = React.createRef<LineToChild>();
      (<LineToChild />)
      return out;
    });

    return (
      <svg ref = {this.rootElem} className = "nodeContainer" /*nodeId = {node.id}*/>
        <rect ref = {this.borderElem} className = "nodeBorderView" fill = {this.borderFillColor} stroke = {this.borderOutlineColor}>
        </rect>
        <svg ref = {this.headerElem} className="nodeHeaderView">
          <rect ref={this.headerBorderElem} className="nodeHeaderBorderView"
                fill = {this.headerFillColor}
                stroke = {this.headerOutlineColor}>
          </rect>
          <text ref={this.textElem} className="nodeTextView"
                x = {this.padding} y = {this.padding}>
            <tspan ref={this.tspanElem} className = "nodeTSpanView"
                   fill = {this.textColor}
                   style = {{alignmentBaseline: "hanging"}}>
                  {node.sym.label}
            </tspan>
          </text>
        </svg>
      </svg>
    )
  }

  componentDidMount() {
    const textElemBBox = this.textElem.current!.getBBox();
    const headerBorder = this.headerBorderElem.current!;
    headerBorder.setAttribute("width", "" + (textElemBBox.width + this.p2));
    headerBorder.setAttribute("height", "" + (textElemBBox.height + this.padding));
    headerBorder.setAttribute("rx", "5");
    headerBorder.setAttribute("ry", "5");

    this.refreshLayout();
  }

  totalChildWidth = 0;
  totalChildHeight = 0;
  childIndent = 30;
  refreshLayout(): void {
    this.totalChildWidth = 0;
    this.totalChildHeight = 0;
    const headerBBox = this.headerElem.current!.getBBox();
    if (this.layoutHorizontal) {
      const childY = this.headerY + this.childYGap + headerBBox.height;
      let maxHeight = 0;
      for (let i = 0; i < this.childViews.length; i++) {
        const childView = this.childViews[i].current!;
        const childRootElem = childView.rootElem.current!;
        const bbox = childView.rootElem.current!.getBBox();
        maxHeight = Math.max(maxHeight, bbox.height);
        childRootElem.setAttribute("y", "" + childY);
        if (i > 0) this.totalChildWidth += this.p2;
        childRootElem.setAttribute("x", "" + this.totalChildWidth);
        this.totalChildWidth += bbox.width;
      }
      // layout headerElem in the middle
      const headerX = Math.max(0, (this.totalChildWidth - headerBBox.width) / 2);
      this.headerElem.current!.setAttribute("x", "" + headerX);
      this.headerElem.current!.setAttribute("y", "" + this.headerY);
    } else {
      let maxWidth = 0;
      const childX = this.childIndent;
      this.totalChildHeight = headerBBox.height;
      for (let i = 0; i < this.childViews.length; i++) {
        const childView = this.childViews[i].current!;
        const childRootElem = childView.rootElem.current!;
        const bbox = childRootElem.getBBox();
        maxWidth = Math.max(maxWidth, bbox.height);
        childRootElem.setAttribute("x", "" + childX);
        this.totalChildHeight += this.padding;
        childRootElem.setAttribute("y", "" + this.totalChildHeight);
        this.totalChildHeight += bbox.height;
      }
      // this.headerElem.setAttribute("y", "" + this.headerY);
    }
    for (let i = 0; i < this.childViews.length; i++) {
      this.updateLineToChild(i);
    }
  }

  get location(): [number, number] {
    const bb = this.rootElem.current!.getBBox();
    return [bb.x, bb.y];
  }

  updateLineToChild(index: number): void {
    const childView = this.childViews[index].current!;
    const lineToChild = this.linesToChildren[index];
    // And now the parent connector
    const [x, y] = this.location;
    const bcr = this.rootElem.current!.getBoundingClientRect();
    const headerBCR = this.headerElem.current!.getBoundingClientRect();
    const childBCR = childView.rootElem.current!.getBoundingClientRect();
    const childHeaderBCR = childView.headerElem.current!.getBoundingClientRect();
    const headerX = headerBCR.x - bcr.x;
    const headerY = headerBCR.y - bcr.y;
    const childX = childBCR.x - bcr.x;
    const childY = childBCR.y - bcr.y;
    const childHeaderX = childHeaderBCR.x - bcr.x;
    const childHeaderY = childHeaderBCR.y - bcr.y;

    if (this.layoutHorizontal) {
      const childWidth = childBCR.width;
      const childHeaderWidth = childHeaderBCR.width;
      const pathComps = [
        `M ${headerX + headerBCR.width / 2} ${headerY + headerBCR.height}`,
        `L ${childHeaderX + childHeaderWidth / 2} ${childY}`,
        `V ${childHeaderY}`,
      ];
      lineToChild.current!.pathRef.current!.setAttribute("d", pathComps.join(" "));
    } else {
      const childHeight = childBCR.height;
      const childHeaderHeight = childHeaderBCR.height;
      const pathComps = [
        `M ${headerX + this.childIndent / 2} ${headerY + headerBCR.height}`,
        `V ${childY + childHeaderHeight / 2}`,
        `h ${this.childIndent / 2}`,
      ];
      lineToChild.current!.pathRef.current!.setAttribute("d", pathComps.join(" "));
    }
  }

  get headerBBox(): SVGRect {
    return this.headerElem.current!.getBBox();
  }
}

export class LineToChild extends BaseComponent {
  pathRef = React.createRef<SVGPathElement>();
  render() {
    return (<path className="lineToParent" fill = "none" ref = {this.pathRef}
                  stroke = {(this.props as any).lineColor} />);
  }
}
