import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { Sym, Grammar, Str, Rule, RuleAction } from "./grammar";

type Tape = TLEX.Tape;

const str2regex = (s: string | number): string => {
  if (typeof s === "number") return "" + s;
  return s.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
};

export enum TokenType {
  STRING = "STRING",
  REGEX = "REGEX",
  NUMBER = "NUMBER",
  SPACES = "SPACES",
  IDENT = "IDENT",
  PCT_IDENT = "PCT_IDENT",
  STAR = "STAR",
  PLUS = "PLUS",
  QMARK = "QMARK",
  PIPE = "PIPE",
  DOLLAR_NUM = "DOLLAR_NUM",
  DOLLAR_IDENT = "DOLLAR_IDENT",
  OPEN_PAREN = "OPEN_PAREN",
  CLOSE_PAREN = "CLOSE_PAREN",
  OPEN_BRACE = "OPEN_BRACE",
  CLOSE_BRACE = "CLOSE_BRACE",
  OPEN_SQ = "OPEN_SQ",
  CLOSE_SQ = "CLOSE_SQ",
  COMMENT = "COMMENT",
  ARROW = "ARROW",
  COLCOLHYPHEN = "COLCOLHYPHEN",
  COLON = "COLON",
  SEMI_COLON = "SEMI_COLON",
}

export type NewSymbolCallback = TSU.Nullable<(label: string, assumedTerminal: boolean) => Sym | void>;
export type TokenHandler = (token: TLEX.Token, tape: TLEX.Tape, owner: any) => TLEX.Token;

export interface LoaderConfig {
  grammar?: Grammar;
  leftRecursive?: boolean;
  newSymbolCallback?: NewSymbolCallback;
  tokenHandlers: TSU.StringMap<TokenHandler>;
  debug?: string;
}

/**
 * Entry point in loading a grammar from a DSL spec.
 */
export function load(input: string, params?: LoaderConfig): [Grammar, null | TLEX.NextTokenFunc] {
  params = params || ({} as LoaderConfig);
  const g = new Grammar(params.grammar || {});
  const eparser = new Loader(input, { ...params, grammar: g });
  // g.augmentStartSymbol();
  const tokenFunc = eparser.generatedTokenizer.next.bind(eparser.generatedTokenizer);
  const debug = params.debug || "";
  if (debug.split("|").findIndex((p: string) => p == "all" || p == "lexer") >= 0) {
    console.log("Prog: \n", `${eparser.generatedTokenizer.vm.prog.debugValue().join("\n")}`);
  }
  return [g, tokenFunc];
}

/**
 * The SemanticHandler is the bridge between the DSL, the Grammar, the Parser
 * and the caller of the parser.
 * In the DSL semantic actions can be added to tokenizer and grammar specs.
 * However the problem how to invoke them during runtime.
 *
 * For example in the grammar:
 *
 * E -> E + E { add($1, $3) }
 *
 * declares that when this rule is reduced the "add" function (in user land) is
 * invoked with the results of the right hand side values.
 *
 * This parsing however is done by the DSL loader and at this time the "add" method
 * is not declared anywhere.   In fact the the declaration is only  used by the parser
 * driver (after the parse tables have been constructed and parsing is started on
 * a real input).   The parser here needs to supply the definition for "add" method.
 * Note only this only the parser can call what is needed to kick off the "add" method
 * to be invoked.
 *
 * So the parser will need something like:
 *
 * while (input) {
 *    ....
 *    reduceRule(Nt, E1, E2, E3 ..., "action")
 * }
 *
 * the "action" will be part of the SemanticHandler
 *
 * reduceRule(Nt...., "action") {
 *  Nt.value = semanticHandler.getAction("action").apply(E1, E2...., En);
 * }
 *
 * Similarly the caller of the "parse" method could populate the actions, eg:
 *
 * semanticHandler.register("action", (a, b, c) => {
 *    return ....;
 * });
 *
 * The DSL loader in turn returns a semanticHandler instance just the way it
 * creates a tokenizer.
 *
 * There are a couple of options here.
 *
 * 1. Keep actions simple and store action IDs and let the caller do all the work, eg:
 *
 * E -> E + E { add $1 $3 }
 *
 * 2. Provide a stronger expression syntax:
 *
 * Or we could add a slightly more functional syntax so that a proper interpreter like setup is possible, eg:
 *
 * E -> E + E { add(halve($1), double($3)) }
 *
 * Here instead of calling an action "add" we could actually store expression trees and call an interpreter
 * with attribute value bindings.
 *
 * For now we will go with (1) as it is simpler and we can always build up (2) if doing (1) alone is too verbose.
 *
 * With (1), syntax for semantic actions is:
 *
 *  SemAction -> "{" ActionSpec "}" ;
 *
 *  ActionSpec -> DOLLAR_NUM
 *              | IDENT ( IDENT | DOLLAR_NUM | NUM | STRING | BOOLEAN | NULL ) *
 *              ;
 *
 * 3. There is an evern simpler third option.  Instead of the parser trying to martial parameters etc it could just
 * let the handler do the work of martialling/extracting parameters from children.  This is effective and easy
 *
 * In this mode all child nodes are passed as is to the handler and it is upto the handler to return the semantic
 * value of the production.
 */

