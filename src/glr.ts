import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { Sym, Grammar, Rule } from "./grammar";
import {
  PFNode,
  ParallelParser as ParserBase,
  BeforeAddingChildCallback,
  RuleReductionCallback,
  NextTokenCallback,
} from "./parser";
import { LRAction, LRActionType, ParseTable, LRItemGraph } from "./lr";

type Nullable<T> = TSU.Nullable<T>;
type NumMap<T> = TSU.NumMap<T>;

/**
 * Shared packed parse forest
 */
export class SPPF {
  nodes: PFNode[] = [];
  addNode(sym: Sym, value: any, ...children: PFNode[]): PFNode {
    // Should dups be checked for?
    const out = new PFNode(this.nodes.length, sym, value, ...children);
    this.nodes.push(out);
    return out;
  }
}

/*
 * A vertex in the graph structured stack.
 * Unlike the traditional vertex where a seperate vertex is used for state and symbols
 * we use the same to store both.
 *
 * A typical stack (or graph structured stack) looks like:
 *
 * S0 -> X1 -> S1 -> X2 -> S2 ....
 *   |
 *   |-> X4 -> S4 -> X5 -> S5
 *
 * Except for S0, every Sn must have a corresponding Xn before it and when
 * traversing these stacks (or graphs) we need one when accessing the other.
 * So combining the two in a single vertex object simplifies a lot of things.
 *
 * S0 can simply be encoded with a null X node.
 *
 * Another change is that instead of keeping a symbol in the vertex we keep a pointer
 * to the node on the shared packed forest to reuse common sub parse trees.
 */
export class GSSVertex {
  gen = 0;
  outgoing: NumMap<PFNode> = {};
  constructor(public readonly id: number, public readonly stateId: number) {}

  addEdge(another: GSSVertex, pfNode: PFNode): void {
    // TODO - See if a sorted list or set is needed
    if (!this.hasOutgoing(another)) {
      this.outgoing[another.id] = pfNode;
    }
  }

  hasOutgoing(another: GSSVertex): boolean {
    return another.id in this.outgoing;
  }
}

export class GSS {
  gen = 0;
  protected vertices: GSSVertex[] = [];
  addVertex(stateId: number): GSSVertex {
    const out = new GSSVertex(this.vertices.length, stateId);
    out.gen = this.gen;
    this.vertices.push(out);
    return out;
  }

  getVertex(id: number): GSSVertex {
    return this.vertices[id];
  }

  recurse(startV: GSSVertex, length: number, path: GSSVertex[], callback: any): void {
    if (length < 0) {
      callback();
    } else {
      path[length] = startV;
      for (const anotherId in startV.outgoing) {
        const succ = this.vertices[anotherId];
        this.recurse(succ, length - 1, path, callback);
      }
    }
  }
}

export class Parser extends ParserBase {
  /**
   * Whether to flatten parse tree nodes with a single child.
   */
  flatten: boolean;
  beforeAddingChildNode: BeforeAddingChildCallback;
  onReduction: RuleReductionCallback;
  onNextToken: NextTokenCallback;

  /**
   * Parses the input and returns the resulting root Parse Tree node.
   */
  gss: GSS;
  sppf: SPPF;
  rootVertex: null | GSSVertex;
  A: GSSVertex[];
  U: GSSVertex[];
  Unext: GSSVertex[];
  R: [GSSVertex, Rule, GSSVertex[]][];
  Q: [GSSVertex, number][];

  constructor(public readonly parseTable: ParseTable, config: any = {}) {
    super();
    this.flatten = config.flatten || false;
    this.beforeAddingChildNode = config.beforeAddingChildNode;
    this.onReduction = config.onReduction;
    this.onNextToken = config.onNextToken;
  }

  get grammar(): Grammar {
    return this.parseTable.grammar;
  }

  protected parseInput(input: TLEX.Tape): PFNode[] {
    this.reset();
    while (this.tokenbuffer.peek(input) != null) {
      let token = this.tokenbuffer.peek(input);
      if (token && this.onNextToken) {
        token = this.onNextToken(token);
      }
      if (token != null) {
        this.processToken(token);
      }
    }
    // TODO - Assemble all parse trees here
    return [];
  }

  reset(): void {
    this.gss = new GSS();
    this.sppf = new SPPF();
    const v0 = this.gss.addVertex(0); // Start vertex
    this.U = [v0];
    this.A = [v0];
    this.Unext = [];
    this.R = [];
    this.Q = [];
  }

