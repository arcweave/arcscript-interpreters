if [ ! -f ./antlr4.jar ]
then  
  wget wget -O antlr4.jar https://www.antlr.org/download/antlr-4.13.1-complete.jar
fi
cd grammar
java -Xmx500M -cp ../antlr4.jar org.antlr.v4.Tool -Dlanguage=JavaScript ArcscriptLexer.g4 ArcscriptParser.g4 -visitor -no-listener -o ./temp
mkdir -p ../src/Generated
cp temp/*.js ../src/Generated/.
rm -rf ./temp