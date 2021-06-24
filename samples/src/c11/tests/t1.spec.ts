const util = require("util");
import { newParser } from "../";
const fs = require("fs");
const yaml = require("js-yaml");

function readFile(fname: string): string {
  return fs.readFileSync(__dirname + "/" + fname, "utf8");
}

function parseFile(fname: string, contents?: string, debug = false): any {
  if (!contents) contents = readFile(fname);
  const [parser, _] = newParser({ type: "slr", debug: debug });
  const t1 = Date.now();
  const result = parser.parse(contents) || null;
  const t2 = Date.now();
  console.log(`'${fname}' parsed in ${t2 - t1} ms`);
  if (debug) {
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

  test("2", () => {
    const result = parseFile(
      "Case 2",
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
  test("3", () => {
    const result = parseFile(
      "Case 3",
      `
      // variable_star.c
      int T, b;
      void f(void) {
      T * b;
      }`,
      true,
    );
  });
});
