import * as TSU from "@panyam/tsutils";

type EdgeData = any;
type EdgeFunctor<T> = (node: T) => ReadonlyArray<[T, EdgeData]>;
type IDFunc<T> = (t: T) => number | string;

export function allMinimalCycles<T>(
  nodes: ReadonlyArray<T>,
  idFunc: IDFunc<T>,
  edges: EdgeFunctor<T>,
): ReadonlyArray<[T, EdgeData]> {
  // Tells which cycle a node is assigned to if any
  const cycles: [T, EdgeData][] = [];
  const inACycle = {} as any;
  nodes.forEach((node) => {
    // start from node and do a BFS to see what cycle a node appears in
    if (!(idFunc(node) in inACycle)) {
      const startNode = node;
      const visited = {} as any;
      let queue: [T, [EdgeData, T][]][] = [[node, []]];
      while (queue.length > 0) {
        const newQueue: [T, [EdgeData, T][]][] = [];
        for (let i = 0; i < queue.length; i++) {
          const [node, c] = queue[i];
          TSU.assert(node != null);
          const e = edges(node);
          let cycle = [...c];
          for (const [nextNode, edgeData] of e) {
            if (nextNode == startNode) {
              // we have a cycle
              cycle.push([edgeData, nextNode]);
              cycle.forEach(([e, n], i) => (inACycle[n] = true));
              cycles.push([startNode, cycle]);
              cycle = cycle.slice(0, cycle.length - 1);
            } else if (!(idFunc(nextNode) in visited)) {
              visited[idFunc(nextNode)] = true;
              newQueue.push([nextNode, [...cycle, [edgeData, nextNode]]]);
            }
          }
        }
        queue = newQueue;
      }
    }
  });
  return cycles;
}
