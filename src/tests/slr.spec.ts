import { newParser } from "../factory";
import { mergedDebugValue } from "../debug";

describe("LR ParseTable", () => {
  test("Test Basic", () => {
    const [parser, _] = newParser(
      `
        E -> E PLUS T | T ;
        T -> T STAR F | F ;
        F -> OPEN E CLOSE | id ;
      `,
      { type: "slr" },
    );
    const v = mergedDebugValue(parser.parseTable);
    expect(v).toEqual({
      "0": {
        items: [
          "0  -  $accept ->  • E",
          "1  -  E ->  • E PLUS T",
          "2  -  E ->  • T",
          "3  -  T ->  • T STAR F",
          "4  -  T ->  • F",
          "5  -  F ->  • OPEN E CLOSE",
          "6  -  F ->  • id",
        ],
        actions: {
          E: ["1"],
          T: ["2"],
          F: ["3"],
          OPEN: ["S4"],
          id: ["S5"],
        },
        goto: { E: 1, T: 2, F: 3, OPEN: 4, id: 5 },
      },
      "1": {
        items: ["0  -  $accept -> E • ", "1  -  E -> E • PLUS T"],
        actions: { $end: ["Acc"], PLUS: ["S6"] },
        goto: { PLUS: 6 },
      },
      "2": {
        items: ["2  -  E -> T • ", "3  -  T -> T • STAR F"],
        actions: {
          $end: ["R 2"],
          PLUS: ["R 2"],
          STAR: ["S7"],
          CLOSE: ["R 2"],
        },
        goto: { STAR: 7 },
      },
      "3": {
        items: ["4  -  T -> F • "],
        actions: {
          $end: ["R 4"],
          PLUS: ["R 4"],
          STAR: ["R 4"],
          CLOSE: ["R 4"],
        },
        goto: {},
      },
      "4": {
        items: [
          "1  -  E ->  • E PLUS T",
          "2  -  E ->  • T",
          "3  -  T ->  • T STAR F",
          "4  -  T ->  • F",
          "5  -  F ->  • OPEN E CLOSE",
          "5  -  F -> OPEN • E CLOSE",
          "6  -  F ->  • id",
        ],
        actions: {
          E: ["8"],
          T: ["2"],
          F: ["3"],
          OPEN: ["S4"],
          id: ["S5"],
        },
        goto: { E: 8, T: 2, F: 3, OPEN: 4, id: 5 },
      },
      "5": {
        items: ["6  -  F -> id • "],
        actions: {
          $end: ["R 6"],
          PLUS: ["R 6"],
          STAR: ["R 6"],
          CLOSE: ["R 6"],
        },
        goto: {},
      },
      "6": {
        items: [
          "1  -  E -> E PLUS • T",
          "3  -  T ->  • T STAR F",
          "4  -  T ->  • F",
          "5  -  F ->  • OPEN E CLOSE",
          "6  -  F ->  • id",
        ],
        actions: { T: ["9"], F: ["3"], OPEN: ["S4"], id: ["S5"] },
        goto: { T: 9, F: 3, OPEN: 4, id: 5 },
      },
      "7": {
        items: ["3  -  T -> T STAR • F", "5  -  F ->  • OPEN E CLOSE", "6  -  F ->  • id"],
        actions: { F: ["10"], OPEN: ["S4"], id: ["S5"] },
        goto: { F: 10, OPEN: 4, id: 5 },
      },
      "8": {
        items: ["1  -  E -> E • PLUS T", "5  -  F -> OPEN E • CLOSE"],
        actions: { PLUS: ["S6"], CLOSE: ["S11"] },
        goto: { PLUS: 6, CLOSE: 11 },
      },
      "9": {
        items: ["1  -  E -> E PLUS T • ", "3  -  T -> T • STAR F"],
        actions: {
          $end: ["R 1"],
          PLUS: ["R 1"],
          STAR: ["S7"],
          CLOSE: ["R 1"],
        },
        goto: { STAR: 7 },
      },
      "10": {
        items: ["3  -  T -> T STAR F • "],
        actions: {
          $end: ["R 3"],
          PLUS: ["R 3"],
          STAR: ["R 3"],
          CLOSE: ["R 3"],
        },
        goto: {},
      },
      "11": {
        items: ["5  -  F -> OPEN E CLOSE • "],
        actions: {
          $end: ["R 5"],
          PLUS: ["R 5"],
          STAR: ["R 5"],
          CLOSE: ["R 5"],
        },
        goto: {},
      },
    });
  });
});
