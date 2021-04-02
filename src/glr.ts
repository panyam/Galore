export class GSSNode {
  /**
   * Parent node this node has extended from
   */
  parent: GSSNode;
  index: number;
  value: number;
  children: Node[] = [];

  isStateNode(): boolean {
    return this.index % 2 == 0;
  }
}

export class GSStack {
  leafNodes: Node[] = [];
}
