/**
 * @jest-environment jsdom
 */
import { Loader as DSLLoader } from "../dsl";
import { expectFSEntries } from "./utils";
import Samples from "./samples";

describe("First Sets tests", () => {
  test("First Tests 1", () => {
    const g = new DSLLoader(Samples.Sample5).grammar;

    const ns = g.nullables;
    const fs = g.firstSets;
    expectFSEntries(g, fs, {
      S: ["a", "b", "c"],
      A: ["a", "b", "c"],
      B: ["b"],
      C: ["c"],
    });
  });

  test("First Tests 3", () => {
    const g = new DSLLoader(Samples.expr1).grammar;
    const ns = g.nullables;
    const fs = g.firstSets;
    expectFSEntries(g, fs, {
      S: ["OPA", "LP", "NUM"],
    });
  });
});
