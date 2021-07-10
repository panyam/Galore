

Current class dependency/hierarchy diagram:

```
[Term]    <----  Str <---- Rule <----  Grammar  <---  Ptables  <--- ParserDriver
             |                            ^              ^               ^    |
[NonTerm] <--|                            |              |               |    |
                                          --------------------------------    |
                                                         | (creates)          |
                                                        DSL --> [Lexer] <------
                                                         |                    |
                                                         | -->  [SemHandler] <-

```

The DSL Loader:

* Loads a grammar
* Creates a scanner
* Registers names of semantic handlers

But current does not create a parser or the parse tables.  Here is where the confusion
is.   The ptables and parser driver are created *after* the DSL loader does its thing.

And this choice was made so that the we could independantly iterate on the DSL syntax
etc without having to depend on the generated parser.  But really the the generated
parser is affected because the parser needs info about semantic actions and the loader
needs to know all these details.  Yes this is done with the SemHandler interface but
that interface was only chosen because of knowledge of how the ParserDriver was function?
May be not.  Becuase currently we are using actions as opaque strings to be handled 
by which ever driver we use.

The other concern was the dependancy on the loader by several tests to load the grammar
before ptables were constructed etc.  eg the ptables and parser tests loaded a grammar
by calling the factory method which would then use a dsl loader.   If the DSL loader
directly became this factory then this could introduce a circular dependancy?
