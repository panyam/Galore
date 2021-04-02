export default {
  Sample1: `
      S -> A C A | C A | A A | A C | A | C | ;
      A -> a A | a;
      B -> b B | b;
      C -> c C | c;
  `,
  Sample2: `
      S -> A C A ;
      A -> a A a | B | C ;
      B -> b B | b ;
      C -> c C | ;
  `,
  Sample3: `
      S -> A B C | a A | ;
      A -> a A | ;
      B -> b B | ;
      C -> c C | ;
  `,
  Sample4: `
      S -> T U V W | W V U T ;
      T -> a T | e ;
      U -> U b | f ;
      V -> c V | ;
      W -> W d | ;
  `,
  Sample5: `
      S -> A C A ;
      A -> a A a | B | C ;
      B -> b B | b ;
      C -> c C | c ;
  `,
  expr1: `
      S -> exp STOP ;
      exp -> term exptail ;
      exptail -> OPA term exptail | ;
      term -> sfactor termtail ;
      termtail -> OPM factor termtail | ;
      sfactor -> OPA factor | factor ;
      factor -> NUM | LP exp RP ;
  `,
  expr2: `
      E -> T E1 ;
      E1 -> PLUS T E1 | ;
      T  -> F T1 ;
      T1 -> STAR F T1 | ;
      F  -> OPEN E CLOSE | id ;
  `,
};
