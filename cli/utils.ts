const util = require("util");
const fs = require("fs");
const yargs = require("yargs");
import * as TLEX from "tlex";
import { mergedDebugValue } from "../../src/debug";
import { PTNode } from "../../src/parser";
import { ParseTable } from "../../src/lr";
import { parseTableToHtml } from "../../src/printers";

export function tokenizeAll(tokenFunc: TLEX.NextTokenFunc, tape: TLEX.Tape): TLEX.Token[] {
  const out = [];
  let next = tokenFunc(tape);
  while (next) {
    out.push(next);
    next = tokenFunc(tape);
  }
  return out;
}

export function measureTime(log: string, method: any): [any, number] {
  const startTime = Date.now();
  const result = method();
  const endTime = Date.now();
  const delta = endTime - startTime;
  console.log(log, delta);
  return [result, delta];
}

export function writeResults(outDir: string, parseTable: ParseTable, result?: PTNode): void {
  outDir = (outDir || ".").trim();
  if (outDir != ".") fs.mkdirSync(outDir, { recursive: true });
  const ptableJsonPath = outDir + "/" + "ptable.json";
  console.log("Writing parse table to: ", ptableJsonPath);
  fs.writeFileSync(
    ptableJsonPath,
    `Parse Table: ${util.inspect(mergedDebugValue(parseTable), {
      showHidden: false,
      depth: null,
      maxArrayLength: null,
      maxStringLength: null,
    })},
    Parse Table Conflicts: ${util.inspect(parseTable.conflictActions, {
      showHidden: false,
      depth: null,
      maxArrayLength: null,
      maxStringLength: null,
    })}`,
  );

  const ptablePath = outDir + "/" + "ptable.html";
  console.log("Writing parse table to: ", ptablePath);
  fs.writeFileSync(
    ptablePath,
    `
    <html><head><title>Parse Table</title></head>
    <body>
      <h2><center>Parse Table</center></h2>
      <div>${parseTableToHtml(parseTable)}</div>
    </body>
    </html>
    `,
  );
  if (result) {
    const ptreePath = outDir + "/" + "ptree.out";
    console.log("Writing parse tree (pretty) to: ", ptreePath);
    fs.writeFileSync(ptreePath, result?.reprString);

    const ptreeJsonPath = outDir + "/" + "ptree.json";
    const dVal = util.inspect(result?.debugValue(true), {
      showHidden: false,
      depth: null,
      maxArrayLength: null,
      maxStringLength: null,
    });
    console.log("Writing parse tree (json) to: ", ptreeJsonPath);
    fs.writeFileSync(ptreeJsonPath, dVal);
  }
}