  processToken(token: null | TLEX.Token): void {
    this.gss.gen++;
    const A = (this.A = [...this.U]);
    const R = (this.R = []);
    const Q = (this.Q = []);
    const nextSym = token == null ? this.grammar.Eof : this.getSym(token);
    const nextValue = token == null ? null : token.value;
    while (true) {
      if (A.length > 0) {
        this.processAction(token);
      } else if (R.length > 0) {
        this.processReductions(nextSym);
      } else {
        break;
      }
    }
    this.processShifts(nextSym, nextValue);
    // Advance the active vertex frontier
    this.U = this.Unext;
  }

  processShifts(nextSym: Sym, nextValue: any): void {
    this.Unext = [];
    while (this.Q.length > 0) {
      const [v, s] = this.Q.pop()!;
      const pfn = this.sppf.addNode(nextSym, nextValue);
      let created = false;
      for (const u of this.Unext) {
        if (u.stateId == s) {
          TSU.assert(!created, "Duplicate vertexes with same state");
          // Add an edge u -> v via pfn
          u.addEdge(v, pfn);
          created = true;
        }
      }
      if (!created) {
        const u = this.gss.addVertex(s);
        u.addEdge(v, pfn);
        this.Unext.push(u);
      }
    }
  }

  processReductions(nextSym: Sym): void {
    const [w, p, verts] = this.R.pop()!;
    const N = p.nt;
    const gotoAction = this.parseTable.getActions(w.stateId, N)[0];
    if (!gotoAction || !gotoAction.gotoState) return;
    const s = gotoAction.gotoState;
    // In Ui if a vertex u exists such that u.stateId == s
    const u = this.U.find((vertex) => vertex.stateId == s);
    const pfn = this.sppf.addNode(N, null);
    for (let i = 1; i < verts.length; i++) {
      // verts contains n + 1 vertices of the form:
      //
      // s0 <- node1 <- s1 <- node2 <- s2 ... <- nodeN <- sn
      //
      // where n is the length of the rhs of production p above
      //
      // Starting at 1 lets us skip s0 and obtain nodeX which is
      // the edge data for an edge between s[x-1] and s[x].
      const edge = verts[i].outgoing[verts[i - 1].id];
      pfn.children.push(edge);
    }
    if (u) {
      // if w is not a successor of u then add u -> w
      if (!u.hasOutgoing(w)) {
        u.addEdge(w, pfn);
        // for all v in Ui - A
        //    for all q such that reduce q is in actions(state(v), lA):
        //       for all verticies t such exists a walk of len(RHS(q)) from v -> t through z:
        //         add t,q to R
        for (const v of this.U) {
          if (this.A.indexOf(v) < 0) {
            // v in U - A
            for (const action of this.parseTable.getActions(v.stateId, nextSym)) {
              if (action.tag == LRActionType.REDUCE) {
                const q = action.rule!;
                const path: GSSVertex[] = [];
                this.gss.recurse(v, q.rhs.length, path, () => {
                  // see if the path goes through the newly created node
                  for (let i = 1; i < path.length; i++) {
                    if (path[i].outgoing[path[i - 1].id] == pfn) {
                      this.R.push([path[0], q, [...path]]);
                      break;
                    }
                  }
                });
              }
            }
          }
        }
      }
    } else {
      // create a PFNode with N -> [v.nodeId for v in verts]
      const u = this.gss.addVertex(s);
      u.addEdge(w, pfn);
      // Add u to A and Ui
      this.U.push(u);
      this.A.push(u);
    }
  }

  processAction(token: null | TLEX.Token): void {
    const v = this.U.pop();
    if (!v) return;
    const nextSym = token == null ? this.grammar.Eof : this.getSym(token);
    const actions = this.parseTable.getActions(v.stateId, nextSym);
    for (const action of actions) {
      if (action.tag == LRActionType.ACCEPT) {
        // good
      } else if (action.tag == LRActionType.SHIFT) {
        TSU.assert(action.gotoState != null, "gotoState cannot be null for shifts");
        this.Q.push([v, action.gotoState]);
      } else if (action.tag == LRActionType.REDUCE) {
        const rule = action.rule;
        TSU.assert(rule != null, "Rule cannot be null for reduce actions");
        // Find vertex w such that dist(w, v) == len(action.rule.rhs)
        const path: GSSVertex[] = [];
        this.gss.recurse(v, rule.rhs.length, path, () => {
          this.R.push([path[0], rule, [...path]]);
        });
      }
    }
  }
}
