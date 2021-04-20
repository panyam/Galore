import * as fs from "fs";
import * as TSU from "@panyam/tsutils";
import { Rule } from "../core";
import { Prog } from "../vm";
import { Tape } from "../../tape";
import { InstrDebugValue, VM } from "../pikevm";
import { Lexer } from "../lexer";
import { compile, VMTracer, layoutThreadNodes } from "./utils";

function testInput(
  prog: Prog,
  input: string,
  expectedTokens: [string, number][],
  debug = false,
  reportFile: TSU.Nullable<string> = null,
): void {
  const tape = new Tape(input);
  const vm = new VM(prog);
  const tracer = new VMTracer();
  if (debug) {
    console.log(
      "Prog: \n",
      `${prog.debugValue(InstrDebugValue).join("\n")}`,
      "\n",
      "\n",
      "Input: ",
      input,
      "\n",
      "Expected Tokens: ",
      expectedTokens,
    );
    vm.tracer = tracer;
  }
  const found = [] as [string, number][];
  let next = vm.match(tape);
  while (next != null && next.end > next.start) {
    found.push([tape.substring(next.start, next.end), next.matchIndex]);
    next = vm.match(tape);
  }
  if (debug) {
    console.log("VM Tracer: ");
    // console.log(tracer.trace.join("\n"));
    console.log("Found Tokens: ", found);
    const reportHtml = `<html>
        <head>
          <style>
            .threadInstrsCell  { padding-left: 10px; padding-right: 10px; vertical-align: top; }
            .inputCharCell { font-weight: bold; text-align: center; }
            .threadIdCell { font-weight: bold; text-align: left; vertical-align: top; }
          </style>
        </head>
        <body>${layoutThreadNodes(input, tracer.allThreadNodes)}</body>
       </html>`;
    if (reportFile != null) {
      if (reportFile.trim().length > 0) {
        fs.writeFileSync(reportFile, reportHtml);
      } else {
        console.log(reportHtml);
      }
    }
  }
  expect(found).toEqual(expectedTokens);
}

function jsonLexer(): Lexer {
  const lexer = new Lexer();
  const AnyOf = (...x: string[]) => x.join("|");
  // JSON5NumericLiteral:
  lexer.add(new Rule(AnyOf("Infinity", "NaN", "<NumericLiteral>"), "JSON5NumericLiteral"));

  lexer.addVar("NumericLiteral", "<DecimalLiteral>|<HexIntegerLiteral>");
  lexer.addVar(
    "DecimalLiteral",
    AnyOf(
      "(<DecimalIntegerLiteral>.<DecimalDigits>?<ExponentPart>?)",
      "(.<DecimalDigits><ExponentPart>?)",
      "(<DecimalIntegerLiteral><ExponentPart>?)",
    ),
  );
  lexer.addVar("DecimalIntegerLiteral", AnyOf("0", "<NonZeroDigit><DecimalDigits>"));
  lexer.addVar("DecimalDigits", "<DecimalDigit>+");
  lexer.addVar("DecimalDigit", "[0-9]");
  lexer.addVar("NonZeroDigit", "[1-9]");
  lexer.addVar("ExponentPart", "<ExponentIndicator><SignedPart>");
  lexer.addVar("ExponentIndicator", "e|E");
  lexer.addVar("SignedInteger", AnyOf("<DecimalDigits>", "[\\-\\+]<DecimalDigits>"));
  lexer.addVar("HexIntegerLiteral", "0[xX]<HexDigit>+");
  lexer.addVar("HexDigit", "[0-9a-fA-F]");

  // JSON5String:
  lexer.add(new Rule(AnyOf("<JSON5SingleQuoteString>", "<JSON5DoubleQuoteString>"), "JSON5String"));
  lexer.addVar("JSON5SingleQuoteString", "'<JSONSingleQuoteStringChar>*'");
  lexer.addVar("JSON5DoubleQuoteString", "'<JSONDoubleQuoteStringChar>*'");
  lexer.addVar("JSONSingleQuoteStringChar", AnyOf("(^('|\\|<LineTerminator>))", "<JSON5MiscStringChar>"));
  lexer.addVar("JSONDoubleQuoteStringChar", AnyOf('(^("|\\|<LineTerminator>))', "<JSON5MiscStringChar>"));
  lexer.addVar("JSON5MiscStringChar", AnyOf("\u2028", "\u2029", "<LineContinuation>", "\\<EscapeSequence>"));

  // JSON5Comment - single and multi line
  lexer.add(new Rule(AnyOf("//.*$", `/\\*(^\\*/)*\\*/`), "JSON5Comment"));

  // JSON5 Literals
  lexer.add(new Rule("null", "NULL"));
  lexer.add(new Rule("true|false", "JSON5Boolean"));

  // operator tokens
  lexer.add(new Rule(",", "COMMA"));
  lexer.add(new Rule(":", "COLON"));
  lexer.add(new Rule("\\[", "OSQ"));
  lexer.add(new Rule("\\]", "CSQ"));
  lexer.add(new Rule("\\{", "OBRACE"));
  lexer.add(new Rule("\\}", "CBRACE"));

  // Spaces - Indicate these are to be skipped
  lexer.add(new Rule("[ \t\n\r]+", "SPACES"));

  // Default error rule
  lexer.add(new Rule(".", "ERROR"));
  return lexer;
}

