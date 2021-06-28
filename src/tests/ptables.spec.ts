import { testParseTable } from "./utils";
import { newLRParser as newParser } from "../factory";
import { mergedDebugValue } from "../debug";
import { Parser as DSLParser } from "../dsl";
import { grammarFromLR0ItemGraph } from "../ptables";
import { LR0ItemGraph } from "../lritems";
import { printGrammar } from "../utils";

describe("LR ParseTable", () => {
  test("Dragon Book 4.39 LR", () => {
    testParseTable("./testcases/dragon_4.39.g", "./testcases/dragon_4.39.ptables", "lr1");
  });
  test("Dragon Book 4.39 SLR", () => {
    testParseTable("./testcases/dragon_4.39.g", "./testcases/dragon_4.39.ptables", "slr");
  });
});

describe("LRParseTable with Conflicts", () => {
  test("Dragon Book 4.42", () => {
    testParseTable("./testcases/dragon_4.42.g", "./testcases/dragon_4.42.ptables", "lr1");
  });
  test("Dragon Book 4.42 - LR", () => {
    testParseTable("./testcases/dragon_4.42.g", "./testcases/dragon_4.42.ptables", "slr");
  });
});

describe("Tomita Test Cases", () => {
  test("2.2.1 - SLR", () => {
    testParseTable("./testcases/tomita_2.2.1.g", "./testcases/tomita_2.2.1.ptables", "slr");
  });
  test("2.2.1 - LR", () => {
    testParseTable("./testcases/tomita_2.2.1.g", "./testcases/tomita_2.2.1.ptables", "lr1");
  });
  test("2.2.2 - SLR", () => {
    testParseTable("./testcases/tomita_2.2.2.g", "./testcases/tomita_2.2.2.ptables", "slr");
  });
  test("2.2.2 - LR", () => {
    testParseTable("./testcases/tomita_2.2.2.g", "./testcases/tomita_2.2.2.ptables", "lr1");
  });
  test("3.3 - SLR", () => {
    testParseTable("./testcases/tomita_3.3.g", "./testcases/tomita_3.3.ptables", "slr");
  });
  test("3.3 - LR", () => {
    testParseTable("./testcases/tomita_3.3.g", "./testcases/tomita_3.3.ptables", "lr1");
  });
});

describe("Jison tests", () => {
  test("basic - SLR", () => {
    testParseTable("./testcases/jison_basic.g", "./testcases/jison_basic.ptables", "slr");
  });
  test("basic - LR", () => {
    testParseTable("./testcases/jison_basic.g", "./testcases/jison_basic.ptables", "lr1");
  });
  test("dism - SLR", () => {
    testParseTable("./testcases/jison_dism.g", "./testcases/jison_dism.ptables", "slr");
  });
  test("dism - LR", () => {
    testParseTable("./testcases/jison_dism.g", "./testcases/jison_dism.ptables", "lr1");
  });
  test("RR Conflict - SLR", () => {
    testParseTable("./testcases/jison_rrconflict.g", "./testcases/jison_rrconflict.ptables", "slr");
  });
  test("RR Conflict - LR Should not have any", () => {
    testParseTable("./testcases/jison_rrconflict.g", "./testcases/jison_rrconflict.ptables", "lr1");
  });
  /*
  test("Anci C - SLR", () => {
    testParseTable("./testcases/jison_ansic.g", "./testcases/jison_ansic.ptables", "slr", true);
  });
  test("Anci C - LR", () => {
    testParseTable("./testcases/jison_ansic.g", "./testcases/jison_ansic.ptables", "lr1");
  });
 */
});

