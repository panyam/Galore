import * as G from "galore";
import * as P from "../";
const fs = require("fs");

function readFile(fname: string): string {
  return fs.readFileSync(__dirname + "/" + fname, "utf8");
}

function parseFile(fname: string, contents?: string): null | G.PTNode {
  if (!contents) contents = readFile(fname);
  const [parser, _] = P.newParser({ type: "slr" });
  const t1 = Date.now();
  const result = null; //parser.parse(contents) || null;
  const t2 = Date.now();
  console.log(`'${fname}' parsed in ${t2 - t1} ms`);
  return result;
}

describe("C11 Parser", () => {
  test("1", () => {
    const result = parseFile(
      "Case 1",
      `
                             int main(void) { }
    `,
    );
  });
});
