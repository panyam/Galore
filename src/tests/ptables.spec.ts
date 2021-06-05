import { testParseTable } from "./utils";
import { newParser } from "../factory";
import { mergedDebugValue } from "../debug";

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
    const [parser, _] = newParser(
      `
        E -> T X ;
        X -> PLUS E | ;
        T -> int Y | OPEN E CLOSE ;
        Y -> STAR T | ;
      `,
      { type: "slr" },
    );
    const v = mergedDebugValue(parser.parseTable);
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
