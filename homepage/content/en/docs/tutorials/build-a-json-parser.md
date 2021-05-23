---
title: "Build a Json Parser"
date: 2021-05-08T11:10:00-07:00
weight: 1
draft: true
description: >
  An example showing how to build a fully functional JSON parser using the LTB.
---

In this example we will build a JSON parser using LTB.

## The Grammar

Grammars in LTB are an extension of the Extended Backaus Naur Form (EBNF).   The EBNF grammar for JSON is:

```
const grammar = `
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


That is it.  LTB There are other ways to refactor and import common rules to avoid repetition as well as providing custom tokenizers.  We will come to those later.

## Testing the Parser

Let us parse info about the best solar system ever:

```
import * as LTB from "ltb"

const parser = LTB.newParser(grammar);
const payload = `{
    "name": "Milky Way",
    "age": 4600000000,
    "star": "sun",
    "planets": [ "Mercury", "Venus", "Earth" ]
}`;
const ptree = parser.parse(payload);
console.log(ptree?.reprString);
```

Resulting in:

```
Value
  Dict
    "{" - {
    $3
      Pair
        STRING - "name"
        ":" - :
        Value
          STRING - "Milky Way"
      $2
        $2
          $2
            $2
            "," - ,
            Pair
              STRING - "age"
              ":" - :
              Value
                NUMBER - 4600000000
          "," - ,
          Pair
            STRING - "star"
            ":" - :
            Value
              STRING - "sun"
        "," - ,
        Pair
          STRING - "planets"
          ":" - :
          Value
            List
              "[" - [
              $1
                Value
                  STRING - "Mercury"
                $0
                  $0
                    $0
                    "," - ,
                    Value
                      STRING - "Venus"
                  "," - ,
                  Value
                    STRING - "Earth"
              "]" - ]
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

Tree callbacks (discussed next) are very useful in uncluttering the tree from useless and auxiliary information.

## Tree Callbacks

Our goal in this example is to return a valid JSON object from a given input.   However so far we only have a parse tree in its rawest form.  It is quite possible to perform further passes to shape the tree as needed and even more passes to construct the JSON object.  However these additional passes are wasteful.

The Parser object exposes three useful callbacks:

* **`onNextToken(token: Token) => Nullable<Token>`**: This method is called as soon as the next token is received from the tokenizer.  This allows one to filter out tokens or even transform them based on any other context being maintained.
* **`beforeAddingChildNode(parent: PTNode, child: PTNode) => PTNode[]`**: When a child node is created this method is called (along with the parent node) so that any filtering can be performed.  For example this method be used to filter out static terminals (like operators etc).
* **`onReduction(node: PTNode, rule: Rule) => PTNode`**: This callback is invokved after a reduction of a rightmost derivation is performed on the parse stack.  This is an opportunity for any custom tranformations to be performed on the node (and its children) before the node is added back to the parse stack as the parsing continues.

### Removing useless terminals

The first cleanup we can do is to remove the "useless" tokens like "{", "[" etc.  This can be done with:

```
// only allow true, false, string, number and null terminals
const allowList = new Set(["STRING", "NUMBER", "Boolean", "null", "true", "false"]);
const parser = LTB.newParser(grammar);
parser.beforeAddingChildNode = (parent: PTNode, child: PTNode) => {
  if (child.sym.isTerminal) {
    if (!allowList.has(child.sym.label)) {
      return [];
    }
  }
  return [child];
}
```

Every PTNode records the current symbol (either terminal or non terminal) that leads the production.  We then use the label associated with the symbol to match our allowed tokens.  If a custom tokenizer was used then the tag of the symbol can be used instead.  More on this in ({{< relref "./using-custom-tokenizers.md" >}} "Using custom tokenizers").

With the above callback our parse tree now looks bit uncluttered:

```
Value
  Dict
    $3
      Pair
        STRING - "name"
        Value
          STRING - "Milky Way"
      $2
        $2
          $2
            $2
            Pair
              STRING - "age"
              Value
                NUMBER - 4600000000
          Pair
            STRING - "star"
            Value
              STRING - "sun"
        Pair
          STRING - "planets"
          Value
            List
              $1
                Value
                  STRING - "Mercury"
                $0
                  $0
                    $0
                    Value
                      STRING - "Venus"
                  Value
                    STRING - "Earth"
