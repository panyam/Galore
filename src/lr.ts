import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { Sym, Grammar, Rule } from "./grammar";
import {
  PTNode,
  SimpleParser as ParserBase,
  BeforeAddingChildCallback,
  RuleReductionCallback,
  NextTokenCallback,
} from "./parser";

type Nullable<T> = TSU.Nullable<T>;
type NumMap<T> = TSU.NumMap<T>;
type StringMap<T> = TSU.StringMap<T>;

export enum LRActionType {
  ACCEPT,
  SHIFT,
  REDUCE,
  GOTO, // can *ONLY* be valid for non-terms
}

export class LRAction {
  // Type of action
  tag: LRActionType;

  // Next state to go to after performing the action (if valid).
  gotoState: Nullable<number> = null;

  // The rule to be used for a reduce action
  rule: Nullable<Rule> = null;

  toString(): string {
    if (this.tag == LRActionType.ACCEPT) return "Acc";
    else if (this.tag == LRActionType.SHIFT) {
      return "S" + this.gotoState!;
    } else if (this.tag == LRActionType.REDUCE) {
      return "R " + this.rule!.id;
    } else {
      return "" + this.gotoState!;
    }
  }

  equals(another: LRAction): boolean {
    return this.tag == another.tag && this.gotoState == another.gotoState && this.rule == another.rule;
  }

  static Shift(goto: number): LRAction {
    const out = new LRAction();
    out.tag = LRActionType.SHIFT;
    out.gotoState = goto;
    return out;
  }

  static Reduce(rule: Rule): LRAction {
    const out = new LRAction();
    out.tag = LRActionType.REDUCE;
    out.rule = rule;
    return out;
  }

  static Goto(gotoState: number): LRAction {
    const out = new LRAction();
    out.tag = LRActionType.GOTO;
    out.gotoState = gotoState;
    return out;
  }

  static Accept(): LRAction {
    const out = new LRAction();
    out.tag = LRActionType.ACCEPT;
    return out;
  }
}

/**
 * A parsing table for LR parsers.
 */
export class ParseTable {
  // Records which actions have conflicts
  conflictActions: NumMap<StringMap<boolean>> = {};

  /**
   * Maps symbol (by id) to the action;
   */
  actions: NumMap<NumMap<LRAction[]>> = {};

  constructor(public readonly grammar: Grammar) {}

  get hasConflicts(): boolean {
    return Object.keys(this.conflictActions).length > 0;
  }

  /**
   * Gets the action for a given sym from a given state.
   */
  getActions(stateId: number, next: Sym, ensure = false): LRAction[] {
    let l1: NumMap<LRAction[]>;
    if (stateId in this.actions) {
      l1 = this.actions[stateId];
    } else if (ensure) {
      l1 = this.actions[stateId] = {};
    } else {
      return [];
    }

    if (next.id in l1) {
      return l1[next.id];
    } else if (ensure) {
      return (l1[next.id] = []);
    }
    return [];
  }

  addAction(stateId: number, next: Sym, action: LRAction): this {
    const actions = this.getActions(stateId, next, true);
    if (actions.findIndex((ac) => ac.equals(action)) < 0) {
      actions.push(action);
    }
    if (actions.length > 1) {
      this.conflictActions[stateId] = this.conflictActions[stateId] || {};
      this.conflictActions[stateId][next.label] = true;
    }
    return this;
  }

  get debugValue(): any {
    const out: any = {};
    for (const fromId in this.actions) {
      out[fromId] = {};
      for (const symId in this.actions[fromId]) {
        const sym = this.grammar.getSymById(symId as any)!;
        const actions = this.actions[fromId][sym.id] || [];
        if (actions.length > 0) {
          out[fromId][sym.label] = actions.map((a) => a.toString());
        }
      }
    }
    return out;
  }
}

export class ParseStack {
  // A way of marking the kind of item that is on the stack
  // true => isStateId
  // false => isSymbolId
  readonly stateStack: number[] = [];
  readonly nodeStack: PTNode[] = [];

  push(state: number, node: PTNode): void {
    this.stateStack.push(state);
    this.nodeStack.push(node);
  }

  /**
   * Gets the nth item from the top of the stack.
   */
  top(nth = 0): [number, PTNode] {
    return [this.stateStack[this.stateStack.length - 1 - nth], this.nodeStack[this.nodeStack.length - 1 - nth]];
  }

  pop(): [number, PTNode] {
    const out = this.top();
    this.stateStack.pop();
    this.nodeStack.pop();
    return out;
  }

  /**
   * Pop N items from the stack.
   */
  popN(n = 1): void {
    const L = this.stateStack.length;
    this.stateStack.splice(L - n, n);
    this.nodeStack.splice(L - n, n);
  }

  get isEmpty(): boolean {
    return this.stateStack.length == 0 || this.nodeStack.length == 0;
  }
}

export type ActionResolverCallback = (
  actions: LRAction[],
  stack: ParseStack,
  tokenbuffer: TLEX.TokenBuffer,
) => LRAction;

export type RuleActionHandler = (rule: Rule, parent: PTNode, ...children: PTNode[]) => any;

export interface ParserContext {
  buildParseTree?: boolean;
  copySingleChild?: boolean;
  semanticHandler: TSU.StringMap<RuleActionHandler>;
  beforeAddingChildNode?: BeforeAddingChildCallback;
  onReduction?: RuleReductionCallback;
  onNextToken?: NextTokenCallback;
  actionResolver?: ActionResolverCallback;
}

export class Parser extends ParserBase {
  constructor(public readonly parseTable: ParseTable, config: any = {}) {
    super();
  }

  get grammar(): Grammar {
    return this.parseTable.grammar;
  }

