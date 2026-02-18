#!/usr/bin/env bash
cd "$(dirname "$0")"

if [ ! -f ./antlr4.jar ]
then  
  curl https://www.antlr.org/download/antlr-4.13.1-complete.jar -o antlr4.jar
fi
cd grammar
java -Xmx500M -cp ../antlr4.jar org.antlr.v4.Tool -Dlanguage=TypeScript ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./TypeScript
mkdir -p ../TypeScript/src/Generated
cp TypeScript/*.ts ../TypeScript/src/Generated/.
rm -rf ./TypeScript

cp Arcscript*.g4 ./Cpp/.
cd Cpp
python3 transformGrammar.py
java -Xmx500M -cp ../../antlr4.jar org.antlr.v4.Tool -Dlanguage=Cpp ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./Generated -package Arcweave
mkdir -p ../../Cpp/src/Generated/ArcscriptLexer
mkdir -p ../../Cpp/src/Generated/ArcscriptParser
cp Generated/*Lexer*.cpp ../../Cpp/src/Generated/ArcscriptLexer
cp Generated/*Lexer*.h ../../Cpp/src/Generated/ArcscriptLexer
cp Generated/*Parser*.cpp ../../Cpp/src/Generated/ArcscriptParser
cp Generated/*Parser*.h ../../Cpp/src/Generated/ArcscriptParser
rm -rf ./Generated
rm -rf *.g4 *.g4.bak
cd ..

java -Xmx500M -cp ../antlr4.jar org.antlr.v4.Tool -Dlanguage=CSharp ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./CSharp -package Arcweave.Interpreter
mkdir -p ../CSharp/Interpreter/Generated
cp CSharp/*.cs ../CSharp/Interpreter/Generated/.
rm -rf ./CSharp