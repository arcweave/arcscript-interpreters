# Arcscript Interpreters

This repository includes the supported interpreters for **arcscript**, the scripting language of [Arcweave](https://arcweave.com), for [C++](Cpp), [C#](CSharp) and [JavaScript](JavaScript).

The interpreters are built using [ANTLR 4](https://github.com/antlr/antlr4), a parser generator for reading, processing, executing, or translating structured text or binary files.

## How it's made

### Why a parser generator?

In order to support updating game data from Arcweave that use arcscript during runtime in game engines, we had to find a way to interpret it without having to rebuild the game. This lead us to use a parser generator. ANTLR 4 is a great option for that, since it can create parsers for multiple languages, including C++ (which we use for unreal), C# (for Unity and Godot) and JavaScript (for our frontend). 

### Our Implementation

In folder [`grammar`](grammar) you can find the files [`ArcscriptLexer.g4`](grammar/ArcscriptLexer.g4) and [`ArcscriptParser.g4`](grammar/ArcscriptParser.g4), the Grammar files for the Lexer and the Parser respectively.

### Build

#### Prerequisites

- curl
- Java JRE to run the antlr4 tool
- python3

In order to build all Parsers for C++, C# and JavaScript, run the [`generate.sh`](generate.sh) shell script.

```bash
$ sh generate.sh
```

This script:

1. Will download the `antlr4.jar` file to create the Parsers with
2. Generate the parsers for each language


## Languages

### JavaScript

We are using the JavaScript parser to interpret arcscript in our arcweave app. We have also created a package, [`@arcweave/arcscript`](https://www.npmjs.com/package/@arcweave/arcscript) using the generated files in [JavaScript](JavaScript), along with a custom ANTLR Visitor to parse the generated Parse Tree from ANTLR.

You can find more info in [JavaScript](JavaScript) folder.

### C#

Use the C# code along with the antlr4 NuGet package in your project.

Find more info in the [CSharp](CSharp) folder.

### C++

Building the C++ solution will create the include headers and the shared libaries (.dll for Windows and .dylib for macOS) to be included in your project
Find more info in the [Cpp](Cpp) folder.

## Links & References

- [Arcweave](https://arcweave.com/)
- [Arcscript Documentation](https://arcweave.com/docs/1.0/arcscript)
- https://www.antlr.org/
