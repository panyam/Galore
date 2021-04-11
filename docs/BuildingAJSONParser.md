
This tutorial shows how to build a parser for a more modernized JSON (https://json5.org/) using the LTB.

1. The Grammar

The grammar is in an EBNF format.

```
JSON5Value -> JSON5Null
            | JSON5Boolean
            | JSON5String
            | JSON5Number
            | JSON5Object
            | JSON5Array
            ;
 
JSON5Object -> "{" "}" | "{" JSON5MemberList "," ? "}"

JSON5MemberList -> JSON5Member | JSON5MemberList "," JSON5Member ;

JSON5Member -> JSON5MemberName ":" JSON5Value ;

JSON5MemberName -> JSON5Identifier | JSON5String ;

JSON5Array  -> "[" "]" ;
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

JSON5DoubleStringCharacter -> /([^"<LineTerminator>\\]|\U2028|\U2029|<LineContinuation>|\\<EscapeSequence>)/
JSON5SingleStringCharacter -> /([^'<LineTerminator>\\]|\U2028|\U2029|<LineContinuation>|\\<EscapeSequence>)/

LineContinuation -> /\\<LineTerminatorSequence>/ ;
LineTerminator -> /<LF>|<CR>|<LS>|<PS>/ ;
LineTerminatorSequence -> /<LF>|<CR><LF>?|<LS>|<PS>/ ;

EscapeSequence -> CharacterEscapeSequence
                | /0(?!<DecimalDigit>)/
                | HexEscapeSequence
                | UnicodeEscapeSequence
                ;

CharacterEscapeSequence  -> SingleEscapeCharacter | NonEscapeCharacter

SingleEscapeCharacter -> /['"\\bfnrtv]/

NonEscapeCharacter -> /([^<EscapeCharacter><LineTerminator>])/ ;

EscapeCharacter -> /<SingleEscapeCharacter>|<DecimalDigit>|x|u/ ;

HexEscapeSequence -> /x<HexDigit><HexDigit>/ ;

UnicodeEscapeSequence -> /u<HexDigit><HexDigit><HexDigit><HexDigit>/ ;

// Ignore spaces
%skip -> /[ \t\n\f\r]+/ ;

```

Note that we can pass in some literal tokens as is in the grammar specification.  The resultant parser will also create a tokenizer capable of returning these literals as tokens.

We can also specify regexes tokens in our specification so a tokenizer is also generated 
