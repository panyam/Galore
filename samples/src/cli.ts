const fs = require("fs");
const yargs = require("yargs");
import * as TLEX from "tlex";
import { measureTime, writeResults, tokenizeAll } from "./utils";

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

abstract class CLI {
  payload: string;
  abstract loadParser(): any;

  constructor(public inputFile: string) {
    this.payload = fs.readFileSync(inputFile, "utf8");
  }

  tokenizeAll(payload: string): void {
    const [[parser, tokenizer], t0] = loadParser(argv.language, argv.grammarFile, argv.ptableType);
    const [tokens, t1] = measureTime("Tokenizer Time: ", () => tokenizeAll(tokenizer!, new TLEX.Tape(payload)));
    console.log("Num Tokens: ", tokens.length);
    console.log("Tokens: ", tokens);
  }
}

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
      console.log("Tokens: ", tokens);
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
