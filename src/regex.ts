import * as TSU from "@panyam/tsutils";
import { OpCode, Prog, Instr } from "./pikevm";

export enum ExprType {
  ANY,
  START_OF_INPUT,
  END_OF_INPUT,
  CHAR,
  CHAR_CLASS,
  UNION,
  CAT,
  NEG,
  REF,
  QUANT,
  ASSERTION,
}

/**
 * A regex machine allows a collection of regexes to be parsed, maintained
 * and referenced.  The builders parses regex strings and creates normalized
 * versions of these (along with IDs) for them.
 *
 * These regexes can then be passed to a tokenizer so that it can use them
 * to match an input stream to create tokens.
 */
class Lexer {
  // Stores named rules
  literals: [string, any, Expr][] = [];
  regexes: [string, any, Expr][] = [];
  rulesByName = {} as any;

  addLiteral(lit: string, tokType: any): number {
    const index = this.literals.findIndex((k) => k[0] == lit);
    if (index < 0) {
      this.literals.push([lit, tokType, parse(lit)]);
      return this.literals.length - 1;
    } else {
      if (this.literals[index][1] != tokType) {
        throw new Error(`Literal '${lit}' already registered as ${tokType}`);
      }
      return index;
    }
  }

  /**
   * Adds a new regex to our builder.
   */
  addRegex(regex: string, tokType: any): number {
    let index = this.regexes.findIndex((k) => k[0] == regex);
    if (index < 0) {
      index = this.regexes.length;
      this.regexes.push([regex, tokType, parse(regex)]);
    } else if (this.regexes[index][1] != tokType) {
      throw new Error(`Regex '${regex}' already registered as ${tokType}`);
    }
    return index;
  }

  /**
   * Compiles the regex and stores the specific
   */
  protected compileAll(): Prog {
    // Keep regexes and their priority - literals have higher priority
    const exprs: [Expr, number][] = [];
    this.literals.forEach((lit) => {
      exprs.push([lit[2], 20]);
    });
    this.regexes.forEach((r) => {
      exprs.push([r[2], 20]);
    });

    // Split across each of our expressions
    const out = new Prog();
    const split = out.add(OpCode.Split);
    exprs.forEach(([expr, priority], i) => {
      split.add(out.instrs.length);
      out.add(OpCode.Save, 0);
      this.compile(expr, out);
      out.add(OpCode.Save, 1);
      out.add(OpCode.Match, i, priority);
    });
    // Add the error case to match -1 if nothing else matches
    // should technically never come here if atleast one rule matches
    out.add(OpCode.Save, 0);
    this.compile(new Any(), out);
    out.add(OpCode.Save, 1);
    out.add(OpCode.Match, -1, 0);
    return out;
  }

  /**
   * Compile a given expression into a set of instructions.
   */
  compile(expr: Expr, prog: Prog): number {
    const start = prog.length;
    if (expr.tag == ExprType.CHAR) {
      const char = expr as Char;
      prog.add(OpCode.Char, char.start, char.end);
    } else if (expr.tag == ExprType.CHAR_CLASS) {
      const instr = prog.add(OpCode.CharClass);
      for (const char of (expr as CharClass).chars) {
        instr.add(char.start, char.end);
      }
    } else if (expr.tag == ExprType.START_OF_INPUT) {
      prog.add(OpCode.StartOfInput);
    } else if (expr.tag == ExprType.END_OF_INPUT) {
      prog.add(OpCode.EndOfInput);
    } else if (expr.tag == ExprType.ANY) {
      prog.add(OpCode.Any);
    } else if (expr.tag == ExprType.CAT) {
      this.compileCat(expr as Cat, prog);
    } else if (expr.tag == ExprType.UNION) {
      this.compileUnion(expr as Union, prog);
    } else if (expr.tag == ExprType.QUANT) {
      this.compileQuant(expr as Quant, prog);
    } else {
      throw new Error("Expr Type yet supported: " + expr.tag);
    }
    return prog.length - start;
  }

