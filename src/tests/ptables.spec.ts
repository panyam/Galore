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
  // test("dism - SLR", () => { testParseTable("./testcases/jison_dism.g", "./testcases/jison_dism.ptables", "slr", true); });
  // test("dism - LR", () => { testParseTable("./testcases/jison_dism.g", "./testcases/jison_dism.ptables", "lr1"); });
});

describe("LRItemSet", () => {
  test("Test with Null Productions", () => {
    /*
    verifyLRParseTable(
      "Null Prods",
      new EBNFParser(`S -> A | ;`).grammar.augmentStartSymbol(),
      makeSLRParseTable,
      {},
      true,
    );
    */
  });
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
      },
      "1": { items: ["Start -> E . "], actions: { "<EOF>": ["Acc"] } },
      "2": {
        items: ["E -> T . X", "X ->  . PLUS E", "X ->  . "],
        actions: {
          "<EOF>": ["R <X -> >"],
          X: ["5"],
          PLUS: ["S6"],
          CLOSE: ["R <X -> >"],
        },
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
      },
      "4": {
        items: ["E ->  . T X", "T -> OPEN . E CLOSE", "T ->  . int Y", "T ->  . OPEN E CLOSE"],
        actions: { E: ["9"], T: ["2"], int: ["S3"], OPEN: ["S4"] },
      },
      "5": {
        items: ["E -> T X . "],
        actions: { "<EOF>": ["R <E -> T X>"], CLOSE: ["R <E -> T X>"] },
      },
      "6": {
        items: ["E ->  . T X", "X -> PLUS . E", "T ->  . int Y", "T ->  . OPEN E CLOSE"],
        actions: { E: ["10"], T: ["2"], int: ["S3"], OPEN: ["S4"] },
      },
      "7": {
        items: ["T -> int Y . "],
        actions: {
          "<EOF>": ["R <T -> int Y>"],
          PLUS: ["R <T -> int Y>"],
          CLOSE: ["R <T -> int Y>"],
        },
      },
      "8": {
        items: ["Y -> STAR . T", "T ->  . int Y", "T ->  . OPEN E CLOSE"],
        actions: { T: ["11"], int: ["S3"], OPEN: ["S4"] },
      },
      "9": { items: ["T -> OPEN E . CLOSE"], actions: { CLOSE: ["S12"] } },
      "10": {
        items: ["X -> PLUS E . "],
        actions: { "<EOF>": ["R <X -> PLUS E>"], CLOSE: ["R <X -> PLUS E>"] },
      },
      "11": {
        items: ["Y -> STAR T . "],
        actions: {
          "<EOF>": ["R <Y -> STAR T>"],
          PLUS: ["R <Y -> STAR T>"],
          CLOSE: ["R <Y -> STAR T>"],
        },
      },
      "12": {
        items: ["T -> OPEN E CLOSE . "],
        actions: {
          "<EOF>": ["R <T -> OPEN E CLOSE>"],
          PLUS: ["R <T -> OPEN E CLOSE>"],
          CLOSE: ["R <T -> OPEN E CLOSE>"],
        },
      },
    });
  });

  test("Test2", () => {
    const parser = newParser(
      `
        S -> S A ;
        S -> ;

        A -> X ;
        A -> b X ;
        A -> c X ;

        X -> X x ;
        X -> ;
      `,
      "slr",
    );
    const v = mergedDebugValue(parser.parseTable, parser.itemGraph);
    expect(v).toEqual({
      "0": {
        items: ["Start ->  . S", "S ->  . S A", "S ->  . "],
        actions: {
          "<EOF>": ["R <S -> >"],
          S: ["1"],
          b: ["R <S -> >"],
          c: ["R <S -> >"],
          x: ["R <S -> >"],
        },
      },
      "1": {
        items: ["Start -> S . ", "S -> S . A", "A ->  . X", "A ->  . b X", "A ->  . c X", "X ->  . X x", "X ->  . "],
        actions: {
          "<EOF>": ["R <X -> >", "Acc"],
          A: ["2"],
          X: ["3"],
          b: ["S4", "R <X -> >"],
          c: ["S5", "R <X -> >"],
          x: ["R <X -> >"],
        },
      },
      "2": {
        items: ["S -> S A . "],
        actions: {
          "<EOF>": ["R <S -> S A>"],
          b: ["R <S -> S A>"],
          c: ["R <S -> S A>"],
          x: ["R <S -> S A>"],
        },
      },
      "3": {
        items: ["A -> X . ", "X -> X . x"],
        actions: {
          "<EOF>": ["R <A -> X>"],
          b: ["R <A -> X>"],
          c: ["R <A -> X>"],
          x: ["R <A -> X>", "S6"],
        },
      },
      "4": {
        items: ["A -> b . X", "X ->  . X x", "X ->  . "],
        actions: {
          "<EOF>": ["R <X -> >"],
          X: ["7"],
          b: ["R <X -> >"],
          c: ["R <X -> >"],
          x: ["R <X -> >"],
        },
      },
      "5": {
        items: ["A -> c . X", "X ->  . X x", "X ->  . "],
        actions: {
          "<EOF>": ["R <X -> >"],
          X: ["8"],
          b: ["R <X -> >"],
          c: ["R <X -> >"],
          x: ["R <X -> >"],
        },
      },
      "6": {
        items: ["X -> X x . "],
        actions: {
          "<EOF>": ["R <X -> X x>"],
          b: ["R <X -> X x>"],
          c: ["R <X -> X x>"],
          x: ["R <X -> X x>"],
        },
      },
      "7": {
        items: ["X -> X . x", "A -> b X . "],
        actions: {
          "<EOF>": ["R <A -> b X>"],
          b: ["R <A -> b X>"],
          c: ["R <A -> b X>"],
          x: ["S6", "R <A -> b X>"],
        },
      },
      "8": {
        items: ["X -> X . x", "A -> c X . "],
        actions: {
          "<EOF>": ["R <A -> c X>"],
          b: ["R <A -> c X>"],
          c: ["R <A -> c X>"],
          x: ["S6", "R <A -> c X>"],
        },
      },
    });
  });
});
