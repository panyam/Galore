const util = require("util");
const fs = require("fs");
import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import Grammars from "./samples/grammars";

function tokenizeAll(tokenFunc: TLEX.NextTokenFunc, tape: TLEX.Tape): TLEX.Token[] {
  const out = [];
  let next = tokenFunc(tape);
  while (next) {
    out.push(next);
    next = tokenFunc(tape);
  }
  return out;
}

function measureTime(log: string, method: any): [any, number] {
  const startTime = Date.now();
  const result = method();
  const endTime = Date.now();
  const delta = endTime - startTime;
  console.log(log, delta);
  return [result, delta];
}

const args = process.argv.slice(2);
const grammar = args[0];
const inputfile = args[1];
const payload = fs.readFileSync(inputfile, "utf8");
const [parser, tokenizer] = (Grammars as any)[grammar].newParser();

const [tokens, t1] = measureTime("Tokenizer Time: ", () => tokenizeAll(tokenizer!, new TLEX.Tape(payload)));
console.log("Num Tokens: ", tokens.length);
const [result, t2] = measureTime("Parse Time: ", () => parser.parse(payload));

const printResults = false;
if (printResults) {
  console.log("Parse Tree: ");
  const dVal = util.inspect(result?.debugValue(true), {
    showHidden: false,
    depth: null,
    maxArrayLength: null,
    maxStringLength: null,
  });
  console.log(dVal);
  console.log(result?.reprString);
  console.log(
    "Value: ",
    util.inspect(result?.value, {
      showHidden: false,
      depth: null,
      maxArrayLength: null,
      maxStringLength: null,
    }),
  );
}
