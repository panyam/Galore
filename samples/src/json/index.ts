import * as G from "galore";
export * from "./data";
import { GRAMMAR } from "./data";

export const newParser = G.newLRParser.bind(null, GRAMMAR);
