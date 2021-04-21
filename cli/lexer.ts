const tm1 = Date.now();

import * as fs from "fs";
import * as TSU from "@panyam/tsutils";
import { newLexer, VMTracer, layoutThreadNodes } from "../src/regex/tests/utils";
import { Tape } from "../src/tape";
import { InstrDebugValue, VM } from "../src/regex/pikevm";

const t0 = Date.now();
const args = process.argv.slice(2);
const lexerPath = args[0];
const inputPath = args[1];
const debug = args[2] == "true";
const reportFile = args[3] || null;

const lexerContents = fs.readFileSync(lexerPath, "utf8");
const inputContents = fs.readFileSync(inputPath, "utf8");
const tape = new Tape(inputContents);
const tracer: VMTracer = new VMTracer();
const t1 = Date.now();
const lexer = newLexer(lexerContents);
if (debug) {
  const allVars: any = {};
  for (const [name, entry] of lexer.variables.entries()) {
    allVars[name] = entry.toString;
  }
  console.log("AllExterns: ", lexer.externs);
  console.log("AllVars: ", allVars);
  console.log(
    "AllRules: ",
    lexer.allRules.map((rule) => [rule.tokenType, rule.pattern, rule.priority, rule.isGreedy]),
  );
}
const t2 = Date.now();
lexer.compile();
const t3 = Date.now();
if (debug) {
  lexer.vm.tracer = tracer;
  console.log(
    "Prog: \n",
    `${lexer.vm.prog.debugValue(InstrDebugValue).join("\n")}`,
    "\n",
    "\n",
    "Input: ",
    inputContents,
  );
}
const t4 = Date.now();
// Now start matching
const found = [] as [string, number][];
let next = lexer.vm.match(tape);
while (next != null && next.end > next.start) {
  found.push([tape.substring(next.start, next.end), next.matchIndex]);
  next = lexer.vm.match(tape);
}
const t5 = Date.now();
if (debug) {
  const reportHtml = `<html>
        <head>
          <style>
            .threadInstrsCell  { padding-left: 10px; padding-right: 10px; vertical-align: top; }
            .inputCharCell { font-weight: bold; text-align: center; }
            .threadIdCell { font-weight: bold; text-align: left; vertical-align: top; }
          </style>
        </head>
        <body>${layoutThreadNodes(inputContents, tracer.allThreadNodes)}</body>
       </html>`;
  if (reportFile != null) {
    if (reportFile.trim().length > 0) {
      fs.writeFileSync(reportFile, reportHtml);
    } else {
      console.log(reportHtml);
    }
  }
}
console.log(`Header Load Time: (${t0} - ${tm1}) = ${t0 - tm1}`);
console.log(`Data Load Time: (${t1} - ${t0}) = ${t1 - t0}`);
console.log(`Lexer Creation time: (${t2} - ${t1}) = ${t2 - t1}`);
console.log(`Compilation time: (${t3} - ${t2}) = ${t3 - t2}`);
console.log(`Input Scanning time: (${t5} - ${t4}) = ${t5 - t4}`);
console.log("Found Tokens: ", found);
