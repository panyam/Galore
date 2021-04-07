stmt -> if expr then stmt else stmt
     | if expr then stmt
     | expr QMARK stmt stmt
     | arr OSQ expr CSQ ASGN  expr
     ;
expr -> num | expr PLUS  expr ;
num -> DIGIT | num DIGIT ;
