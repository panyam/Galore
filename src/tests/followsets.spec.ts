import { EBNFParser } from "../ebnf";
import { expectNullables, expectFSEntries } from "./utils";
import Samples from "./samples";

describe("FollowSet Tests", () => {
  test("Tests 1", () => {
    const g = new EBNFParser(` A -> a b c ; `).grammar;

    const ns = g.nullables;
    const fs = g.followSets;
    expectFSEntries(g, fs, { A: [g.Eof.label] });
  });

  test("Tests 2", () => {
    const g = new EBNFParser(` A -> B a ; B -> b ; `).grammar;

    const ns = g.nullables;
    const firstSets = g.firstSets;
    expect(g.followSets.debugValue).toEqual({ A: "<<EOF>>", B: "<a>" });
  });

  test("Tests 3", () => {
    const g = new EBNFParser(Samples.expr2).grammar;

    const ns = g.nullables;
    expect(g.firstSets.debugValue).toEqual({
      E: "<OPEN, id>",
      T: "<OPEN, id>",
      E1: "<, PLUS>",
      F: "<OPEN, id>",
      T1: "<, STAR>",
    });
    expect(g.followSets.debugValue).toEqual({
      E: "<<EOF>, CLOSE>",
      T: "<<EOF>, CLOSE, PLUS>",
      E1: "<<EOF>, CLOSE>",
      F: "<<EOF>, CLOSE, PLUS, STAR>",
      T1: "<<EOF>, CLOSE, PLUS>",
    });
  });

  test("Tests 4", () => {
    const g = new EBNFParser(`
      E -> T X ;
      X -> PLUS E | ;
      T -> int Y | OPEN E CLOSE ;
      Y -> STAR T | ;
    `).grammar;

    expect(g.firstSets.debugValue).toEqual({
      E: "<OPEN, int>", T: "<OPEN, int>", X: "<, PLUS>", Y: "<, STAR>"
    });
    expect(g.followSets.debugValue).toEqual({
      E: "<<EOF>, CLOSE>",
      T: "<<EOF>, CLOSE, PLUS>",
      X: "<<EOF>, CLOSE>",
      Y: "<<EOF>, CLOSE, PLUS>",
    });
  });

  test("Tests 5", () => {
    const g = new EBNFParser(Samples.Sample4).grammar;

    const ns = g.nullables;
    expectNullables(ns, ["V", "W"]);
    expect(g.firstSets.debugValue).toEqual({ S: '<a, c, d, e, f>', T: '<a, e>', U: '<f>', V: '<, c>', W: '<, d>' });
    expect(g.followSets.debugValue).toEqual({ S: '<<EOF>>', T: '<<EOF>, f>', U: '<<EOF>, a, b, c, d, e>', V: '<<EOF>, d, f>', W: '<<EOF>, c, d, f>' });
  });

  test("Tests 6", () => {
    const g = new EBNFParser(`
      S -> S A | ;
      A -> X | b X | c X ;
      X -> X x | ;
    `).grammar;

    expect(g.firstSets.debugValue).toEqual({ S: '<, b, c, x>', A: '<, b, c, x>', X: '<, x>' });
    expect(g.followSets.debugValue).toEqual({ S: '<<EOF>, b, c, x>', A: '<<EOF>, b, c, x>', X: '<<EOF>, b, c, x>' });
  });
});
