const util = require("util");
const fs = require("fs");
const yargs = require("yargs");
import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";
import { newParser } from "../src/factory";
import Grammars from "./samples/grammars";

function loadParser(lang: string, grammarFile?: string, ptype = "lr1") {
  return measureTime("Parser Creation Time: ", () => {
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
const outputDirOption = {
  alias: "outputDir",
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
        .positional("o", outputDirOption)
        .positional("g", grammarFileOption)
        .help("help");
    },
    (argv: any) => {
      console.log("Argv: ", argv);
      const payload = fs.readFileSync(argv.inputFile, "utf8");
      const [[parser, tokenizer], t0] = loadParser(argv.language, argv.grammarFile, argv.parserType);
      const [tokens, t1] = measureTime("Tokenizer Time: ", () => tokenizeAll(tokenizer!, new TLEX.Tape(payload)));
      console.log("Num Tokens: ", tokens.length);
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
        .positional("o", outputDirOption)
        .positional("g", grammarFileOption)
        .help("help");
    },
    (argv: any) => {
      console.log("Argv: ", argv);
      const payload = fs.readFileSync(argv.inputFile, "utf8");
      const [[parser, tokenizer], t0] = loadParser(argv.language, argv.grammarFile, argv.parserType);
      const [result, t2] = measureTime("Parse Time: ", () => parser.parse(payload));
      if (true) {
        console.log("Parse Tree: ");
        const dVal = util.inspect(result?.debugValue(true), {
          showHidden: false,
          depth: null,
          maxArrayLength: null,
          maxStringLength: null,
        });
        console.log(dVal);
        console.log(result?.reprString);
        console.log(
          "Value: ",
          util.inspect(result?.value, {
            showHidden: false,
            depth: null,
            maxArrayLength: null,
            maxStringLength: null,
          }),
        );
      }
    },
  )
  .help("help")
  .wrap(null).argv;
