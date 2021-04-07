import { EBNFParser } from "../ebnf";

const g3 = new EBNFParser(`
  S -> C C ;
  C -> c C | d ;
`).grammar.augmentStartSymbol("S1");

const g4 = new EBNFParser(`
  S -> S A ;
  S -> ;

  A -> X ;
  A -> b X ;
  A -> c X ;

  X -> X x ;
  X -> ;
`);

describe("Non Amgiguous Grammar without Conflicts", () => {
  test("Test1", () => {
    //
  });
});
