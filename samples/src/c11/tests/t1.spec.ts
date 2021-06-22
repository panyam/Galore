const util = require("util");
import { PTNode } from "../../../../src/parser";
import { newLRParser } from "../../../../src/factory";
import { GRAMMAR } from "../data";
const fs = require("fs");

function readFile(fname: string): string {
  return fs.readFileSync(__dirname + "/" + fname, "utf8");
}

function parseFile(fname: string, contents?: string, debug = false): null | PTNode {
  if (!contents) contents = readFile(fname);
  const [parser, _] = newLRParser(GRAMMAR, { type: "slr", debug: debug });
  const t1 = Date.now();
  const result = parser.parse(contents) || null;
  const t2 = Date.now();
  console.log(`'${fname}' parsed in ${t2 - t1} ms`);
  if (debug) {
    console.log(
      `Parse Result: ${util.inspect(result?.debugValue(), {
        showHidden: false,
        depth: null,
        maxArrayLength: null,
        maxStringLength: null,
      })}`,
    );
  }
  return result;
}

describe("C11 Parser", () => {
  test("1", () => {
    const result = parseFile(
      "Case 1",
      `
                             int main(void) { }
    `,
      true,
    );
  });
});
