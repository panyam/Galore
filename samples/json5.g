
%skip   /[ \t\n\f\r]+/   // white spaces
%skip   /\/\*.*\*\//     // Multi line comments
%skip   /\/\/.*$/        // single line comments

JSON5Value -> JSON5Null
            | JSON5Boolean
            | JSON5String
            | JSON5Number
            | JSON5Object
            | JSON5Array
            ;
 
JSON5Object -> "{" "}" | "{" JSON5MemberList "," ? "}" ;

JSON5MemberList -> JSON5Member | JSON5MemberList "," JSON5Member ;

JSON5Member -> JSON5MemberName ":" JSON5Value ;

JSON5MemberName -> JSON5Identifier | JSON5String ;

JSON5Array  -> "[" "]" 
            | "[" JSON5ElementList "," ? "]"
            ;

JSON5ElementList -> JSON5Value | JSON5ElementList "," JSON5Value ;

JSON5Number ->      JSON5NumericLiteral
            |   "+" JSON5NumericLiteral
            |   "-" JSON5NumericLiteral
            ;

JSON5NumericLiteral -> NumericLiteral | "Infinity" | "NaN" ;

JSON5String -> /"<JSON5DoubleStringCharacter>*"/
            | /"<JSON5SingleStringCharacter>*"/
            ;

JSON5DoubleStringCharacter -> /([^"<LineTerminator>\\]|\U2028|\U2029|<LineContinuation>|\\<EscapeSequence>)/ ;
JSON5SingleStringCharacter -> /([^'<LineTerminator>\\]|\U2028|\U2029|<LineContinuation>|\\<EscapeSequence>)/ ;

LineContinuation -> /\\<LineTerminatorSequence>/ ;
LineTerminator -> /<LF>|<CR>|<LS>|<PS>/ ;
LineTerminatorSequence -> /<LF>|<CR><LF>?|<LS>|<PS>/ ;
LF -> "\u000A" ;
CR -> "\u000D" ;
LS -> "\u2028" ;
PS -> "\u2029" ;

EscapeSequence -> CharacterEscapeSequence
                | /0(?!<DecimalDigit>)/
                | HexEscapeSequence
                | UnicodeEscapeSequence
                ;

CharacterEscapeSequence  -> SingleEscapeCharacter | NonEscapeCharacter ;

SingleEscapeCharacter -> /['"\\bfnrtv]/ ;

NonEscapeCharacter -> /([^<EscapeCharacter><LineTerminator>])/ ;

EscapeCharacter -> /<SingleEscapeCharacter>|<DecimalDigit>|x|u/ ;

HexEscapeSequence -> /u<HexDigit><HexDigit>/ ;
UnicodeEscapeSequence -> /u<HexDigit><HexDigit><HexDigit><HexDigit>/ ;
