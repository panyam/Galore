import * as fs from "fs";
import * as TSU from "@panyam/tsutils";
import { newParser, logParserDebug } from "../src/tests/utils";

const args = process.argv.slice(2);
const path = args[0];
const contents = fs.readFileSync(path, "utf8");
const ptabtype = args[1] || "slr";
console.log("Parser Type: ", ptabtype);
const t1 = Date.now();
const parser = newParser(contents, ptabtype);
const t2 = Date.now();
logParserDebug(parser);
console.log(`${ptabtype} Parser Generation Time: ${t2 - t1}ms`);
