if [ ! -f ./antlr4.jar ]
then  
  curl https://www.antlr.org/download/antlr-4.13.1-complete.jar -o antlr4.jar
fi
cd grammar
java -Xmx500M -cp ../antlr4.jar org.antlr.v4.Tool -Dlanguage=JavaScript ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./JavaScript
mkdir -p ../JavaScript/src/Generated
cp JavaScript/*.js ../JavaScript/src/Generated/.
rm -rf ./JavaScript

cp Arcscript*.g4 ./Cpp/.
cd Cpp
python3 transformGrammar.py
java -Xmx500M -cp ../../antlr4.jar org.antlr.v4.Tool -Dlanguage=Cpp ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./Generated
mkdir -p ../../Cpp/src/Generated
cp Generated/*.cpp ../../Cpp/src/Generated
cp Generated/*.h ../../Cpp/src/Generated
rm -rf ./Generated
rm -rf *.g4 *.g4.bak
cd ..

java -Xmx500M -cp ../antlr4.jar org.antlr.v4.Tool -Dlanguage=CSharp ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./CSharp
mkdir -p ../CSharp/src/Generated
cp CSharp/*.cs ../CSharp/src/Generated/.
rm -rf ./CSharp