  compileCat(cat: Cat, prog: Prog): void {
    for (const child of cat.children) {
      this.compile(child, prog);
    }
  }

  compileUnion(union: Union, prog: Prog): void {
    const split = prog.add(OpCode.Split);
    const jumps: Instr[] = [];

    for (let i = 0; i < union.options.length; i++) {
      split.add(prog.length);
      this.compile(union.options[i], prog);
      if (i < union.options.length - 1) {
        jumps.push(prog.add(OpCode.Jump));
      }
    }
    for (const jmp of jumps) {
      jmp.add(prog.length);
    }
  }

  /**
   * Compiles a repetition (with quantifiers) into its instructions.
   *
   * For Expr{A,B} do something like:
   * L0: AcquireReg     # acquire new register at L0 and set value to 0
   * L1: CodeFor expr   # Emit code for expr
   * L2: ...
   * L5: ... Code for Expr ends here
   * L6: IncReg L0    # Increment value of register at L0
   *
   * # If value of register at L0 is < A jump to L1
   * L7: JumpIfLt L0, A, L1
   *
   * # If value of register at L0 is >= B jump to LX (after split)
   * L8: JumpIfGt L0, B - 1, L10
   *
   * # Repeat as we are between A and B
   * # Ofcourse swap L1 and L10 if match is not greedy
   * L9: Split L1, L10
   *
   * L10: ReleaseReg L0 # Release register - no longer used
   *
   * In the above if A == 0 then insert a Split L11 before L0 above
   */
  compileQuant(quant: Quant, prog: Prog): void {
    // optionals allowed so create a split
    const split = quant.minCount <= 0 ? prog.add(OpCode.Split) : null;

    const l0 = prog.add(OpCode.RegAcquire).offset;
    const l1 = prog.length;
    this.compile(quant.expr, prog);

    // Increment match count
    prog.add(OpCode.RegInc, l0);

    // Next two jumps perform if (A <= val <= B) ...
    prog.add(OpCode.JumpIfLt, l0, quant.minCount, l1);
    const jumpIfGt = prog.add(OpCode.JumpIfGt, l0, quant.maxCount - 1 /* Add L10 here */);

    // Have the option of repeat if we are here
    const split2 = prog.add(OpCode.Split);

    // Release the register for reuse
    const lEnd = prog.add(OpCode.RegRelease, l0).offset;
    jumpIfGt.add(lEnd);
    split2.add(lEnd);

    if (split != null) split.add(prog.length);
  }
}

/**
 * A regex expression node.
 */
export abstract class Expr {
  tag: ExprType;
  parent: TSU.Nullable<Expr> = null;

  get debugValue(): any {
    return "";
  }
}

export class Any extends Expr {
  readonly tag: ExprType = ExprType.ANY;
  get debugValue(): string {
    return ".";
  }
}

export class StartOfInput extends Expr {
  readonly tag: ExprType = ExprType.START_OF_INPUT;
  get debugValue(): string {
    return "^";
  }
}

export class EndOfInput extends Expr {
  readonly tag: ExprType = ExprType.END_OF_INPUT;
  get debugValue(): string {
    return "$";
  }
}

export class Assertion extends Expr {
  readonly tag: ExprType = ExprType.ASSERTION;
  // Expression to match
  expr: Expr;
  // The condition for the assertion
  cond: Expr;
  // If the assertion is after the match or before
  after = true;
  constructor(expr: Expr, cond: Expr, after = true) {
    super();
    this.expr = expr;
    this.cond = cond;
    this.after = after;
  }

  get debugValue(): any {
    return [this.after ? "ASSERT_AFTER" : "ASSERT_BEFORE", this.cond.debugValue, this.expr.debugValue];
  }
}

export class Quant extends Expr {
  readonly tag: ExprType = ExprType.QUANT;
  constructor(public expr: Expr, public minCount = 1, public maxCount = 1, public lazy = false) {
    super();
  }

