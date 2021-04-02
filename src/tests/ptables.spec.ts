import { EBNFParser } from "../ebnf";
import { testParseTable } from "./utils";

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
});