  /**
   * Parses the input and returns the resulting root Parse Tree node.
   */
  protected parseInput(input: TLEX.Tape, context?: ParserContext): Nullable<PTNode> {
    context = context || ({} as ParserContext);
    if (context.buildParseTree != false) context.buildParseTree = true;
    let idCounter = 0;
    const stack = new ParseStack();
    stack.push(0, new PTNode(idCounter++, this.grammar.augStartRule.nt, null));
    const tokenbuffer = this.tokenbuffer;
    const g = this.grammar;
    let output: Nullable<PTNode> = null;

    /**
     * Pick an action among several actions based on several factors (eg
     * curr parse stack, tokenbuffer etc).
     */
    function resolveActions(actions: LRAction[]): LRAction {
      if (context?.actionResolver) {
        return context.actionResolver(actions, stack, tokenbuffer);
      } else {
        if (actions.length > 1) {
          throw new Error("Multiple actions found.");
        }
        return actions[0];
      }
    }

    while (tokenbuffer.peek(input) != null || !stack.isEmpty) {
      let token = tokenbuffer.peek(input);
      if (token && context.onNextToken) token = context.onNextToken(token);
      const nextSym = token == null ? g.Eof : this.getSym(token);
      const nextValue = token == null ? null : token.value;
      let [topState, topNode] = stack.top();
      const actions = this.parseTable.getActions(topState, nextSym);
      if (actions == null || actions.length == 0) {
        // TODO - use a error handler here
        throw new TLEX.ParseError(
          token?.start || 0,
          `Unexpected token at state (${topState}): ${token?.tag} ('${nextSym.label}')`,
        );
      }

      const action = resolveActions(actions);
      if (action.tag == LRActionType.ACCEPT) {
        break;
      } else if (action.tag == LRActionType.SHIFT) {
        tokenbuffer.next(input);
        const newNode = new PTNode(idCounter++, nextSym, nextValue);
        stack.push(action.gotoState!, newNode);
      } else {
        // reduce
        TSU.assert(action.rule != null, "Nonterm and ruleindex must be provided for a reduction action");
        const ruleLen = action.rule.rhs.length;

        // here see if a rule handler exists - if it does use it
        let newNode = new PTNode(idCounter++, action.rule.nt, null);
        // Begin the reduction here. We are breaking the reduction into
        // two parts:
        //
        // 1. Adding child nodes into the parent (reduced) node. Here
        // the beforeAddingChildNode callback is used to modify children
        // being added.
        // 2. After all children have been added to give the caller a chance
        // to handle/post-process the reduction - eg to build the semantic value.
        //
        // Our onReduction is a catch all to perform semantic actions.  Instead
        // we could do rule specific ones by using the rule.action (if it exists)
        // and only invoke the onReduction if a rule specific action does not exist.
        //
        // Are these "double steps" needed?  Can we just build parse tree, filter out
        // child nodes and eval semantic value with a single action?
        //
        // Can semanticHandler do this?
        //
        // eg with
        //
        // E -> E + E { add }
        //
        // we could have our stack looking like;
        //
        // .... s1 E s2 E
        //
        // to be reduced and add could be called with:
        //
        // add(E1, E2) - as the child nodes themselves.
        //
        // the add handler could now do a few things:
        //
        // 1. Ensure all nodes are added to E as is (resulting in 3 nodes - "E", "+", "E")
        // 2. Not add any nodes
        // 3. Computing the value of E and E and the sum of those and put it in the parent E.
        // 4. or all of the above.
        //
        // Doing filtering seems like a very premature usecase.  In the case of incremental
        // parsing we may need all nodes to exist and filtering out can get in the way of that.
        //
        // But let us leave it for now and make any semantic handling happen *after* parse tree
        // child node filter/transformation
        if (context.buildParseTree) {
          for (let i = ruleLen - 1; i >= 0; i--) {
            const childNode: TSU.Nullable<PTNode> = stack.top(i)[1];
            if (context.beforeAddingChildNode) {
              for (const node of context.beforeAddingChildNode(newNode, childNode)) {
                newNode.add(node);
              }
            } else if (childNode != null) {
              newNode.add(childNode);
            }
          }
        }
        // Now apply the semantic handler if it exists
        if (action.rule.action) {
          // call it
          if (action.rule.action.isFunction) {
            // find the function associated with
            const handlerName = action.rule.action.value;
            const handler = context.semanticHandler![handlerName];
            if (!handler) throw new Error("Action handler not found: " + handlerName);
            // TODO - Replace the handler signature to take an
            // interface that returns the nth child node (directly from
            // the parse stack) instead of all children - this way we
            // can even avoid building a parse tree if need be and
            // decouple semantic actions from parse tree building
            newNode.value = handler(action.rule, newNode, ...newNode.children);
          } else {
            // setting value as a child's value, eg $1, $2 etc
            newNode.value = newNode.children[(action.rule.action.value as number) - 1].value;
          }
        } else if (context.onReduction) {
          // fallback to default reduction handler
          newNode = context.onReduction(newNode, action.rule);
        } else if (newNode.children.length == 1 && context.copySingleChild) {
          // If we have only 1 child set the semantic value to be child's value
          // ie values "bubble up"
          newNode.value = newNode.children[0].value;
        }

        // Perform the action reduction by popping ruleLen number of items off the stack
        // and replace the top with our newNode
        stack.popN(ruleLen);
        [topState, topNode] = stack.top();
        const newAction = resolveActions(this.parseTable.getActions(topState, action.rule.nt));
        TSU.assert(newAction != null && newAction.gotoState != null, "Top item does not have an action.");
        stack.push(newAction.gotoState, newNode);
        output = newNode;
      }
    }
    // It is possible that here no reductions have been done!
    return output;
  }
}