```

### Inlining auxiliary productions

As shown before the productions with $0, $1 are auto generated to allow more complex BNF specifications (eg optionals, inline repititions, inline groups etc).  It is really not fair for the author of the grammar to have to worry about cleaning these auxiliary productions from the parse tree.  Do not worry there is an automatic feature flag that will do this for us.  However let us do this manually to get a handle on it.

First a quick summary of the auxiliary symbols created for different purposes:

1. Optionals:
```
X -> Y?
```

converts to:

```
X -> $0
$0 -> Y | ;
```

2. 0 or more
```
X -> Y*
```

converts to:

```
X -> $0
$0 -> $0 Y | ;
```

3. 1 or more
```
X -> Y+
```

converts to:

```
X -> $0
$0 -> $0 Y | Y ;
```

To inline the auxiliary productions we can simply use the beforeAddingChildNode callback:

```
...
parser.beforeAddingChildNode = (parent, child) => {
  if (child.sym.isTerminal) {
    if (!allowList.has(child.sym.label)) {
      return [];
    }
  } else if (child.sym.isAuxiliary) {
    return child.children;
  }
  return [child];
};
```

This would ensure our resultant parse tree would look like:

```
Value
  Dict
    Pair
      STRING - "name"
      Value
        STRING - "Milky Way"
    Pair
      STRING - "age"
      Value
        NUMBER - 4600000000
    Pair
      STRING - "star"
      Value
        STRING - "sun"
    Pair
      STRING - "planets"
      Value
        List
          Value
            STRING - "Mercury"
          Value
            STRING - "Venus"
          Value
            STRING - "Earth"
```

Looking much better.  One more cleanup and we have a parse tree resembling the structure in the original JSON payload.

### Inlining single child productions

Another cleanup that can be performed is inlining productions with single children.  For example Value -> STRING or Value -> List above.  This can be done with the onReduction callback:

```
const parser = LTB.newParser(grammar);
parser.onReduction = (node, rule) => {
  if (node.children.length == 1) node = node.children[0];
  return node;
};
```

With this our resultant now looks a lot more promising and closer to what a real JSON document might look like:

```
Dict
  Pair
    STRING - "name"
    STRING - "Milky Way"
  Pair
    STRING - "age"
    NUMBER - 4600000000
  Pair
    STRING - "star"
    STRING - "sun"
  Pair
    STRING - "planets"
    List
      STRING - "Mercury"
      STRING - "Venus"
      STRING - "Earth"
```

## Creating the document

So far we have a standardized parse tree.   Though this "looks like" a JSON object it is not quite there.   Each PTNode object has a "value" associated with it.  This allows the different callbacks to set semantic values to a parse tree node.

Similarly we can use the onNextToken and onReduction callback to set these values on a parse.


The onNextToken callback is called as soon as next token is fetched from the tokenizer.  This is a chance for us to set its semantic value.
```
parser.onNextToken = (token) => {
  if (token.tag == "STRING") {
    token.value = token.value.substring(1, token.value.length - 1);
  } else if (token.tag == "NUMBER") {
    token.value = parseFloat(token.value);
  } else if (token.tag == '"true"') {
    token.value = true;
  } else if (token.tag == '"false"') {
    token.value = false;
  } else if (token.tag == '"null"') {
    token.value = null;
  }
  return token;
};
```

Similary the onReduction is called when a reduction is performed on N items on the parse stack.  This is a place to evaluate the semantic value of the non-terminal leading the production:

```
parser.onReduction = (node: PTNode, rule: Rule) => {
  if (node.children.length == 1) {
    node = node.children[0];
  }
  if (node.sym.label == "List") {
    node.value = node.children.map((n) => n.value);
  } else if (node.sym.label == "Dict") {
    node.value = {};
    for (const pair of node.children) {
      // these *will* be Pair objects
      TSU.assert(pair.sym.label == "Pair");
      TSU.assert(pair.children.length == 2);
      node.value[pair.children[0].value] = pair.children[1].value;
    }
  }
  return node;
};
```

With this our parse tree value (`result?.value`) is:

```
{
  name: 'Milky Way',
  age: 4600000000,
  star: 'sun',
  planets: [ 'Mercury', 'Venus', 'Earth' ],
  hot: true,
  x: null
}
```

Not bad at all given a tokenizer and generated parser right out of the box.   There is still a lot of room for improvement.   We will explore these in further tutorials with custom tokenizers and amany more.

## Performance

Generated parsers can never get as fast as hand crafted parsers.  But how close can we get?

(TODO) Discuss:

* Different sizes of grammars.
* Tokenizer vs Parse time break down
* Hook to custom parser.

## Conclusion

This simple tutorial shows how a parser can be constructed (for LR grammars).  The framework also generates a tokenizer for free so the DSL author can focus on the constructs of the language.

In other tutorials and examples more advanced use cases will be explored.   If you have any feedback or suggestions on how this documentation (or LTB itself) can be improved I would love to hear it.  Please email me or raise an issue in the Github repo.