  get debugValue(): any {
    let quant = "*";
    if (this.minCount == 1 && this.maxCount == TSU.Constants.MAX_INT) quant = "+";
    else if (this.minCount == 0 && this.maxCount == TSU.Constants.MAX_INT) quant = "*";
    else if (this.minCount == 0 && 1) quant = "?";
    else quant = `{${this.minCount},${this.maxCount == TSU.Constants.MAX_INT ? "" : this.maxCount}}`;
    return [this.lazy ? "QuantLazy" : "Quant", [this.expr.debugValue, quant]];
  }
}

export class Cat extends Expr {
  readonly tag: ExprType = ExprType.CAT;
  children: Expr[];
  constructor(...children: Expr[]) {
    super();
    this.children = [];
    for (const child of children) {
      this.add(child);
    }
  }

  add(child: Expr): this {
    if (child.tag != ExprType.UNION) {
      this.children.push(child);
    } else {
      for (const opt of (child as Cat).children) {
        this.add(opt);
      }
    }
    return this;
  }

  get debugValue(): any {
    return ["Cat", this.children.map((c) => c.debugValue)];
  }
}

export class Union extends Expr {
  readonly tag: ExprType = ExprType.UNION;
  readonly options: Expr[];
  constructor(...options: Expr[]) {
    super();
    this.options = [];
    for (const option of options) {
      this.add(option);
    }
  }

  add(option: Expr): this {
    if (option.tag != ExprType.UNION) {
      this.options.push(option);
    } else {
      for (const opt of (option as Union).options) {
        this.add(opt);
      }
    }
    return this;
  }

  get debugValue(): any {
    return ["Union", this.options.map((o) => o.debugValue)];
  }
}

export class Neg extends Expr {
  readonly tag: ExprType = ExprType.NEG;
  constructor(public expr: Expr) {
    super();
  }

  get debugValue(): any {
    if (this.expr.tag == ExprType.CHAR_CLASS) {
      const out = (this.expr as CharClass).debugValue as string;
      return "[^" + out.substring(1, out.length - 1) + "]";
    } else {
      return ["NOT", this.expr.debugValue];
    }
  }
}

export class Char extends Expr {
  readonly tag: ExprType = ExprType.CHAR;
  // start == 0 and end == MAX_INT => ANY
  // start == end => Single char
  // start < end => Char range
  // Start == -1 =>
  constructor(public start = 0, public end = 0, public neg = false) {
    super();
  }

  static of(ch: string | number): Char {
    if (typeof ch === "string") {
      ch = ch.charCodeAt(0);
    }
    return new Char(ch, ch);
  }

  static from(value: string, index = 0, end = 0): [Char, number] {
    if (value[index] == "\\") {
      // escape char
      index++;
      const ch = value[index];
      switch (ch) {
        case "r":
          return [Char.of("\r"), 2];
        case "n":
          return [Char.of("\n"), 2];
        case "f":
          return [Char.of("\f"), 2];
        case "b":
          return [Char.of("\b"), 2];
        case "t":
          return [Char.of("\t"), 2];
        case "\\":
          return [Char.of("\\"), 2];
        case "'":
          return [Char.of("'"), 2];
        case '"':
          return [Char.of('"'), 2];
        case "x":
          // 2 digit hex digits
          index++;
          TSU.assert(index <= end - 1, `Invalid hex sequence at ${index}, ${end}`);
          const hexSeq = value.substring(index, index + 2);
          const hexVal = parseInt(hexSeq, 16);
          TSU.assert(!isNaN(hexVal), `Invalid hex sequence: '${hexSeq}'`);
          return [new Char(hexVal, hexVal), 4];
        case "u":
          index++;
          // 4 digit hex digits for unicode
          TSU.assert(index <= end - 3, `Invalid unicode sequence at ${index}`);
          const ucodeSeq = value.substring(index, index + 4);
          const ucodeVal = parseInt(ucodeSeq, 16);
          TSU.assert(!isNaN(ucodeVal), `Invalid unicode sequence: '${ucodeSeq}'`);
          return [new Char(ucodeVal, ucodeVal), 6];
        default:
          return [Char.of(ch), 2];
      }
      throw new Error("TBD");
      return [new Char(), 1];
    } else {
      // single char
      const ch = value.charCodeAt(index);
      return [new Char(ch, ch), 1];
    }
  }

