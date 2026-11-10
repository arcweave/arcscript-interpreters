#nullable enable
using Antlr4.Runtime;
using System.Collections.Generic;
using System.Linq;
using Arcweave.Interpreter.INodes;

namespace Arcweave.Interpreter
{
    public class AwInterpreter
    {
        private IProject Project { get; set; }
        private string ElementId { get; set; }

        private System.Action<string> _emit;
        private readonly IReadOnlyDictionary<string, EnumDefinition>? _enums;
        private readonly IEnumerable<string>? _scopeNames;

        public AwInterpreter(IProject project, string elementId = "", System.Action<string>? onEvent = null,
            IReadOnlyDictionary<string, EnumDefinition>? enums = null, IEnumerable<string>? scopeNames = null)
        {
            this.Project = project;
            _enums = enums;
            _scopeNames = scopeNames;
            this.ElementId = elementId;
            if (onEvent != null)
            {
                _emit = onEvent;
            }
            else
            {
                _emit = (string eventName) => { };
            }
        }

        private ArcscriptContext CreateContext()
        {
#if GODOT
            var scopes = Project.Boards.Values.Select(board => board.CustomId)
                .Concat(Project.Components.Values.Select(component => component.CustomId));
#else
            var scopes = Project.Boards.Select(board => board.CustomId)
                .Concat(Project.Components.Select(component => component.CustomId));
#endif
            return new ArcscriptContext(_enums, Project.GetAllVariables(),
                scopes.Concat(_scopeNames ?? Enumerable.Empty<string>()));
        }

        public ArcscriptParser.InputContext Parse(string code) => ParseWithContext(code).Tree;

        private (ArcscriptParser.InputContext Tree, ArcscriptContext Declarations) ParseWithContext(string code)
        {
            var declarations = CreateContext();
            ICharStream stream = CharStreams.fromString(code);
            ArcscriptLexer lexer = new ArcscriptLexer(stream);
            var lexerErrorListener = new ErrorListener<int>();
            lexer.AddErrorListener(lexerErrorListener);
            ITokenStream tokens = new CommonTokenStream(lexer);
            var parserErrorListener = new ErrorListener<IToken>();
            ArcscriptParser parser = new ArcscriptParser(tokens);
            parser.AddErrorListener(parserErrorListener);
            parser.SetProject(Project, declarations);

            ArcscriptParser.InputContext tree = parser.input();
            
            if (lexerErrorListener.HasErrors)
            {
                throw new ParseException("Lexing errors:\n" + string.Join("\n", lexerErrorListener.Errors));
            }
            if (parserErrorListener.HasErrors)
            {
                throw new ParseException("Parsing errors:\n" + string.Join("\n", parserErrorListener.Errors));
            }
            
            return (tree, declarations);
        }

        public TranspilerOutput RunScript(string code)
        {
            if (string.IsNullOrEmpty(code))
            {
                return new TranspilerOutput();
            }

            (ArcscriptParser.InputContext Tree, ArcscriptContext Declarations) parsed;
            try
            {
                parsed = ParseWithContext(code);
            }
            catch (System.Exception e)
            {
                throw new ParseException(e.Message, e);
            }
            
            var tree = parsed.Tree;
            ArcscriptVisitor visitor = new ArcscriptVisitor(this.ElementId, this.Project, _emit,
                parsed.Declarations);
            object result;
            try
            {
                result = tree.Accept(visitor);
            }
            catch (System.Exception e)
            {
                throw new RuntimeException($"Error interpreting Arcscript code: {e.Message}\nCode:\n{code}", e);
            }

            // List<string> outputs = visitor.state.outputs;
            var outputResult = visitor.state.Outputs.GetText();

            var isCondition = tree.condition() != null;

            return new TranspilerOutput(outputResult, visitor.state.VariableChanges, result, isCondition);
        }

        public class TranspilerOutput
        {
            public string Output { get; private set; }
            public Dictionary<string, object> Changes { get; private set; }
            public object Result { get; private set; }
            public bool IsCondition { get; private set; }

            public TranspilerOutput()
            {
                Result = false;
                Output = "";
                Changes = new Dictionary<string, object>();
                IsCondition = false;
            }
            public TranspilerOutput(string output, Dictionary<string, object> changes, object result,
                bool isCondition = false)
            {
                this.Result = result;
                this.Output = output;
                this.Changes = changes;
                IsCondition = isCondition;
            }
        }
    }
}
