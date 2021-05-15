---
title: "Buid a Json Parser"
date: 2021-05-08T11:10:00-07:00
draft: true
description: >
  An example showing how to build a fully functional JSON parser using the LTB.
---

In this example we will build a JSON parser using LTB.

## The Grammar

Grammars in LTB are an extension of the Extended Backaus Naur Form (EBNF).   The EBNF grammar for JSON is:

```
const g = `
  %token NUMBER /-?\\d+(\\.\\d+)?([eE][+-]?\\d+)?/
  %token STRING /".*?(?<!\\)"/
  %skip /[ \\t\\n\\f\\r]+/
  
  Value -> Dict | List | STRING | NUMBER | Boolean | "null" ;
  List -> "[" Value ( "," value ) * "]" ;
  Dict -> "{" [ Pair ("," Pair)* ] "}" ;
  Pair -> STRING ":" value ;
  Boolean -> "true" | "false" ;
`;
```


That is it.  LTB There are other ways to refactor and import common rules to avoid repetition as well as providing custom lexers.  We will come to those later.

## Testing the Parser

Create the parser:

```
import * as LTB from "ltb"

const parser = LTB.newParser(g);
const ptree = parser.parse(`{
  "name": "Earth",                                                                          
  "age": 4600000000,                                                                        
  "moons": [ "luna" ]
}`);
console.log(ptree?.debugValue);
```

Resulting in:

```
Value - null
  Dict - null
    "{" - {
    $3 - null
      Pair - null
        STRING - "name"
        ":" - :
        Value - null
          STRING - "Earth"
      $2 - null
        "," - ,
        Pair - null
          STRING - "age"
          ":" - :
          Value - null
            NUMBER - 4600000000
        $2 - null
          "," - ,
          Pair - null
            STRING - "moons"
            ":" - :
            Value - null
              List - null
                "[" - [
                $1 - null
                  Value - null
                    STRING - "luna"
                  $0 - null
                "]" - ]
          $2 - null
    "}" - }
```

A few things to note above:

1. The name of each "node" in the parse tree maps directly to the production symbol associated with the reduction (eg "Value", "STRING" etc).
2. Each parse tree node also allows a "value" (null by default) that can be set to synthesized attribute values if custom parse tree construction is used.
3. Terminal symbols are not implicitly filtered out by the parse tree creation.   We will see how to do this soon.
4. Skipped terminals (like spaces) are not included in the parse tree construction by default.
5. In-place terminals (eg "{", "[" in the dsl) are also included by default even though they add no direct value.  Like spaces their inclusion in the parse tree can also be customized.
6. The grammar also contains *auxilliary" symbols - $0, $1 etc.  These symbols are automatically generated for production rules for describing optionals ("?") and repititions ("\*" and "+").   For example a production rule of the form:

```
A -> B+
```

is translated to:

```
A -> $0
$0 -> B
$0 -> $0 B
```

Transformations (discussed next) are very useful in controlling what is included in the tree.

## Tree Transformers

Our goal in this example is to return a valid JSON object from a given input.   However so far we only have a parse tree in its rawest form.  It is quite possible to perform further passes to shape the tree as needed and even more passes to construct the JSON object.  However these additional passes are wasteful.

Let us explore a few options present to us.

### Flattening single child nodes

If a parent node in the parse tree contains a child with a single node, child's nodes are appended directly to the parent.

To turn this on, simply set the "flatten" option to true in the newParser method, eg:

```
const parser = LTB.newParser(g);
const ptree = parser.parse(`{
  "name": "Earth",                                                                          
  "age": 4600000000,                                                                        
  "moons": [ "luna" ]
}`);
console.log(ptree?.debugValue);
```