  compareTo(another: Char): number {
    if (this.start == another.start) return this.end - another.end;
    return this.start - another.start;
  }

  get debugValue(): any {
    return this.start == this.end
      ? String.fromCharCode(this.start)
      : `${String.fromCharCode(this.start)}-${String.fromCharCode(this.end)}`;
  }
}

/**
 * Character ranges
 */
export class CharClass extends Expr {
  readonly tag: ExprType = ExprType.CHAR_CLASS;
  chars: Char[];
  constructor(...chars: Char[]) {
    super();
    this.chars = chars;
    this.mergeRanges();
  }

  /**
   * Adds a new Char into this class.
   * Doing so "merges" renges in this class so we dont have overlaps.
   */
  add(ch: Char): this {
    this.chars.push(ch);
    return this.mergeRanges();
  }

  protected mergeRanges(): this {
    // sort ranges
    this.chars.sort((c1, c2) => c1.compareTo(c2));
    // merge ranges
    const ch2 = [] as Char[];
    for (const ch of this.chars) {
      const last = ch2[ch2.length - 1] || null;
      if (last == null || last.end >= ch.start) {
        ch2.push(ch);
      } else {
        last.end = Math.max(last.end, ch.end);
      }
    }
    this.chars = ch2;
    return this;
  }

  static parse(value: string, invert = false): CharClass {
    const out: Char[] = [];
    // first see which characters are in this (until the end)
    for (let i = 0; i < value.length; ) {
      const [currch, nchars] = Char.from(value, i, value.length - 1);
      i += nchars;
      if (i < value.length && value[i] == "-") {
        i++;
        if (i < value.length) {
          const [endch, nchars] = Char.from(value, i, value.length - 1);
          currch.end = endch.start;
          i += nchars;
        }
      }
      out.push(currch);
    }
    return new CharClass(...out);
  }

  get debugValue(): any {
    return this.chars.map((ch) => ch.debugValue);
  }
}

/**
 * Named expression referring to another regex by name.
 */
export class NamedExpr extends Expr {
  readonly tag: ExprType = ExprType.REF;
  constructor(public name: string) {
    super();
  }

  get debugValue(): any {
    return "<" + this.name + ">";
  }
}

/**
 * Creates a regex tree given a string
 */
