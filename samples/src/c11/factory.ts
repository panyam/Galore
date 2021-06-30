import * as TLEX from "tlex";
import * as G from "galore";
import { GRAMMAR } from "./";

export const newParser = (params?: any): [G.Parser, null | TLEX.NextTokenFunc, null | G.LRItemGraph] =>
  G.newParser(GRAMMAR, params);
