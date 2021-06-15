
Components of the CLI.

1. Grammar Analyzer
   - Intermediate output producer for different languages
   - LL1, LR0, LR1, LALR1 item graphs and goto tables and parse tables
   - Have these in an intermediate representation so it can be loaded by generated parsers.
   - Print different kinds of sets - first sets, follow sets, nullables
   - Identify cycles, left factoring options, left recursions, reachables, usefulness etc.
   - Identify SR conflicts and counter examples
2. Parser generator - in different languages
3. GLR and GLL generation
4. Incremental parsing


Examples
```
lpg file.grammar
-p <lr0, lr1, lalr1, and more>    - Parse table type to generate for other parsers.
-l <target language - C, C++, JS, TS, Java, Python, Ruby>
```