export function parse(regex: string, curr = 0, end = -1): Expr {
  if (end < 0) end = regex.length - 1;
  let out: Expr[] = [];
  function reduceLeft(): Expr {
    const r = out.length == 1 ? out[0] : new Cat(...out);
    out = [];
    return r;
  }
  while (curr <= end) {
    const currCh = regex[curr];
    // see if we have groups so they get highest preference
    if (currCh == "<") {
      curr++;
      let gtPos = curr;
      while (gtPos <= end && regex[gtPos] != ">") gtPos++;
      if (gtPos >= end) throw new Error("Expected '>' found EOI");
      const name = regex.substring(curr, gtPos);
      if (name.trim() == "") {
        throw new Error("Expected name");
      }
      out.push(new NamedExpr(name));
      curr = gtPos + 1;
    } else if (currCh == ".") {
      out.push(new Any());
      curr++;
    } else if (currCh == "[") {
      // character classes
      let clPos = curr + 1;
      while (clPos <= end && regex[clPos] != "]") {
        if (regex[clPos] == "\\") clPos++;
        clPos++;
      }
      if (clPos >= end) throw new Error("Expected ']' found EOI");
      out.push(CharClass.parse(regex.substring(curr + 1, clPos)));
      curr = clPos + 1;
    } else if (currCh == "^") {
      // parse everything to the right
      if (curr + 1 < end) {
        const rest = parse(regex, curr + 1, end);
        const assertion = new Assertion(rest, new StartOfInput(), false);
        out.push(assertion);
      }
      curr = end + 1;
    } else if (currCh == "$") {
      // parse everything to the right
      const prev = new Cat(...out);
      const assertion = new Assertion(prev, new EndOfInput(), true);
      out = [assertion];
      curr++;
    } else if (currCh == "|") {
      if (curr + 1 <= end) {
        // reduce everything "until now" and THEN apply
        const prev = reduceLeft();
        // parse everything to the right
        const rest = parse(regex, curr + 1, end);
        return new Union(prev, rest);
      }
      curr = end + 1;
    } else if (currCh == "(") {
      // we have a grouping
      let clPos = curr + 1;
      let depth = 0;
      while (clPos <= end && (regex[clPos] != ")" || depth > 0)) {
        if (regex[clPos] == "(") depth++;
        else if (regex[clPos] == ")") depth--;
        if (regex[clPos] == "\\") clPos++;
        clPos++;
      }
      if (clPos >= end) throw new Error("Expected ')' found EOI");

      if (regex[curr + 1] != "?") {
        out.push(parse(regex, curr + 1, clPos - 1));
        curr = clPos + 1;
      } else {
        curr++; // skip the "?"
        let after = true;
        if (regex[curr] == "<") {
          curr++;
          after = false;
        }
        const neg = regex[curr++] == "!";
        let cond = parse(regex, curr, clPos - 1);
        if (neg) cond = new Neg(cond);
        curr = clPos + 1;
        if (after) {
          // reduce everything "until now" and THEN apply
          const prev = reduceLeft();
          const assertion = new Assertion(prev, cond, after);
          out = [assertion];
        } else {
          // parse everything to the right
          if (curr + 1 <= end) {
            const rest = parse(regex, curr, end);
            const assertion = new Assertion(rest, cond, after);
            out.push(assertion);
          }
          curr = end + 1; // no more input left
        }
      }
    } else if (regex[curr] == "*" || regex[curr] == "?" || regex[curr] == "+" || regex[curr] == "{") {
      // Quantifiers
      let last: Quant;
      if (out[out.length - 1].tag != ExprType.QUANT) {
        last = new Quant(out[out.length - 1], 1, 1, false);
        out[out.length - 1] = last;
      } else {
        last = out[out.length - 1] as Quant;
      }
      if (regex[curr] == "*") {
        last.minCount = 0;
        last.maxCount = TSU.Constants.MAX_INT;
      } else if (regex[curr] == "+") {
        last.minCount = Math.min(last.minCount, 1);
        last.maxCount = TSU.Constants.MAX_INT;
      } else if (regex[curr] == "?") {
        last.minCount = 0;
        last.maxCount = Math.max(last.maxCount, 1);
      } else if (regex[curr] == "{") {
        // find the next "}"
        const clPos = regex.indexOf("}", curr + 1);
        TSU.assert(clPos > curr && clPos <= end, "Unexpected end of input while looking for '}'");
        const sub = regex.substring(curr + 1, clPos);
        const parts = sub.split(",").map((x) => parseInt(x));
        if (parts.length == 1) {
          if (!isNaN(parts[0])) {
            last.minCount = last.maxCount = parts[0];
          }
        } else if (parts.length == 2) {
          last.minCount = isNaN(parts[0]) ? 0 : parts[0];
          last.maxCount = isNaN(parts[1]) ? TSU.Constants.MAX_INT : parts[1];
        } else if (parts.length > 2) {
          throw new Error(`Invalid quantifier spec: "{${sub}}"`);
        }
        curr = clPos;
      }
      curr++;
      // check if there is an extra lazy quantifier
      if (curr <= end && regex[curr] == "?" && !last.lazy) {
        curr++;
        last.lazy = true;
      }
    } else {
      // plain old alphabets
      const [result, nchars] = Char.from(regex, curr, end);
      out.push(result);
      curr += nchars;
    }
  }
  TSU.assert(out.length > 0);
  if (out.length == 1) return out[0];
  return new Cat(...out);
}