export function Tokenizer(): TLEX.Tokenizer {
  const lexer = new TLEX.Tokenizer();
  lexer.add(/->/, { tag: TokenType.ARROW });
  lexer.add(/\[/, { tag: TokenType.OPEN_SQ });
  lexer.add(/\]/, { tag: TokenType.CLOSE_SQ });
  lexer.add(/\(/, { tag: TokenType.OPEN_PAREN });
  lexer.add(/\)/, { tag: TokenType.CLOSE_PAREN });
  lexer.add(/\{/, { tag: TokenType.OPEN_BRACE });
  lexer.add(/\}/, { tag: TokenType.CLOSE_BRACE });
  lexer.add(/\*/, { tag: TokenType.STAR });
  lexer.add(/\+/, { tag: TokenType.PLUS });
  lexer.add(/\?/, { tag: TokenType.QMARK });
  lexer.add(/;/, { tag: TokenType.SEMI_COLON });
  lexer.add(/:/, { tag: TokenType.COLON });
  lexer.add(/\|/, { tag: TokenType.PIPE });
  lexer.add(/\s+/m, { tag: TokenType.SPACES }, () => null);
  lexer.add(/\/\*.*?\*\//s, { tag: TokenType.COMMENT }, () => null);
  lexer.add(/\/\/.*$/m, { tag: TokenType.COMMENT }, () => null);
  lexer.add(TLEX.Samples.DOUBLE_QUOTE_STRING, { tag: TokenType.STRING }, (rule, tape, token) => {
    token.value = tape.substring(token.start + 1, token.end - 1);
    return token;
  });
  lexer.add(TLEX.Samples.SINGLE_QUOTE_STRING, { tag: TokenType.STRING }, (rule, tape, token) => {
    token.value = tape.substring(token.start + 1, token.end - 1);
    return token;
  });
  lexer.add(TLEX.Samples.JS_REGEX, { tag: TokenType.REGEX }, (rule, tape, token) => {
    const pattern = tape.substring(token.positions[1][0], token.positions[1][1]);
    const flags = tape.substring(token.positions[3][0], token.positions[3][1]);
    token.value = [pattern, flags];
    return token;
  });
  lexer.add(/\d+/, { tag: TokenType.NUMBER }, (rule, tape, token) => {
    token.value = parseInt(tape.substring(token.start, token.end));
    return token;
  });
  lexer.add(/%([\w][\w\d_]*)/, { tag: TokenType.PCT_IDENT }, (rule, tape, token) => {
    token.value = tape.substring(token.start + 1, token.end);
    return token;
  });
  lexer.add(/\$\d+/, { tag: TokenType.DOLLAR_NUM }, (rule, tape, token) => {
    token.value = parseInt(tape.substring(token.start + 1, token.end));
    return token;
  });
  lexer.add(/\$([\w][\w\d_]*)/, { tag: TokenType.DOLLAR_IDENT }, (rule, tape, token) => {
    token.value = tape.substring(token.start + 1, token.end);
    return token;
  });
  lexer.add(/[\w][\w\d_]*/, { tag: TokenType.IDENT });
  return lexer;
}

export enum NodeType {
  GRAMMAR = "GRAMMAR",
  DECL = "DECL",
  RULE = "RULE",
  PROD_NULL = "PROD_NULL",
  PROD_STR = "PROD_STR",
  PROD_UNION = "PROD_UNION",
  PROD_NAME = "PROD_NAME",
  PROD_STRING = "PROD_STRING",
  PROD_NUM = "PROD_NUM",
  PROD_IDENT = "PROD_IDENT",
  PROD_STAR = "PROD_STAR",
  PROD_PLUS = "PROD_PLUS",
  PROD_OPTIONAL = "PROD_OPTIONAL",
  IDENT = "IDENT",
  ERROR = "ERROR",
  COMMENT = "COMMENT",
}

/**
 * EBNF Grammar:
 *
 * grammar -> rules;
 *
 * decl -> rule ;
 *
 * rules -> rule | rule rules ;
 *
 * rule -> IDENT "->" top_productions ";" ;
 *
 * top_productions -> ( actionSpec ) ?
 *                |   prod ( actionSpec ) ? top_productions
 *                ;
 *
 * productions ->
 *              | prod  "|" productions
 *              ;
 *
 * prod -> ( prod_group | optional_prod | IDENT ( ":" name ) ? | STRING ) ( "*" | "+" | "?" ) ?
 *      ;
 *
 * prod_group -> "(" productions ")"  ;
 *
 * optional_prod -> "[" productions "]"  ;
 *
 * actionSpec := "{" IDENT "(" IDENT ( "," IDENT ) * ")" "}"
 */
export class Loader {
  readonly grammar: Grammar;
  private tokenizer: TLEX.TokenBuffer;
  private leftRecursive = false;
  readonly generatedTokenizer: TLEX.Tokenizer = new TLEX.Tokenizer();
  tokenHandlers: TSU.StringMap<TokenHandler>;

  /*
   * The newSymbol callback provided to the contructor is a way for the client to
   * be given a chance to create a symbol given a new label that is encountered.
   * The client can either return a null to let this parser define the Symbol
   * or return a Symbol which will be associated with the given label going
   * forward.
   *
   * The newSymbol callback will ONLY be called once for each new label
   * encountered by the parser.   If the client returns a duplicte symbol
   * then parsing fails.
   */
  private newSymbolCallback: NewSymbolCallback;
  private symbolsByLabel: TSU.StringMap<Sym>;

  /**
   * Allowed regex syntaxes - js or flex
   */
  private regexSyntax = "js";

  constructor(input: string, config?: LoaderConfig) {
    config = config || ({} as LoaderConfig);
    this.symbolsByLabel = {};
    this.grammar = config.grammar || new Grammar();
    this.leftRecursive = "leftRecursive" in config ? config.leftRecursive || false : true;
    this.newSymbolCallback = config.newSymbolCallback || null;
    this.tokenHandlers = config.tokenHandlers || {};
    this.parse(input);
  }

  /**
   * As the parser creates encounters a new literal or an identifier (hinting at
   * either a terminal or a non terminal), it needs to know which symbol to associate
   * with this lit/ident going forward.
   *
   * All symbols created for the grammar, since they are either created
   * by this parser or by the client (invokved by this parser), are
   * stored locally to be returned in this method.
   */
  symbolForLabel(label: string): TSU.Nullable<Sym> {
    return this.symbolsByLabel[label] || null;
  }

  /**
   * Registers a symbol for a given label.
   */
  registerSymbol(label: string, sym: Sym): void {
    TSU.assert(!(label in this.symbolsByLabel), `${label} is already registered`);
    this.symbolsByLabel[label] = sym;
  }

  /**
   * Ensures that a symbol exists for a given label (as found in the parser spec)
   * to be used through out the grammar.
   */
  ensureSymbol(label: string, assumedTerminal: boolean): Sym {
    let currSym = this.symbolForLabel(label);

    if (currSym != null) return currSym;
    else if (this.newSymbolCallback) {
      // then give the user a chance to create a symbol for this
      currSym = this.newSymbolCallback(label, assumedTerminal) || null;
    }
    if (currSym == null) {
      if (assumedTerminal) {
        currSym = this.grammar.newTerm(label);
      } else {
        currSym = this.grammar.newNT(label);
      }
    }
    // then register it so it is used going forward
    this.registerSymbol(label, currSym);
    return currSym;
  }

  parse(input: string): void {
    const et = Tokenizer();
    const ntFunc = (tape: Tape) => {
      const out = et.next(tape, this);
      return out;
    };
    this.tokenizer = new TLEX.TokenBuffer(ntFunc, this);
    this.parseGrammar(new TLEX.Tape(input));
  }

  parseRegex(tape: TLEX.Tape, tag?: string, priority = 0, syntax = ""): TLEX.Rule {
    if (syntax == "") syntax = this.regexSyntax;
    if (syntax == "js") {
      const tokPattern = this.tokenizer.expectToken(tape, TokenType.STRING, TokenType.NUMBER, TokenType.REGEX);
      let rule: TLEX.Rule;
      if (!tag || tag.length == 0) {
        tag = "/" + tokPattern.value[0] + "/" + tokPattern.value[1];
      }
      if (tokPattern.tag == TokenType.STRING || tokPattern.tag == TokenType.NUMBER) {
        const pattern = str2regex(tokPattern.value);
        rule = TLEX.Builder.build(pattern, { tag: tag, priority: priority + 20 });
      } else if (tokPattern.tag == TokenType.REGEX) {
        let re = tokPattern.value[0];
        if (tokPattern.value[1].length > 0) {
          // Flags given so create
          re = new RegExp(tokPattern.value[0], tokPattern.value[1]);
          console.log("RegExp, flags: ", re, re.flags);
        }
        rule = TLEX.Builder.build(re, { tag: tag, priority: priority + 10 });
      } else {
        throw new TLEX.UnexpectedTokenError(tokPattern);
      }
      return rule;
    } else {
      // Flex style RE - no delimiters - just read until end of line and strip spaces
      let patternStr = "";
      while (tape.hasMore && tape.currCh != "\n") {
        patternStr += tape.currCh;
        tape.advance();
      }
      patternStr = patternStr.trim();
      if (!tag || tag.length == 0) {
        tag = "/" + patternStr + "/";
      }
      return new TLEX.Rule(TLEX.Builder.exprFromFlexRE(patternStr), { tag: tag, priority: priority });
    }
  }

  parseGrammar(tape: TLEX.Tape): void {
    let peeked = this.tokenizer.peek(tape);
    while (peeked != null) {
      if (peeked.tag == TokenType.IDENT) {
        // declaration
        this.parseDecl(tape);
      } else if (peeked.tag == TokenType.PCT_IDENT) {
        this.tokenizer.next(tape);
        this.parseDirective(tape, peeked.value);
      } else {
        throw new SyntaxError(`Declaration must start with IDENT or PCT_IDENT.  Found: '${peeked.value}' instead.`);
      }
      peeked = this.tokenizer.peek(tape);
    }
  }

  parseDirective(tape: Tape, directive: string): void {
    if (directive == "start") {
      // override start directive
      const next = this.tokenizer.expectToken(tape, TokenType.IDENT);
      this.grammar.startSymbol = this.ensureSymbol(next.value as string, false);
    } else if (directive == "resyntax") {
      // override start directive
      const next = this.tokenizer.expectToken(tape, TokenType.IDENT);
      if (next.value != "js" && next.value != "flex") {
        throw new SyntaxError("Invalid regex syntax: " + next.value);
      }
      this.regexSyntax = next.value;
    } else if (directive.startsWith("skip")) {
      const rule = this.parseRegex(tape, "", 30, directive.endsWith("flex") ? "flex" : "");
      const tokenHandler = this.parseTokenHandler(tape);
      if (tokenHandler) {
        this.generatedTokenizer.addRule(rule, (rule, tape, token) => {
          tokenHandler(rule, tape, token, this);
          return null;
        });
      } else {
        this.generatedTokenizer.addRule(rule, () => null);
      }
    } else if (directive.startsWith("token") || directive.startsWith("define")) {
      const isDef = directive.startsWith("define");
      const tokName = this.tokenizer.expectToken(tape, TokenType.IDENT, TokenType.STRING);
      let label = tokName.value as string;
      if (tokName.tag == TokenType.STRING || tokName.tag == TokenType.NUMBER) {
        label = `"${tokName.value}"`;
      }
      const rule = this.parseRegex(tape, label, 0, directive.endsWith("flex") ? "flex" : "");
      if (isDef) {
        // Define a "reusable" regex that is not a token on its own
        this.generatedTokenizer.addVar(label, rule.expr);
      } else {
        const tokenHandler = this.parseTokenHandler(tape);
        // see if we have a handler function here
        this.generatedTokenizer.addRule(rule, tokenHandler);
        // register it
        this.ensureSymbol(label, true);
      }
    } else {
      throw new Error("Invalid directive: " + directive);
    }
  }

  parseTokenHandler(tape: Tape): TLEX.RuleMatchHandler | null {
    if (!this.tokenizer.consumeIf(tape, TokenType.OPEN_BRACE)) {
      return null;
    }

    const funcName = this.tokenizer.expectToken(tape, TokenType.IDENT);

    // how do we use the funcName to
    const out = (rule: TLEX.Rule, tape: Tape, token: any, owner: any) => {
      const handler = this.tokenHandlers[funcName.value];
      if (!handler) throw new Error("Handler method not found: " + funcName.value);
      token = handler(token, tape, owner);
      return token;
    };

    this.tokenizer.expectToken(tape, TokenType.CLOSE_BRACE);
    return out;
  }

  parseDecl(tape: Tape): void {
    const ident = this.tokenizer.expectToken(tape, TokenType.IDENT);
    if (this.tokenizer.consumeIf(tape, TokenType.ARROW, TokenType.COLON)) {
      const nt = this.ensureSymbol(ident.value as string, false);
      if (nt.isTerminal) {
        // it is a terminal so mark it as a non-term now that we
        // know there is a declaration for it.
        nt.isTerminal = false;
      } else if (nt.isAuxiliary) {
        throw new Error("NT is already auxiliary and cannot be reused.");
      }
      for (const [rhs, action] of this.parseProductions(tape, this.grammar, nt)) {
        const rule = this.grammar.add(nt, rhs, action);
      }
      this.tokenizer.expectToken(tape, TokenType.SEMI_COLON);
    }
  }

  parseProductions(tape: Tape, grammar: Grammar, nt: TSU.Nullable<Sym>): [Str, RuleAction | null][] {
    const out: [Str, RuleAction | null][] = [];
    while (this.tokenizer.peek(tape) != null) {
      const rule = this.parseProd(tape, grammar);
      out.push(rule);
      if (this.tokenizer.consumeIf(tape, TokenType.PIPE)) {
        continue;
      } else if (this.tokenizer.nextMatches(tape, TokenType.CLOSE_SQ, TokenType.CLOSE_PAREN, TokenType.SEMI_COLON)) {
        break;
      }
    }
    return out;
  }

  parseProd(tape: Tape, grammar: Grammar): [Str, null | RuleAction] {
    const out = new Str();
    while (true) {
      // if we are starting with a FOLLOW symbol then return as it marks
      // the end of this production
      if (
        this.tokenizer.nextMatches(
          tape,
          TokenType.CLOSE_PAREN,
          TokenType.CLOSE_SQ,
          TokenType.SEMI_COLON,
          TokenType.PIPE,
          TokenType.OPEN_BRACE,
        )
      ) {
        break;
        // return [out, null];
      }

      let curr: TSU.Nullable<Str> = null;
      if (this.tokenizer.consumeIf(tape, TokenType.OPEN_PAREN)) {
        const rules = this.parseProductions(tape, grammar, null);
        if (rules.length == 0) {
          // nothing
        } else if (rules.length == 1) {
          // TODO: Consider actions in non top level rules
          curr = rules[0][0];
        } else {
          // create a new NT over this
          // TODO: Consider actions in non top level rules
          curr = grammar.anyof(...rules.map((r) => r[0]));
        }
        this.tokenizer.expectToken(tape, TokenType.CLOSE_PAREN);
      } else if (this.tokenizer.consumeIf(tape, TokenType.OPEN_SQ)) {
        const rules = this.parseProductions(tape, grammar, null);
        if (rules.length == 0) {
          // nothing
        } else if (rules.length == 1) {
          // TODO: Consider actions in non top level rules
          curr = grammar.opt(rules[0][0]);
        } else {
          // create a new NT over this
          // TODO: Consider actions in non top level rules
          curr = grammar.opt(grammar.anyof(...rules.map((r) => r[0])));
        }
        this.tokenizer.expectToken(tape, TokenType.CLOSE_SQ);
      } else if (
        this.tokenizer.nextMatches(tape, TokenType.IDENT, TokenType.STRING, TokenType.NUMBER, TokenType.REGEX)
      ) {
        const token = this.tokenizer.next(tape) as TLEX.Token;
        let label = token.value as string;
        if (token.tag == TokenType.STRING || token.tag == TokenType.NUMBER) {
          label = `"${token.value}"`;
          const pattern = str2regex(token.value);
          const rule = TLEX.Builder.build(pattern, { tag: label, priority: 20 });
          this.generatedTokenizer.addRule(rule);
        } else if (token.tag == TokenType.REGEX) {
          label = "/" + token.value[0] + "/" + token.value[1];
          let re = token.value[0];
          if (token.value[1].length > 0) {
            // Flags given so create
            re = new RegExp(token.value[0], token.value[1]);
            console.log("RegExp, flags: ", re, re.flags);
          }
          const rule = TLEX.Builder.build(re, { tag: label, priority: 10 });
          this.generatedTokenizer.addRule(rule);
        } else {
          // Normal
        }
        // See if this symbol is already registered
        const currSym = this.ensureSymbol(label, true);
        curr = new Str(currSym);
      } else {
        throw new TLEX.UnexpectedTokenError(this.tokenizer.peek(tape));
      }

      if (curr == null) {
        throw new Error("Could not determine node");
      }

      if (this.tokenizer.consumeIf(tape, TokenType.STAR)) {
        curr = grammar.atleast0(curr, this.leftRecursive);
      } else if (this.tokenizer.consumeIf(tape, TokenType.PLUS)) {
        curr = grammar.atleast1(curr, this.leftRecursive);
      } else if (this.tokenizer.consumeIf(tape, TokenType.QMARK)) {
        curr = grammar.opt(curr);
      }
      out.extend(curr);
    }
    let action: RuleAction | null = null;
    if (this.tokenizer.consumeIf(tape, TokenType.OPEN_BRACE)) {
      const next = this.tokenizer.expectToken(tape, TokenType.DOLLAR_NUM, TokenType.IDENT);
      action = new RuleAction(next.value);
      this.tokenizer.expectToken(tape, TokenType.CLOSE_BRACE);
    }
    return [out, action];
  }
}
