import * as TSU from "@panyam/tsutils";

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
  literals: [string, any][] = [];
  regexes: [string, any][] = [];
  rulesByName = {} as any;

  addLiteral(lit: string, tokType: any): number {
    const index = this.literals.findIndex((k) => k[0] == lit);
    if (index < 0) {
      this.literals.push([lit, tokType]);
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
    const index = this.regexes.findIndex((k) => k[0] == regex);
    if (index < 0) {
      this.regexes.push([regex, tokType]);
      const expr = Regex.parse(regex);
      this.compile(expr);
      return this.regexes.length - 1;
    } else {
      if (this.regexes[index][1] != tokType) {
        throw new Error(`Regex '${regex}' already registered as ${tokType}`);
      }
      return index;
    }
  }

  /**
   * Compiles the regex and stores the specific
   */
  protected compile(expr: Expr): void {
    //
  }
}

enum ExprType {
  CHAR,
  CHAR_CLASS,
  UNION,
  CAT,
  NEG,
  REF,
  QUANT,
  ASSERTION,
}

class Regex {
  root: Expr;
  constructor(regex: string) {
    this.root = Regex.parse(regex);
  }

  /**
   * Creates a regex tree given a string
   */
  static parse(regex: string, curr = 0, end = -1): Expr {
    if (end < 0) end = regex.length - 1;
    let out: Expr[] = [];
    while (curr <= end) {
      const currCh = regex[curr];
      // see if we have groups so they get highest preference
      if (currCh == "<") {
        let gtPos = curr + 1;
        while (gtPos <= end && regex[gtPos] != ">") gtPos++;
        if (gtPos >= end) throw new Error("Expected '>' found EOI");
        const name = regex.substring(curr, gtPos);
        if (name.trim() == "") {
          throw new Error("Expected name");
        }
        out.push(new NamedExpr(name));
        curr = gtPos + 1;
      } else if (currCh == ".") {
        out.push(Char.Any());
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
        const rest = Regex.parse(regex, curr + 1, end);
        const assertion = new Assertion(rest, Char.StartOfLine(), false);
        out.push(assertion);
        curr = end + 1;
      } else if (currCh == "$") {
        // parse everything to the right
        const prev = new Cat(...out);
        const assertion = new Assertion(prev, Char.EndOfLine(), true);
        out = [assertion];
        curr++;
      } else if (currCh == "|") {
        // reduce everything "until now" and THEN apply
        const prev = new Cat(...out);

        // parse everything to the right
        const rest = Regex.parse(regex, curr + 1, end);
        return new Union(prev, rest);
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
          out.push(Regex.parse(regex, curr + 1, clPos - 1));
          curr = clPos + 1;
        } else {
          curr++; // skip the "?"
          let after = true;
          if (regex[curr] == "<") {
            curr++;
            after = false;
          }
          const neg = regex[curr++] == "!";
          let cond = Regex.parse(regex, curr, clPos - 1);
          if (neg) cond = new Neg(cond);
          curr = clPos + 1;
          if (after) {
            // reduce everything "until now" and THEN apply
            const prev = new Cat();
            prev.children = out;
            const assertion = new Assertion(prev, cond, after);
            out = [assertion];
          } else {
            // parse everything to the right
            const rest = Regex.parse(regex, curr, end);
            const assertion = new Assertion(rest, cond, after);
            out.push(assertion);
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
          throw new Error("TBD");
        }
        curr++;
        // check if there is an extra greedy quantifier
        if (regex[curr] == "?" && !last.greedy) {
          curr++;
          last.greedy = true;
        }
      } else {
        // plain old alphabets
        const [result, nchars] = Char.from(currCh);
        out.push(result);
        curr += nchars;
      }
    }
    if (out.length == 1) return out[0];
    return new Cat(...out);
  }
}

/**
 * A regex expression node.
 */
