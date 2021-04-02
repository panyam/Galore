export enum Cardinality {
  ATMOST_1 = -2,
  ATLEAST_0 = -1,
  EXACTLY_1 = 1,
  ATLEAST_1 = 2,
}

export function multiplyCardinalities(c1: Cardinality, c2: Cardinality): Cardinality {
  // * . X = *
  // X. * = *
  if (c1 == Cardinality.ATLEAST_0 || c2 == Cardinality.ATLEAST_0) return Cardinality.ATLEAST_0;

  // 1. X = X
  if (c1 == Cardinality.EXACTLY_1) return c2;

  // X . 1 = X
  if (c2 == Cardinality.EXACTLY_1) return c1;

  // X . X = X
  if (c1 == c2) return c1;

  return Cardinality.ATLEAST_0;
}
