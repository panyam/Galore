import * as TSU from "@panyam/tsutils";
import {
  Quant,
  RegexType,
  StartOfInput,
  EndOfInput,
  Regex,
  Cat,
  Any,
  Char,
  CharClass,
  Ref,
  Assertion,
  Union,
} from "./core";

/**
 * Creates a regex tree given a string
 */
export function parse(regex: string, curr = 0, end = -1): Regex {
  if (end < 0) end = regex.length - 1;
  let out: Regex[] = [];
  function reduceLeft(): Regex {
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
      if (gtPos > end) throw new Error("Expected '>' found EOI");
      const name = regex.substring(curr, gtPos);
      if (name.trim() == "") {
        throw new Error("Expected name");
      }
      out.push(new Ref(name));
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
      if (clPos > end) throw new Error("Expected ']' found EOI");
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
      // we have a grouping or an assertion
      let clPos = curr + 1;
      let depth = 0;
      while (clPos <= end && (regex[clPos] != ")" || depth > 0)) {
        if (regex[clPos] == "(") depth++;
        else if (regex[clPos] == ")") depth--;
        if (regex[clPos] == "\\") clPos++;
        clPos++;
      }
      if (clPos > end) throw new Error("Expected ')' found EOI");

      curr++;
      if (regex[curr] != "?") {
        out.push(parse(regex, curr, clPos - 1));
        curr = clPos + 1;
      } else {
        curr++; // skip the "?"
        let after = true;
        if (regex[curr] == "<") {
          curr++;
          after = false;
        }
        const neg = regex[curr++] == "!";
        const cond = parse(regex, curr, clPos - 1);
        curr = clPos + 1;
        if (after) {
          // reduce everything "until now" and THEN apply
          const prev = reduceLeft();
          const assertion = new Assertion(prev, cond, after, neg);
          out = [assertion];
        } else {
          // parse everything to the right
          if (curr + 1 <= end) {
            const rest = parse(regex, curr, end);
            const assertion = new Assertion(rest, cond, after, neg);
            out.push(assertion);
          }
          curr = end + 1; // no more input left
        }
      }
    } else if (regex[curr] == "*" || regex[curr] == "?" || regex[curr] == "+" || regex[curr] == "{") {
      // Quantifiers
      let last: Quant;
      TSU.assert(out.length > 0, "Quantifier cannot appear before an expression");
      if (out[out.length - 1].tag != RegexType.QUANT) {
        last = new Quant(out[out.length - 1], 1, 1, true);
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
      if (curr <= end && regex[curr] == "?" && last.greedy) {
        curr++;
        last.greedy = false;
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
