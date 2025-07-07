# Download antlr4.jar if it doesn't exist
if (-Not (Test-Path "./antlr4.jar")) {
    Invoke-WebRequest -Uri "https://www.antlr.org/download/antlr-4.13.1-complete.jar" -OutFile "antlr4.jar"
}

Set-Location "grammar"

# JavaScript generation
java -Xmx500M -cp ../antlr4.jar org.antlr.v4.Tool -Dlanguage=JavaScript ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./JavaScript
New-Item -ItemType Directory -Force -Path ../JavaScript/src/Generated | Out-Null
Copy-Item JavaScript\*.js ../JavaScript/src/Generated\
Remove-Item -Recurse -Force ./JavaScript

# Copy grammar files for Cpp
Copy-Item Arcscript*.g4 ./Cpp/
Set-Location "Cpp"
python transformGrammar.py
java -Xmx500M -cp ../../antlr4.jar org.antlr.v4.Tool -Dlanguage=Cpp ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./Generated -package Arcweave
New-Item -ItemType Directory -Force -Path ../../Cpp/src/Generated/ArcscriptLexer | Out-Null
New-Item -ItemType Directory -Force -Path ../../Cpp/src/Generated/ArcscriptParser | Out-Null
Copy-Item Generated\*Lexer*.cpp ../../Cpp/src/Generated/ArcscriptLexer
Copy-Item Generated\*Lexer*.h ../../Cpp/src/Generated/ArcscriptLexer
Copy-Item Generated\*Parser*.cpp ../../Cpp/src/Generated/ArcscriptParser
Copy-Item Generated\*Parser*.h ../../Cpp/src/Generated/ArcscriptParser
Remove-Item -Recurse -Force ./Generated
Remove-Item *.g4,*.g4.bak -Force
Set-Location ..

# CSharp generation
java -Xmx500M -cp ../antlr4.jar org.antlr.v4.Tool -Dlanguage=CSharp ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./CSharp -package Arcweave.Interpreter
New-Item -ItemType Directory -Force -Path ../CSharp/src/Generated | Out-Null
Copy-Item CSharp\*.cs ../CSharp/src/Generated\
Remove-Item -Recurse -Force ./CSharp