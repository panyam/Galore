
JSON5Identifier := <IdentifierName>
!IdentifierName := <IdentifierStart><IdentifierPart>*
!IdentifierStart := <UnicodeLetter>|\$|_|\\<UnicodeEscapeSequence>
!IdentifierPart := <IdentifierStart>|<UnicodeCombiningMark>|<UnicodeDigit>|<UnicodeConnectorPunctuation>|<ZWNJ>|<ZWJ>
!ZWNJ := \u200c
!ZWJ := \u200d
!UnicodeLetter := <UnicodeLetterUpperCase>|<UnicodeLetterLowerCase>|<UnicodeLetterTitleCase>|<UnicodeLetterModifier>|<UnicodeLetterOther>|<UnicodeLetterNumber>

# https://www.fileformat.info/info/unicode/category
# All these are deferred to "external" matchers for speed
*UnicodeLetterUpperCase := .
*UnicodeLetterLowerCase := .
*UnicodeLetterTitleCase := .
*UnicodeLetterModifier := .
*UnicodeLetterOther := .
*UnicodeLetterNumber := .
*UnicodeCombiningMark := .
*UnicodeDigit := .
*UnicodeConnectorPunctuation := .

JSON5NumericLiteral := Infinity|NaN|<NumericLiteral>
!NumericLiteral := <DecimalLiteral>|<HexIntegerLiteral>
!DecimalLiteral := <DecimalIntegerLiteral>\.<DecimalDigits>?<ExponentPart>?
!DecimalLiteral := \.<DecimalDigits><ExponentPart>?
!DecimalLiteral := <DecimalIntegerLiteral><ExponentPart>?
!DecimalIntegerLiteral := 0|<NonZeroDigit><DecimalDigits>
!DecimalDigits := <DecimalDigit>+
!DecimalDigit := [0-9]
!NonZeroDigit := [1-9]
!ExponentPart := (e|E)<SignedInteger>
!SignedInteger := <DecimalDigits>|[\-\+]<DecimalDigits>
!HexIntegerLiteral := 0[xX]<HexDigit>+
!HexDigit := [0-9a-fA-F]

JSON5String := <JSON5SingleQuoteString>|<JSON5DoubleQuoteString>
!JSON5SingleQuoteString := '<JSONSingleQuoteStringChar>*'
!JSON5DoubleQuoteString := "<JSONDoubleQuoteStringChar>*"
!JSONSingleQuoteStringChar := (^('|\\|<LineTerminator>))|<JSON5MiscStringChar>
!JSONDoubleQuoteStringChar := (^("|\\|<LineTerminator>))|<JSON5MiscStringChar>
!JSON5MiscStringChar := (\u2028|\u2029|<LineContinuation>|\\<EscapeSequence>)
!LineTerminator := (<LF>|<CR>|<LS>|<PS>)
!LF := \0x0a
!CR := \0x0d
!LS := \u2028
!PS := \u2029
!LineContinuation := <LineTerminatorSequence>
!LineTerminatorSequence := (<LF>|<CR>(?!<LF>)|<LS>|<PS>|<CR><LF>)

!EscapeSequence := <CharacterEscapeSequence>|0(?![0-9])|<HexEscapeSequence>|<UnicodeEscapeSequence>
!CharacterEscapeSequence := <SingleEscapeCharacter>|<NonEscapeCharacter>
!SingleEscapeCharacter := ['"\\bfnrtv]
!NonEscapeCharacter := (^(EscapeCharacter|LineTerminator))
!EscapeCharacter := <SingleEscapeCharacter>|<DecimalDigit>|x|u
!HexEscapeSequence := x<HexDigit><HexDigit>
!UnicodeEscapeSequence := u<HexDigit><HexDigit><HexDigit><HexDigit>

# JSON5Comment - single and multi line
JSON5Comment := (//.*$|/\*(^\*/)*\*/)

# JSON5 Literals
JSON5NULL := null
JSON5Boolean := true|false

# operator tokens
COMMA := ,
COLON := :
OSQ := \[
CSQ := \]
OBRACE := \{
CBRACE := \}

# Skip spaces
SPACES := [ \t\n\r]+

# Everything else is an error
ERROR := .
