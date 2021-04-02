import { EBNFParser } from "../ebnf";
import { expectNullables } from "./utils";
import Samples from "./samples";

describe("Nullable Tests", () => {
  test("Nullables Tests 1", () => {
    const g = new EBNFParser(Samples.Sample2).grammar;
    const ns = g.nullables.nonterms.map((n) => n.label).sort();
    expect(ns).toEqual(["A", "C", "S"]);
  });

  test("Nullables Tests 2", () => {
    const g = new EBNFParser(Samples.Sample1).grammar;
    expectNullables(g.nullables, ["S"]);
  });

  test("Nullables Tests 3", () => {
    const g = new EBNFParser(Samples.Sample3).grammar;
    expectNullables(g.nullables, ["A", "B", "C", "S"]);
  });
});
