const util = require("util");
import { newParser } from "../";
const fs = require("fs");
const yaml = require("js-yaml");

function readFile(fname: string): string {
  return fs.readFileSync(__dirname + "/" + fname, "utf8");
}

function parseFile(fname: string, contents?: string, params = {} as any): any {
  if (!contents) contents = readFile(fname);
  const [parser, _] = newParser({ type: "lalr", ...params });
  const t1 = Date.now();
  const result = parser.parse(contents) || null;
  const t2 = Date.now();
  console.log(`'${fname}' parsed in ${t2 - t1} ms`);
  if (params.debug?.split("|").findIndex((p: string) => p == "all" || p == "result") >= 0) {
    console.log(
      `Parse Result: \n${util.inspect(yaml.dump(result?.debugValue()), {
        showHidden: false,
        depth: null,
        maxArrayLength: null,
        maxStringLength: null,
      })}`,
    );
  }
  return result;
}

describe("C11 Parser", () => {
  test("1", () => {
    const result = parseFile("Case 1", ` int main(void) { } `);
    expect(yaml.dump(result?.debugValue())).toEqual(
      "- translation_unit\n" +
        "- - - external_declaration\n" +
        "    - - - function_definition\n" +
        "        - - - declaration_specifiers\n" +
        "            - - - type_specifier\n" +
        "                - - - INT\n" +
        "                    - int\n" +
        "          - - declarator\n" +
        "            - - - direct_declarator\n" +
        "                - - - direct_declarator\n" +
        "                    - - - IDENTIFIER\n" +
        "                        - main\n" +
        `                  - - '"("'\n` +
        "                    - (\n" +
        "                  - - parameter_type_list\n" +
        "                    - - - parameter_list\n" +
        "                        - - - parameter_declaration\n" +
        "                            - - - declaration_specifiers\n" +
        "                                - - - type_specifier\n" +
        "                                    - - - VOID\n" +
        "                                        - void\n" +
        `                  - - '")"'\n` +
        "                    - )\n" +
        "          - - compound_statement\n" +
        `            - - - '"{"'\n` +
        "                - '{'\n" +
        `              - - '"}"'\n` +
        "                - '}'\n",
    );
  });
});

