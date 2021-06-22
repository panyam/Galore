const fs = require("fs");
const yargs = require("yargs");
import * as TLEX from "tlex";
import { measureTime, writeResults, tokenizeAll } from "./utils";
import { Grammars } from "./";
import { newLRParser } from "../../src/factory";
import { Parser } from "../../src/lr";

export class CLI {
  // Input to be parsed
  constructor(public parser: Parser, public tokenizer: TLEX.NextTokenFunc) {}

  tokenize(input: string): void {
    // const payload = fs.readFileSync(argv.inputFile, "utf8");
    const [tokens, t1] = measureTime("Tokenizer Time: ", () => tokenizeAll(this.tokenizer, new TLEX.Tape(input)));
    console.log("Num Tokens: ", tokens.length);
    console.log("Tokens: ", tokens);
  }

  parse(input: string, outdir: string): void {
    const [result, _] = measureTime("Parse Time: ", () => this.parser.parse(input));
    writeResults(outdir, this.parser.parseTable, result);
  }

  dump(outdir: string): void {
    writeResults(outdir, this.parser.parseTable);
  }
}

export function loadParser(argv: any) {
  const ptype = argv.ptableType;
  return measureTime(`Parser Creation Time (type = ${ptype}): `, () => {
    if (argv.language) {
      return (Grammars as any)[argv.language].newParser({ type: ptype });
    } else {
      return newLRParser(fs.readFileSync(argv.grammarFile, "utf8"), { type: ptype });
    }
  });
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

export function makeCli(args: string[], parserLoader: any) {
  return yargs(process.argv.slice(2))
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
        const [[parser, tokenizer], t0] = parserLoader(argv);
        new CLI(parser, tokenizer).tokenize(fs.readFileSync(argv.inputFile, "utf8"));
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
        const [[parser, tokenizer], t0] = parserLoader(argv);
        new CLI(parser, tokenizer).dump(argv.outDir);
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
        const [[parser, tokenizer], t0] = parserLoader(argv);
        new CLI(parser, tokenizer).parse(argv.outDir, fs.readFileSync(argv.inputFile, "utf8"));
      },
    )
    .help("help")
    .wrap(null).argv;
}
