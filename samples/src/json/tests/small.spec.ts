/**
 * @jest-environment jsdom
 */
import * as G from "galore";
import * as P from "../";
const fs = require("fs");

function parseFile(fname: string): null | G.PTNode {
  const input = fs.readFileSync(__dirname + "/" + fname, "utf8");
  const [parser, _] = P.newParser();
  const t1 = Date.now();
  const result = parser.parse(input) || null;
  const t2 = Date.now();
  console.log(`${fname} parsed in ${t2 - t1} ms`);
  return result;
}

describe("JSON Parser", () => {
  test("Solar.json", () => {
    const result = parseFile("solar.json");
    // console.log("Results: ", parser.parse(input)?.debugValue());
  });
  test("Small.json", () => {
    const result = parseFile("small.json");
    // console.log("Results: ", parser.parse(input)?.debugValue());
  });
});
