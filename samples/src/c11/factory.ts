import * as TLEX from "tlex";
import * as G from "galore";
import { GRAMMAR } from "./";

export const newParser = (params?: any): [G.LR.Parser, null | TLEX.NextTokenFunc] => G.newLRParser(GRAMMAR, params);
