# Arcscript Interpreters

This repository contains the supported C++, C#, and TypeScript interpreters for **Arcscript**, the scripting language used by [Arcweave](https://arcweave.com/).

All three implementations are generated from the same grammar and provide the runtime behavior needed to evaluate conditions, update variables, render script output, and integrate Arcscript into applications and game engines.

## Implementations

| Implementation | Runtime | Primary use | Guide |
| --- | --- | --- | --- |
| TypeScript | ES2022 with browser DOM APIs | Arcweave web applications and JavaScript/TypeScript consumers | [TypeScript guide](TypeScript/README.md) |
| C# | .NET 6 | .NET, Unity, and Godot integrations | [C# guide](CSharp/README.md) |
| C++ | C++17 and CMake 3.10+ | Native applications and engine integrations | [C++ guide](Cpp/README.md) |

The TypeScript implementation is also distributed as [`@arcweave/arcscript`](https://www.npmjs.com/package/@arcweave/arcscript).

## Why ANTLR 4?

Arcweave projects can be updated while an application or game is running. Arcscript therefore needs to be interpreted at runtime without rebuilding the host application whenever project content changes.

[ANTLR 4](https://github.com/antlr/antlr4) provides a shared grammar-driven approach for this requirement. The lexer and parser rules are defined once and then generated for every supported target language. This gives the repository several advantages:

- **Consistent syntax:** C++, C#, and TypeScript parse the same Arcscript language.
- **Runtime portability:** Generated parsers can be embedded in web applications, .NET projects, and native engines.
- **Centralized grammar changes:** Language syntax is maintained in one lexer and parser definition rather than reimplemented manually.
- **Comparable behavior:** Parallel fixtures and tests can verify that the interpreters preserve shared Arcscript semantics.

The grammar sources are:

- [`grammar/ArcscriptLexer.g4`](grammar/ArcscriptLexer.g4)
- [`grammar/ArcscriptParser.g4`](grammar/ArcscriptParser.g4)

Each implementation adds its own parser base, visitor, runtime state, functions, error handling, and host-language integration around the generated ANTLR code.

## Repository Layout

| Path | Contents |
| --- | --- |
| [`grammar`](grammar) | Shared Arcscript lexer and parser grammars, plus generation helpers. |
| [`TypeScript`](TypeScript/README.md) | TypeScript interpreter, package configuration, and Vitest suite. |
| [`CSharp`](CSharp/README.md) | C# interpreter, project model, and NUnit suite. |
| [`Cpp`](Cpp/README.md) | C++ interpreter, exported bridge API, and CTest suite. |
| [`.github/workflows`](.github/workflows) | Continuous-integration workflows for each implementation. |

## Generating Parsers

Parser generation is separate from building or testing the interpreters. The generation scripts regenerate the TypeScript, C#, and C++ ANTLR sources from the shared grammar.

### Prerequisites

- Java 11 or newer
- Python 3
- `curl` on Unix-like systems when `antlr4.jar` is missing
- PowerShell on Windows

Run one of the following commands from the repository root.

**Linux and macOS:**

```bash
sh generate.sh
```

**Windows:**

```powershell
.\generate.ps1
```

If `antlr4.jar` is not present, the scripts download the configured ANTLR tool before generating the parser sources.

## Building and Testing

The following commands provide a repository-level quick reference. See each implementation guide for complete setup, API examples, and platform-specific details.

### TypeScript

```bash
cd TypeScript
pnpm install
pnpm build
pnpm test --run
```

The package declares the supported pnpm version in `TypeScript/package.json`.

### C#

```bash
dotnet restore CSharp/CSharp.csproj
dotnet build CSharp/CSharp.csproj --configuration Release --no-restore
dotnet test CSharp/CSharp.csproj --configuration Release --no-build
```

### C++

These commands remain compatible with the project's CMake 3.10 minimum:

```bash
mkdir -p Cpp/build
cd Cpp/build
cmake .. -DCMAKE_BUILD_TYPE=Release -DWITH_TEST=ON
cmake --build . --config Release
ctest -C Release --output-on-failure
```

On Windows, create `Cpp/build`, run CMake from that directory, and select the Release configuration with `--config Release`.

## Cross-Language Behavior

The interpreters share the Arcscript grammar and maintain parallel fixture categories for:

- valid scripts and assignments
- global and scoped member variables
- conditions and expressions
- string operations and rendered output
- visits and runtime events
- parse and runtime errors
- variable reset behavior

Behavioral changes should be reviewed across all affected implementations. When a feature is intended to behave consistently in C++, C#, and TypeScript, update the corresponding fixtures or tests in each language rather than validating only one runtime.

Implementation-specific APIs may differ because each host language has different state, ownership, error, and integration requirements. The language guides document those differences.

## Contributing

1. Generate the parser sources after changing the grammar.
2. Keep changes focused within the affected implementation or shared grammar.
3. Add or update tests for every behavioral change.
4. Run the relevant language suites before opening a pull request.
5. Verify cross-language parity when modifying shared Arcscript semantics.
6. Document public API, build, or integration changes in the relevant language guide.

## License

This project is licensed under the terms in [`LICENSE.txt`](LICENSE.txt).

## References

- [Arcweave](https://arcweave.com/)
- [Arcscript documentation](https://arcweave.com/docs/1.0/arcscript)
- [ANTLR 4](https://www.antlr.org/)