abstract class Expr {
  tag: ExprType;
  parent: TSU.Nullable<Expr> = null;

  get debugValue(): any {
    return "";
  }
}

class Assertion extends Expr {
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
    if (this.cond.tag == ExprType.CHAR) {
      if ((this.cond as Char).isStartOfLine && !this.after) {
        return ["^", this.expr.debugValue];
      } else if ((this.cond as Char).isEndOfLine && this.after) {
        return [this.expr.debugValue, "$"];
      }
    }
    if (this.after) {
      return ["ASSERT_AFTER", this.expr.debugValue, this.cond.debugValue];
    } else {
      return ["ASSERT_BEFORE", this.cond.debugValue, this.expr.debugValue];
    }
  }
}

class Quant extends Expr {
  readonly tag: ExprType = ExprType.QUANT;
  constructor(public expr: Expr, public minCount = 1, public maxCount = 1, public greedy = false) {
    super();
  }

  get debugValue(): any {
    let quant = "*";
    if (this.minCount == 1 && this.maxCount == TSU.Constants.MAX_INT) quant = "+";
    else if (this.minCount == 0 && this.maxCount == TSU.Constants.MAX_INT) quant = "*";
    else if (this.minCount == 0 && 1) quant = "?";
    else quant = `{${this.minCount},${this.maxCount == TSU.Constants.MAX_INT ? "" : this.maxCount}}`;
    if (this.greedy) quant += "?";
    return [quant, this.expr.debugValue];
  }
}

class Cat extends Expr {
  readonly tag: ExprType = ExprType.CAT;
  children: Expr[];
  constructor(...children: Expr[]) {
    super();
    this.children = children;
  }

  get debugValue(): any {
    return ["Cat", this.children.map((c) => c.debugValue)];
  }
}

class Union extends Expr {
  readonly tag: ExprType = ExprType.UNION;
  constructor(public left: Expr, public right: Expr) {
    super();
  }

  get debugValue(): any {
    return ["Union", this.left.debugValue, this.right.debugValue];
  }
}

class Neg extends Expr {
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

class Char extends Expr {
  readonly tag: ExprType = ExprType.CHAR;
  // start == 0 and end == 0 => ANY
  // start == end => Single char
  // start < end => Char range
  // Start == -1 =>
  constructor(public start = 0, public end = 0) {
    super();
  }

  static StartOfLine(): Char {
    return new Char(-1, 0);
  }

  static EndOfLine(): Char {
    return new Char(0, -1);
  }

  static Any(): Char {
    return new Char(0, 0);
  }

  static from(value: string, index = 0): [Char, number] {
    if (value[index] == "\\") {
      // escape char
      throw new Error("TBD");
      return [new Char(), 1];
    } else {
      // single char
      const ch = value.charCodeAt(index);
      return [new Char(ch, ch), 1];
    }
  }

  get isStartOfLine(): boolean {
    return this.start < 0;
  }

  get isEndOfLine(): boolean {
    return this.end < 0;
  }

  get debugValue(): any {
    if (this.start == 0 && this.end == 0) return ".";
    if (this.isStartOfLine) return "^";
    if (this.isEndOfLine) return "$";
    return this.start == this.end ? this.start : `${this.start}-${this.end}`;
  }
}

/**
 * Character ranges
 */
class CharClass extends Expr {
  readonly tag: ExprType = ExprType.CHAR_CLASS;
  ranges: [number, number][] = [];
  static parse(value: string, invert = false): CharClass {
    throw new Error("TBD");
    return new CharClass();
  }

  get debugValue(): any {
    return this.ranges.map((s, e) => `${s}-${e}`).join(", ");
  }
}

/**
 * Named expression referring to another regex by name.
 */
class NamedExpr extends Expr {
  readonly tag: ExprType = ExprType.REF;
  constructor(public name: string) {
    super();
  }

  get debugValue(): any {
    return "<" + this.name + ">";
  }
}
