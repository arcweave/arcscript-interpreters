The `JavaScript` folder includes the generated files from the grammar for the JavaScript target, as well as the ArcscriptParserBase.js

To generate the Lexer and the Parser for JavaScript, after installing antlr4, run in the `resources/assets/js/arcscript/antlr4` folder:

```shell
antlr4 -Dlanguage=JavaScript ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./JavaScript
```
