if [ ! -f ./antlr4.jar ]
then  
  curl https://www.antlr.org/download/antlr-4.13.1-complete.jar -o antlr4.jar
fi
cd grammar
java -Xmx500M -cp ../antlr4.jar org.antlr.v4.Tool -Dlanguage=JavaScript ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./JavaScript
mkdir -p ../JavaScript/src/Generated
cp JavaScript/*.js ../JavaScript/src/Generated/.
rm -rf ./JavaScript

java -Xmx500M -cp ../antlr4.jar org.antlr.v4.Tool -Dlanguage=Cpp ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./Cpp
mkdir -p ../Cpp/src/Generated
cp Cpp/*.cpp ../Cpp/src/Generated
cp Cpp/*.h ../Cpp/src/Generated
rm -rf ./Cpp

java -Xmx500M -cp ../antlr4.jar org.antlr.v4.Tool -Dlanguage=CSharp ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./CSharp
mkdir -p ../CSharp/src/Generated
cp CSharp/*.cs ../CSharp/src/Generated/.
rm -rf ./CSharp