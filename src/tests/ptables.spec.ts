import { testParseTable, newParser, mergedDebugValue } from "./utils";

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
  test("2.2.2 - SLR", () => {
    testParseTable("./testcases/tomita_2.2.2.g", "./testcases/tomita_2.2.2.ptables", "slr");
  });
  test("3.3 - SLR", () => {
    testParseTable("./testcases/tomita_3.3.g", "./testcases/tomita_3.3.ptables", "slr");
  });
  test("2.2.1 - LR", () => {
    testParseTable("./testcases/tomita_2.2.1.g", "./testcases/tomita_2.2.1.ptables", "lr1");
  });
  test("2.2.2 - LR", () => {
    testParseTable("./testcases/tomita_2.2.2.g", "./testcases/tomita_2.2.2.ptables", "lr1");
  });
  test("3.3 - LR", () => {
    testParseTable("./testcases/tomita_3.3.g", "./testcases/tomita_3.3.ptables", "lr1");
  });
});

describe("Jison tests", () => {
  test("basic - SLR", () => {
    testParseTable("./testcases/jison_basic.g", "./testcases/jison_basic.ptables", "slr");
  });
  test("dism - SLR", () => {
    testParseTable("./testcases/jison_dism.g", "./testcases/jison_dism.ptables", "slr");
  });
  test("RR Conflict - SLR", () => {
    testParseTable("./testcases/jison_rrconflict.g", "./testcases/jison_rrconflict.ptables", "slr");
  });
  test("basic - LR", () => {
    testParseTable("./testcases/jison_basic.g", "./testcases/jison_basic.ptables", "lr1");
  });
  test("dism - LR", () => {
    testParseTable("./testcases/jison_dism.g", "./testcases/jison_dism.ptables", "lr1");
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
    const parser = newParser(
      `
        E -> T X ;
        X -> PLUS E | ;
        T -> int Y | OPEN E CLOSE ;
        Y -> STAR T | ;
      `,
      "slr",
    );
    const v = mergedDebugValue(parser.parseTable, parser.itemGraph);
    expect(v).toEqual({
      "0": {
        items: ["Start ->  . E", "E ->  . T X", "T ->  . int Y", "T ->  . OPEN E CLOSE"],
        actions: { E: ["1"], T: ["2"], int: ["S3"], OPEN: ["S4"] },
        goto: { E: 1, T: 2, int: 3, OPEN: 4 },
      },
      "1": {
        items: ["Start -> E . "],
        actions: { "<EOF>": ["Acc"] },
        goto: {},
      },
      "2": {
        items: ["E -> T . X", "X ->  . PLUS E", "X ->  . "],
        actions: {
          "<EOF>": ["R <X -> >"],
          X: ["5"],
          PLUS: ["S6"],
          CLOSE: ["R <X -> >"],
        },
        goto: { X: 5, PLUS: 6 },
      },
      "3": {
        items: ["Y ->  . ", "T -> int . Y", "Y ->  . STAR T"],
        actions: {
          "<EOF>": ["R <Y -> >"],
          PLUS: ["R <Y -> >"],
          Y: ["7"],
          CLOSE: ["R <Y -> >"],
          STAR: ["S8"],
        },
        goto: { Y: 7, STAR: 8 },
      },
      "4": {
        items: ["E ->  . T X", "T -> OPEN . E CLOSE", "T ->  . int Y", "T ->  . OPEN E CLOSE"],
        actions: { E: ["9"], T: ["2"], int: ["S3"], OPEN: ["S4"] },
        goto: { E: 9, T: 2, int: 3, OPEN: 4 },
      },
      "5": {
        items: ["E -> T X . "],
        actions: { "<EOF>": ["R <E -> T X>"], CLOSE: ["R <E -> T X>"] },
        goto: {},
      },
      "6": {
        items: ["E ->  . T X", "X -> PLUS . E", "T ->  . int Y", "T ->  . OPEN E CLOSE"],
        actions: { E: ["10"], T: ["2"], int: ["S3"], OPEN: ["S4"] },
        goto: { E: 10, T: 2, int: 3, OPEN: 4 },
      },
      "7": {
        items: ["T -> int Y . "],
        actions: {
          "<EOF>": ["R <T -> int Y>"],
          PLUS: ["R <T -> int Y>"],
          CLOSE: ["R <T -> int Y>"],
        },
        goto: {},
      },
      "8": {
        items: ["Y -> STAR . T", "T ->  . int Y", "T ->  . OPEN E CLOSE"],
        actions: { T: ["11"], int: ["S3"], OPEN: ["S4"] },
        goto: { T: 11, int: 3, OPEN: 4 },
      },
      "9": {
        items: ["T -> OPEN E . CLOSE"],
        actions: { CLOSE: ["S12"] },
        goto: { CLOSE: 12 },
      },
      "10": {
        items: ["X -> PLUS E . "],
        actions: { "<EOF>": ["R <X -> PLUS E>"], CLOSE: ["R <X -> PLUS E>"] },
        goto: {},
      },
      "11": {
        items: ["Y -> STAR T . "],
        actions: {
          "<EOF>": ["R <Y -> STAR T>"],
          PLUS: ["R <Y -> STAR T>"],
          CLOSE: ["R <Y -> STAR T>"],
        },
        goto: {},
      },
      "12": {
        items: ["T -> OPEN E CLOSE . "],
        actions: {
          "<EOF>": ["R <T -> OPEN E CLOSE>"],
          PLUS: ["R <T -> OPEN E CLOSE>"],
          CLOSE: ["R <T -> OPEN E CLOSE>"],
        },
        goto: {},
      },
    });
  });
});
