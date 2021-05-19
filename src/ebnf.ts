import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { Sym, Grammar, Str } from "./grammar";

type Tape = TLEX.Tape;

const str2regex = (s: string): string => {
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
  OPEN_PAREN = "OPEN_PAREN",
  CLOSE_PAREN = "CLOSE_PAREN",
  OPEN_BRACE = "OPEN_BRACE",
  CLOSE_BRACE = "CLOSE_BRACE",
  OPEN_SQ = "OPEN_SQ",
  CLOSE_SQ = "CLOSE_SQ",
  COMMENT = "COMMENT",
  ARROW = "ARROW",
  SEMI_COLON = "SEMI_COLON",
}

export function EBNFTokenizer(): TLEX.Tokenizer {
  const lexer = new TLEX.Tokenizer();
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
  lexer.add(/\|/, { tag: TokenType.PIPE });
  lexer.add(/\s+/m, { tag: TokenType.SPACES }, () => null);
  lexer.add(/\/\*.*?\*\//, { tag: TokenType.COMMENT }, () => null);
  lexer.add(/\/\/.*$/, { tag: TokenType.COMMENT }, () => null);
  lexer.add(/"(.*?(?<!\\))"/, { tag: TokenType.STRING }, (rule, tape, token) => {
    token.value = tape.substring(token.start + 1, token.end - 1);
    return token;
  });
  lexer.add(/'(.*?(?<!\\))'/, { tag: TokenType.STRING }, (rule, tape, token) => {
    token.value = tape.substring(token.start + 1, token.end - 1);
    return token;
  });
  lexer.add(/\/(.*?(?<!\\))\//, { tag: TokenType.REGEX }, (rule, tape, token) => {
    token.value = tape.substring(token.start + 1, token.end - 1);
    return token;
  });
  lexer.add(/->/, { tag: TokenType.ARROW });
  lexer.add(/\d+/, { tag: TokenType.NUMBER });
  lexer.add(/%([\w][\w\d_]*)/, { tag: TokenType.PCT_IDENT }, (rule, tape, token) => {
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
 * rule -> IDENT "->" productions ";" ;
 *
 * productions -> prod  ( | prod ) *
 *            |
 *            ;
 *
 * prod -> ( prod_group | optional_prod | IDENT | STRING ) ( "*" | "+" | "?" ) ?
 *      ;
 *
 * prod_group -> "(" productions ")"  ;
 *
 * optional_prod -> "(" productions ")"  ;
 */
export class EBNFParser {
  readonly grammar: Grammar;
  private tokenizer: TLEX.TokenBuffer;
  private leftRecursive = false;
  readonly generatedTokenizer: TLEX.Tokenizer = new TLEX.Tokenizer();

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
  private newSymbolCallback: TSU.Nullable<(label: string, assumedTerminal: boolean) => Sym | void>;
  private symbolsByLabel: TSU.StringMap<Sym>;

  constructor(input: string, config: any = {}) {
    this.symbolsByLabel = {};
    this.grammar = config.grammar || new Grammar();
    this.leftRecursive = "leftRecursive" in config ? config.leftRecursive : true;
    this.newSymbolCallback = config.newSymbol || null;
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
    const et = EBNFTokenizer();
    const ntFunc = (tape: Tape) => {
      const out = et.next(tape);
      return out;
    };
    this.tokenizer = new TLEX.TokenBuffer(ntFunc);
    this.parseGrammar(new TLEX.Tape(input));
  }

  parseGrammar(tape: TLEX.Tape): void {
    let peeked = this.tokenizer.peek(tape);
    while (peeked != null) {
      if (peeked.tag == TokenType.IDENT) {
        // declaration
        this.parseDecl(tape);
      } else if (peeked.tag == TokenType.PCT_IDENT) {
        // Some kind of directive
        this.tokenizer.next(tape);
        if (peeked.value == "skip") {
          const next = this.tokenizer.expectToken(tape, TokenType.STRING, TokenType.REGEX);
          const pattern = next.tag == TokenType.STRING ? str2regex(next.value) : next.value;
          const label = "/" + next.value + "/";
          const rule = new TLEX.Rule(pattern, { tag: label, priority: 30 });
          this.generatedTokenizer.addRule(rule, () => null);
        } else if (peeked.value == "token") {
          const tokName = this.tokenizer.expectToken(tape, TokenType.IDENT);
          const tokPattern = this.tokenizer.expectToken(tape, TokenType.STRING, TokenType.REGEX);
          let rule: TLEX.Rule;
          if (tokPattern.tag == TokenType.STRING || tokPattern.tag == TokenType.NUMBER) {
            const pattern = str2regex(tokPattern.value);
            rule = new TLEX.Rule(pattern, { tag: tokName.value, priority: 20 });
          } else if (tokPattern.tag == TokenType.REGEX) {
            rule = new TLEX.Rule(tokPattern.value, { tag: tokName.value, priority: 10 });
          } else {
            throw new TLEX.UnexpectedTokenError(tokPattern);
          }
          this.generatedTokenizer.addRule(rule);
          // register it
          this.ensureSymbol(tokName.value, true);
        } else {
          throw new Error("Invalid directive: " + peeked.value);
        }
      }
      peeked = this.tokenizer.peek(tape);
    }
  }

  parseDecl(tape: Tape): void {
    const ident = this.tokenizer.expectToken(tape, TokenType.IDENT);
    if (this.tokenizer.consumeIf(tape, TokenType.ARROW)) {
      const nt = this.ensureSymbol(ident.value as string, false);
      if (nt.isTerminal) {
        // it is a terminal so mark it as a non-term now that we
        // know there is a declaration for it.
        nt.isTerminal = false;
      } else if (nt.isAuxiliary) {
        throw new Error("NT is already auxiliary and cannot be reused.");
      }
      for (const rule of this.parseProductions(tape, this.grammar, nt)) {
        this.grammar.add(nt, rule);
      }
      this.tokenizer.expectToken(tape, TokenType.SEMI_COLON);
    }
  }

  parseProductions(tape: Tape, grammar: Grammar, nt: TSU.Nullable<Sym>): Str[] {
    const out: Str[] = [];
    while (this.tokenizer.peek(tape) != null) {
      const rule = this.parseProd(tape, grammar);
      if (rule) out.push(rule);
      if (this.tokenizer.consumeIf(tape, TokenType.PIPE)) {
        continue;
      } else if (this.tokenizer.nextMatches(tape, TokenType.CLOSE_SQ, TokenType.CLOSE_PAREN, TokenType.SEMI_COLON)) {
        break;
      }
    }
    return out;
  }

  parseProd(tape: Tape, grammar: Grammar): Str {
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
        )
      ) {
        return out;
      }
      let curr: TSU.Nullable<Str> = null;
      if (this.tokenizer.consumeIf(tape, TokenType.OPEN_PAREN)) {
        const rules = this.parseProductions(tape, grammar, null);
        if (rules.length == 0) {
          // nothing
        } else if (rules.length == 1) {
          curr = rules[0];
        } else {
          // create a new NT over this
          curr = grammar.anyof(...rules);
        }
        this.tokenizer.expectToken(tape, TokenType.CLOSE_PAREN);
      } else if (this.tokenizer.consumeIf(tape, TokenType.OPEN_SQ)) {
        const rules = this.parseProductions(tape, grammar, null);
        if (rules.length == 0) {
          // nothing
        } else if (rules.length == 1) {
          curr = grammar.opt(rules[0]);
        } else {
          // create a new NT over this
          curr = grammar.opt(grammar.anyof(...rules));
        }
        this.tokenizer.expectToken(tape, TokenType.CLOSE_SQ);
      } else if (
        this.tokenizer.nextMatches(tape, TokenType.IDENT, TokenType.STRING, TokenType.NUMBER, TokenType.REGEX)
      ) {
        const token = this.tokenizer.next(tape) as TLEX.Token;
        let label = token.value as string;
        if (token.tag == TokenType.STRING || token.tag == TokenType.NUMBER) {
          label = '"' + token.value + '"';
          const pattern = str2regex(token.value);
          const rule = new TLEX.Rule(pattern, { tag: label, priority: 20 });
          this.generatedTokenizer.addRule(rule);
        } else if (token.tag == TokenType.REGEX) {
          label = "/" + token.value + "/";
          const rule = new TLEX.Rule(token.value, { tag: label, priority: 10 });
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
    return out;
  }
}
