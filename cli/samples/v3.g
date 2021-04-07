
Elements -> Elements Element ;
Elements -> ;

Element -> Atoms ;
Element -> RoleSelector ;
Element -> Command ;

Command -> BSLASH_IDENT ;
Command -> BSLASH_IDENT CommandParams ;
CommandParams  -> OPEN_PAREN  CLOSE_PAREN ;
CommandParams -> OPEN_PAREN ParamList CLOSE_PAREN ;

ParamList -> Param ;
ParamList -> ParamList COMMA Param ;
Param -> ParamKey ;
Param -> ParamKey EQUALS ParamValue ;
ParamKey  -> STRING ;
ParamKey  -> Fraction ;
ParamKey  -> IDENT ;
ParamValue -> STRING ;
ParamValue -> Fraction ;
ParamValue -> IDENT ;

RoleSelector -> IDENT_COLON ;

Atoms -> Atoms Atom ;
Atoms -> Atom ;

Atom -> Duration Leaf ;
Atom -> Leaf ;

Leaf -> Group ;
Leaf -> Space ;
Leaf -> Lit ;

Space -> COMMA ;
Space -> SEMI_COLON ;
Space -> UNDER_SCORE ;

Lit -> DOT_IDENT ;
Lit -> IDENT ;
Lit -> IDENT_DOT ;
Lit -> STRING ;
Group -> OPEN_SQ Atoms CLOSE_SQ ;

Duration -> Fraction ;
Fraction -> NUMBER ;
Fraction -> NUMBER SLASH NUMBER ;