describe.skip("Test cases from https://hal.archives-ouvertes.fr/hal-01633123/document", () => {
  test("variable_star", () => {
    const result = parseFile(
      "variable_star",
      `int T, b;
      void f(void) {
        T * b;
      }`,
    );
  });

  test("typedef_star", () => {
    const result = parseFile(
      "typedef_star",
      `typedef int T;
      void f(void) {
        T * b;
      }`,
    );
    expect(yaml.dump(result?.debugValue())).toEqual(
      "- translation_unit\n" +
        "- - - translation_unit\n" +
        "    - - - external_declaration\n" +
        "        - - - declaration\n" +
        "            - - - declaration_specifiers\n" +
        "                - - - storage_class_specifier\n" +
        "                    - - - TYPEDEF\n" +
        "                        - typedef\n" +
        "                  - - declaration_specifiers\n" +
        "                    - - - type_specifier\n" +
        "                        - - - INT\n" +
        "                            - int\n" +
        "              - - init_declarator_list\n" +
        "                - - - init_declarator\n" +
        "                    - - - declarator\n" +
        "                        - - - direct_declarator\n" +
        "                            - - - IDENTIFIER\n" +
        "                                - T\n" +
        `              - - '";"'\n` +
        "                - ;\n" +
        "  - - external_declaration\n" +
        "    - - - function_definition\n" +
        "        - - - declaration_specifiers\n" +
        "            - - - type_specifier\n" +
        "                - - - VOID\n" +
        "                    - void\n" +
        "          - - declarator\n" +
        "            - - - direct_declarator\n" +
        "                - - - direct_declarator\n" +
        "                    - - - IDENTIFIER\n" +
        "                        - f\n" +
        `                  - - '"("'\n` +
        "                    - (\n" +
        "                  - - parameter_type_list\n" +
        "                    - - - parameter_list\n" +
        "                        - - - parameter_declaration\n" +
        "                            - - - declaration_specifiers\n" +
        "                                - - - type_specifier\n" +
        "                                    - - - VOID\n" +
        "                                        - void\n" +
        `                  - - '")"'\n` +
        "                    - )\n" +
        "          - - compound_statement\n" +
        `            - - - '"{"'\n` +
        "                - '{'\n" +
        "              - - block_item_list\n" +
        "                - - - block_item\n" +
        "                    - - - statement\n" +
        "                        - - - expression_statement\n" +
        "                            - - - expression\n" +
        "                                - - - assignment_expression\n" +
        "                                    - - - conditional_expression\n" +
        "                                        - - - logical_or_expression\n" +
        "                                            - - - logical_and_expression\n" +
        "                                                - - - inclusive_or_expression\n" +
        "                                                    - - - exclusive_or_expression\n" +
        "                                                        - - - and_expression\n" +
        "                                                            - - - equality_expression\n" +
        "                                                                - - - relational_expression\n" +
        "                                                                    - - - shift_expression\n" +
        "                                                                        - - - additive_expression\n" +
        "                                                                            - - - multiplicative_expression\n" +
        "                                                                                - - - multiplicative_expression\n" +
        "                                                                                    - - - cast_expression\n" +
        "                                                                                        - - - unary_expression\n" +
        "                                                                                            - - - postfix_expression\n" +
        "                                                                                                - - - primary_expression\n" +
        "                                                                                                    - - - IDENTIFIER\n" +
        "                                                                                                        - T\n" +
        `                                                                                  - - '"*"'\n` +
        "                                                                                    - '*'\n" +
        "                                                                                  - - cast_expression\n" +
        "                                                                                    - - - unary_expression\n" +
        "                                                                                        - - - postfix_expression\n" +
        "                                                                                            - - - primary_expression\n" +
        "                                                                                                - - - IDENTIFIER\n" +
        "                                                                                                    - b\n" +
        `                              - - '";"'\n` +
        "                                - ;\n" +
        `              - - '"}"'\n` +
        "                - '}'\n",
    );
  });
  test("namespaces", () => {
    const result = parseFile(
      "namespaces",
      `
      // namespaces.c
      typedef int S, T, U;
      struct S { int T; };
      union U { int x; };
      void f(void) {
        // The following uses of S, T, U are correct, and have no
        // effect on the visibility of S, T, U as typedef names.
        struct S s = { .T = 1 };
        T: s.T = 2;
        union U u = { 1 };
        goto T;
        // S, T and U are still typedef names:
        S ss = 1; T tt = 1; U uu = 1;
      }`,
      { debug: "result" },
    );
  });
  test("local scope", () => {
    const result = parseFile(
      "local scope",
      `
      // local_scope.c
      typedef int T;
      void f(void) {
        T y = 1; // T is a type
        if(1) {
          int T;
          T = 1; // T is a variable
        }
        T x = 1; // T is a type again
      }`,
      { debug: "result" },
    );
  });
  test("enum_shadows_typedef", () => {
    const result = parseFile(
      "enum_shadows_typedef",
      `
      // enum_shadows_typedef.c
      typedef int T;
      void f(void) {
        int x = (int)(enum {T})1;
        // T now denotes an enumeration constant,
        // and behaves syntactically like a variable:
        x = (int)T;
      }
      `,
      { debug: "result" },
    );
  });
  test("enum_constant_visibility", () => {
    const result = parseFile(
      "enum_constant_visibility",
      `
      // enum_constant_visibility.c
      typedef int T;
      void f(void) {
        int x;
        x = (enum {T, U = T+1})1 + T;
        int y = U - T;
      }
      `,
      { debug: "result" },
    );
  });
  test("block scope", () => {
    const result = parseFile(
      "block scope",
      `
      // block_scope.c
      typedef int T;
      int x;
      void f(void) {
        { T T;
          T = 1;
          typedef int x;
        }
        x = 1; // x as a type is no longer visible
        T u; // T as a variable is no longer visible
      }
      `,
      { debug: "result" },
    );
  });
  test("if_scopes", () => {
    const result = parseFile(
      "if_scopes",
      `
      // if_scopes.c
      typedef int T, U;
      int x;
      void f(void) {
        if(sizeof(enum {T}))
          // The declaration of T as an enumeration constant is
          // visible in both branches:
          x = sizeof(enum {U}) + T;
        else {
          // Here, the declaration of U as an enumeration constant
          // is no longer visible, but that of T still is.
          U u = (int)T;
        }
        switch(sizeof(enum {U})) x = U;
        // Here, T and U are typedef names again:
        T t; U u;
      }
      `,
      { debug: "result" },
    );
  });
  test("loop_scopes", () => {
    const result = parseFile(
      "loop_scopes",
      `
      // loop_scopes.c
      typedef int T, U;
      int x;
      void f(void) {
        for(int T = 0; sizeof(enum {U}); ) x = U+T;
        for(sizeof(enum {U}); ; ) x = U + sizeof(enum {T});
        while(sizeof(enum {U})) x = U;
        // A declaration in the body of a do ... while loop
        // is not visible in the loop condition.
        do x = sizeof(enum {U}) + U;
        while((U)1 + sizeof(enum {U}));
        // The above declarations of T and U took place in inner scopes
        // and are no longer visible.
        T u3; U u4;
      }
      `,
      { debug: "result" },
    );
  });
  test("no_local_scope", () => {
    const result = parseFile(
      "no_local_scope",
      `
      // no_local_scope.c
      typedef int T, U, V;
      int x;
      int f(void) {
        x = sizeof(enum {T});
        label: x = sizeof(enum {U});
        return sizeof(enum {V});
        // T, U and V now denote enumeration constants:
        x = T + U + V;
      }
      `,
      { debug: "result" },
    );
  });
  test("function_parameter_scope", () => {
    const result = parseFile(
      "function_parameter_scope",
      `
      // function_parameter_scope.c
      typedef long T, U;
      enum {V} (*f(T T, enum {U} y, int x[T+U]))(T t);
      // The above declares a function f of type:
      // (long, enum{U}, ptr(int)) -> ptr (long -> enum{V})
      T x[(U)V+1]; // T and U again denote types; V remains visible
      `,
      { debug: "result" },
    );
  });
  test("function_parameter_scope_extends", () => {
    const result = parseFile(
      "function_parameter_scope_extends",
      `
      // function_parameter_scope_extends.c
      typedef long T, U;
      enum {V} (*f(T T, enum {U} y, int x[T+U]))(T t) {
        // The last T on the previous line denotes a type!
        // Here, V, T, U, y, x denote variables:
        long l = T+U+V+x[0]+y;
        return 0;
      }
      `,
      { debug: "result" },
    );
  });
  test("dangling_else", () => {
    const result = parseFile(
      "dangling_else",
      `
      // dangling_else.c
      int f(void) {
        if(0)
          if(1) return 1;
        else return 0;
        return 1;
      }
      `,
      { debug: "result" },
    );
  });
  test("dangling_else_misleading_fail", () => {
    const result = parseFile(
      "dangling_else_misleading",
      `
      // dangling_else_misleading.fail.c
      typedef int T;
      void f(void) {
        if(1)
          for(int T; ;)
            if(1) {}
            else {
              T x;
            }
      }
      `,
      { debug: "result" },
    );
  });
  test("dangling_else_lookahead", () => {
    const result = parseFile(
      "dangling_else_lookahead",
      `
      // dangling_else_lookahead.c
      typedef int T;
      void f(void) {
        for(int T; ;)
          if(1);
        // T must be resolved outside of the scope of the
        // "for" statement, hence denotes a typedef name:
        T x;
        x = 0;
      }
      `,
      { debug: "result" },
    );
  });
  test("declaration_ambiguity", () => {
    const result = parseFile(
      "declaration_ambiguity",
      `
      // declaration_ambiguity.c
      typedef int T;
      void f (void) {
        unsigned int; // declares zero variables of type "unsigned int"
        const T; // declares zero variables of type "const T"
        T x; // T is still visible as a typedef name
        unsigned T; // declares a variable "T" of type "unsigned"
        T = 1;
      }
      `,
      { debug: "result|parser" },
    );
  });
});
