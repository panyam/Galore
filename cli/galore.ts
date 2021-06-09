const util = require("util");
const fs = require("fs");
const yargs = require("yargs");
import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { newParser } from "../src/factory";
import { PTNode } from "../src/parser";
import { Parser } from "../src/lr";
import { parseTableToHtml } from "../src/printers";
import Grammars from "./samples/grammars";

function loadParser(lang: string, grammarFile?: string, ptype = "lr1") {
  return measureTime(`Parser Creation Time (type = ${ptype}): `, () => {
    if (lang) {
      return (Grammars as any)[lang].newParser({ type: ptype });
    } else {
      return newParser(fs.readFileSync(grammarFile, "utf8"), { type: ptype });
    }
  });
}

function tokenizeAll(tokenFunc: TLEX.NextTokenFunc, tape: TLEX.Tape): TLEX.Token[] {
  const out = [];
  let next = tokenFunc(tape);
  while (next) {
    out.push(next);
    next = tokenFunc(tape);
  }
  return out;
}

function measureTime(log: string, method: any): [any, number] {
  const startTime = Date.now();
  const result = method();
  const endTime = Date.now();
  const delta = endTime - startTime;
  console.log(log, delta);
  return [result, delta];
}

function writeResults(outDir: string, parser: Parser, result?: PTNode): void {
  outDir = (outDir || ".").trim();
  if (outDir != ".") fs.mkdirSync(outDir, { recursive: true });
  const ptablePath = outDir + "/" + "ptable.html";
  console.log("Writing parse table to: ", ptablePath);
  fs.writeFileSync(
    ptablePath,
    `
    <html><head><title>Parse Table</title></head>
    <body>
      <h2><center>Parse Table</center></h2>
      <div>${parseTableToHtml(parser.parseTable)}</div>
    </body>
    </html>
    `,
  );
  if (result) {
    const ptreePath = outDir + "/" + "ptree.out";
    console.log("Writing parse tree (pretty) to: ", ptreePath);
    fs.writeFileSync(ptreePath, result?.reprString);

    const ptreeJsonPath = outDir + "/" + "ptree.json";
    const dVal = util.inspect(result?.debugValue(true), {
      showHidden: false,
      depth: null,
      maxArrayLength: null,
      maxStringLength: null,
    });
    console.log("Writing parse tree (json) to: ", ptreeJsonPath);
    fs.writeFileSync(ptreeJsonPath, dVal);
  }
}

const ptableTypeOption = {
  alias: "ptableType",
  describe: "Type of parse table to generate",
  default: "lr1",
  type: "string",
  choices: ["lr1", "slr"],
};
const debugOption = {
  alias: "debug",
  describe: "Whether to print extra debug information",
  default: true,
  type: "boolean",
};
const inputFileOption = {
  describe: "Input file to parse",
  type: "string",
};
const grammarFileOption = {
  alias: "grammarFile",
  describe:
    "File containing the grammar and tokenizer spec.  Only needed if a custom grammar beyond the language flag is required.",
  type: "string",
};
const outDirOption = {
  alias: "outDir",
  describe: "Output directory where all artifacts are written to",
  type: "string",
};
const languageOption = {
  alias: "language",
  describe: "Language grammar to be used",
  type: "string",
  choices: ["json", "c11"],
};

const argv = yargs(process.argv.slice(2))
  .usage("usage: $0 <options> inputFile outputFile")
  .strictCommands(true)
  .command(
    "tokenize [inputFile]",
    "Tokenizes an input and file and only prints out tokens",
    (yargs: any) => {
      yargs
        .option("d", debugOption)
        .positional("inputFile", inputFileOption)
        .positional("l", languageOption)
        .positional("g", grammarFileOption)
        .help("help");
    },
    (argv: any) => {
      console.log("Argv: ", argv);
      const payload = fs.readFileSync(argv.inputFile, "utf8");
      const [[parser, tokenizer], t0] = loadParser(argv.language, argv.grammarFile, argv.ptableType);
      const [tokens, t1] = measureTime("Tokenizer Time: ", () => tokenizeAll(tokenizer!, new TLEX.Tape(payload)));
      console.log("Num Tokens: ", tokens.length);
    },
  )
  .command(
    "ptable",
    "Generate parse tables for a given grammar",
    (yargs: any) => {
      yargs
        .option("d", debugOption)
        .positional("l", languageOption)
        .positional("o", outDirOption)
        .positional("g", grammarFileOption)
        .positional("t", ptableTypeOption)
        .help("help");
    },
    (argv: any) => {
      console.log("Argv: ", argv);
      const [[parser, tokenizer], t0] = loadParser(argv.language, argv.grammarFile, argv.ptableType);
      writeResults(argv.outDir, parser);
    },
  )
  .command(
    "parse [inputFile]",
    "Parses an input file based on the given grammar",
    (yargs: any) => {
      yargs
        .option("d", debugOption)
        .positional("inputFile", inputFileOption)
        .positional("l", languageOption)
        .positional("o", outDirOption)
        .positional("g", grammarFileOption)
        .positional("t", ptableTypeOption)
        .help("help");
    },
    (argv: any) => {
      console.log("Argv: ", argv);
      const payload = fs.readFileSync(argv.inputFile, "utf8");
      const [[parser, tokenizer], t0] = loadParser(argv.language, argv.grammarFile, argv.ptableType);
      const [result, t2] = measureTime("Parse Time: ", () => parser.parse(payload));
      writeResults(argv.outDir, parser, result);
    },
  )
  .help("help")
  .wrap(null).argv;