describe("Sample Parse Tables", () => {
  test("Test1", () => {
    const [parser, _, ig] = newParser(
      `
        E -> T X ;
        X -> PLUS E | ;
        T -> int Y | OPEN E CLOSE ;
        Y -> STAR T | ;
      `,
      { type: "slr" },
    );
    const v = mergedDebugValue(parser.parseTable, ig);
    expect(v).toEqual({
      "0": {
        items: ["0  -  $accept ->  • E", "1  -  E ->  • T X", "4  -  T ->  • int Y", "5  -  T ->  • OPEN E CLOSE"],
        actions: { E: ["1"], T: ["2"], int: ["S3"], OPEN: ["S4"] },
        goto: { E: 1, T: 2, int: 3, OPEN: 4 },
      },
      "1": {
        items: ["0  -  $accept -> E • "],
        actions: { $end: ["Acc"] },
        goto: {},
      },
      "2": {
        items: ["1  -  E -> T • X", "2  -  X ->  • PLUS E", "3  -  X ->  • "],
        actions: { $end: ["R 3"], X: ["5"], PLUS: ["S6"], CLOSE: ["R 3"] },
        goto: { X: 5, PLUS: 6 },
      },
      "3": {
        items: ["4  -  T -> int • Y", "6  -  Y ->  • STAR T", "7  -  Y ->  • "],
        actions: {
          $end: ["R 7"],
          PLUS: ["R 7"],
          Y: ["7"],
          CLOSE: ["R 7"],
          STAR: ["S8"],
        },
        goto: { Y: 7, STAR: 8 },
      },
      "4": {
        items: ["1  -  E ->  • T X", "4  -  T ->  • int Y", "5  -  T ->  • OPEN E CLOSE", "5  -  T -> OPEN • E CLOSE"],
        actions: { E: ["9"], T: ["2"], int: ["S3"], OPEN: ["S4"] },
        goto: { E: 9, T: 2, int: 3, OPEN: 4 },
      },
      "5": {
        items: ["1  -  E -> T X • "],
        actions: { $end: ["R 1"], CLOSE: ["R 1"] },
        goto: {},
      },
      "6": {
        items: ["1  -  E ->  • T X", "2  -  X -> PLUS • E", "4  -  T ->  • int Y", "5  -  T ->  • OPEN E CLOSE"],
        actions: { E: ["10"], T: ["2"], int: ["S3"], OPEN: ["S4"] },
        goto: { E: 10, T: 2, int: 3, OPEN: 4 },
      },
      "7": {
        items: ["4  -  T -> int Y • "],
        actions: { $end: ["R 4"], PLUS: ["R 4"], CLOSE: ["R 4"] },
        goto: {},
      },
      "8": {
        items: ["4  -  T ->  • int Y", "5  -  T ->  • OPEN E CLOSE", "6  -  Y -> STAR • T"],
        actions: { T: ["11"], int: ["S3"], OPEN: ["S4"] },
        goto: { T: 11, int: 3, OPEN: 4 },
      },
      "9": {
        items: ["5  -  T -> OPEN E • CLOSE"],
        actions: { CLOSE: ["S12"] },
        goto: { CLOSE: 12 },
      },
      "10": {
        items: ["2  -  X -> PLUS E • "],
        actions: { $end: ["R 2"], CLOSE: ["R 2"] },
        goto: {},
      },
      "11": {
        items: ["6  -  Y -> STAR T • "],
        actions: { $end: ["R 6"], PLUS: ["R 6"], CLOSE: ["R 6"] },
        goto: {},
      },
      "12": {
        items: ["5  -  T -> OPEN E CLOSE • "],
        actions: { $end: ["R 5"], PLUS: ["R 5"], CLOSE: ["R 5"] },
        goto: {},
      },
    });
  });
});

describe("LALR Construction - Grammar Transformation Tests", () => {
  test("Case 1", () => {
    //
    const input = `
    S -> a g d ;
    S -> a A c ;
    S -> b A d ;
    S -> b g c ;
    A -> B ;
    B -> g ;
    `;
    const g = new DSLParser(input).grammar.augmentStartSymbol();
    const ig = new LR0ItemGraph(g).refresh();
    const g2 = grammarFromLR0ItemGraph(ig, g);
    expect(g2.debugValue).toEqual([
      "[0:S] -> [0:a] [2:g] [4:d]",
      "[0:S] -> [0:a] [2:A] [5:c]",
      "[0:S] -> [0:b] [3:A] [8:d]",
      "[0:S] -> [0:b] [3:g] [7:c]",
      "[2:A] -> [2:B]",
      "[2:B] -> [2:g]",
      "[3:A] -> [3:B]",
      "[3:B] -> [3:g]",
    ]);
    console.log("G2F: ", g2.followSets.debugValue);
    expect(g2.followSets.debugValue).toEqual({
      "[0:S]": "<$end>",
      "[2:A]": "<[5:c]>",
      "[2:B]": "<[5:c]>",
      "[3:A]": "<[8:d]>",
      "[3:B]": "<[8:d]>",
    });
  });
});