const lexer = jsonLexer();

describe("JSON Tests", () => {
  test("Test Chars", () => {
    const prog = compile(null, "abcde");
    testInput(prog, "abcdeabcde", [
      ["abcde", 0],
      ["abcde", 0],
    ]);
  });

  test("Test Chars Classes", () => {
    const prog = compile(null, "[a-e]");
    testInput(prog, "abcdeabcde", [
      ["a", 0],
      ["b", 0],
      ["c", 0],
      ["d", 0],
      ["e", 0],
      ["a", 0],
      ["b", 0],
      ["c", 0],
      ["d", 0],
      ["e", 0],
    ]);
  });

  test("Test a|aa|aaa with priority", () => {
    const prog = compile(null, new Rule("a", 0, 100), "aa", "aaa");
    testInput(prog, "aaaa", [
      ["a", 0],
      ["a", 0],
      ["a", 0],
      ["a", 0],
    ]);
  });

  test("Test a|aa|aaa without priority", () => {
    const prog = compile(null, "a", "aa", "aaa");
    testInput(prog, "aaaa", [
      ["aaa", 2],
      ["a", 0],
    ]);
  });

  test("Test a*", () => {
    const prog = compile(null, "a*");
    testInput(prog, "aaaaa", [["aaaaa", 0]]);
  });

  test("Test (a|b)*", () => {
    const prog = compile(null, "(a|b)*");
    testInput(prog, "abbbaaaba", [["abbbaaaba", 0]]);
  });

  test("Test (a|b){0, 10}?", () => {
    const prog = compile(null, "(a|b){0,2}?");
    testInput(prog, "abbbaaaba", [
      ["ab", 0],
      ["bb", 0],
      ["aa", 0],
      ["ab", 0],
      ["a", 0],
    ]);
  });

  test("Test a,b,c,d,e", () => {
    const prog = compile(null, "a", "b", "c", "d", "e");
    testInput(prog, "edcbaabcde", [
      ["e", 4],
      ["d", 3],
      ["c", 2],
      ["b", 1],
      ["a", 0],
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 3],
      ["e", 4],
    ]);
  });

  test("Test a*? | aa without priority", () => {
    const prog = compile(null, "a*?", "aa");
    testInput(prog, "aaaaa", [["aaaaa", 0]]);
  });

  test("Test a*? | aa with priority", () => {
    const prog = compile(null, "a*?", new Rule("aa", 1, 20));
    testInput(prog, "aaaaa", [
      ["aa", 1],
      ["aa", 1],
      ["a", 0],
    ]);
  });

  test("Test (a|b){0, 10}(a|b){5,10}", () => {
    const prog = compile(null, "(a){0, 10}(a|b){5,10}");
    testInput(prog, "abbbaaaba", [["abbbaaaba", 0]]);
  });

  test("Test Comments", () => {
    const prog = compile(null, `/\\*(^\\*/)*\\*/`, `[ \t\n\r]+`);
    // const prog = compile(null, `/\*.*\*/`, `\"(?<!\\\\)\"`, "//.*$");
    testInput(
      prog,
      `/* hello comment in one line */   /** How about multi line?
              
              */  `,
      [
        ["/* hello comment in one line */", 0],
        ["   ", 1],
        ["/** How about multi line?\n              \n              */", 0],
        ["  ", 1],
      ],
      true,
      "/tmp/test.html",
    );
  });

  test("Test Lines", () => {
    const prog = compile(
      null,
      new Rule("^ *a+", 0, 20),
      new Rule("b*$", 1, 15),
      new Rule(`[\n\r]+`, 3, 10),
      new Rule(`[ \t]+`, 2, 10),
      new Rule(".", 4, 0),
    );
    testInput(
      prog,
      `
      aaaaabcdefgh
      bbbbb
      ccc\n   \n\n\n`,
      [
        ["\n", 2],
        ["      aaaaa", 0],
        ["b", 4],
        ["c", 4],
        ["d", 4],
        ["e", 4],
        ["f", 4],
        ["g", 4],
        ["h", 4],
        ["\n", 2],
        ["      ", 3],
        ["bbbbb", 1],
        ["\n", 2],
        ["      ", 3],
        ["c", 4],
        ["c", 4],
        ["c", 4],
        ["\n", 2],
        ["   ", 3],
        ["\n\n\n", 2],
      ],
    );
  });
});
