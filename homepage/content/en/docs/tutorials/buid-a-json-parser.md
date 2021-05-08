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
%token NUMBER /-?\d+(\.\d+)?([eE][+-]?\d+)?/
%token STRING /".*?(?<!\\)"/
%skip /[ \t\n\f\r]+/

Value -> Dict | List | STRING | NUMBER | Boolean | "null"
List -> "[" Value ( "," value ) * "]"
Dict -> "{" [ Pair ("," Pair)* ] "}"
Pair -> STRING ":" value
Boolean -> "true" | "false"

```


That is it.  LTB There are other ways to refactor and import common rules to avoid repetition as well as providing custom lexers.  We will come to those later.

## Testing the Parser

Let us try it out below.

<ltb>
</ltb>
