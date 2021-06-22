const fs = require("fs");
const yargs = require("yargs");
import { makeCli } from "../cli";
import { newLRParser } from "../../../src/factory";
import { GRAMMAR } from "./data";

makeCli(process.argv.slice(2), (argv: any) => newLRParser(GRAMMAR, { ptype: argv.ptableType }));
