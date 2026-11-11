using System.Collections.Generic;
using Antlr4.Runtime;
using System.IO;
using System.Linq;
using Arcweave.Interpreter.INodes;
using Arcweave.Project;

namespace Arcweave.Interpreter
{
    public class ArcscriptParserBase : Parser
    {
        private protected IProject Project { get; private set; }
        public ArcscriptContext Declarations { get; private set; }
        internal int currentLine;
        internal int openTagEndPos;

        
        
        public ArcscriptParserBase(ITokenStream input) : base(input)
        {
        }

        public ArcscriptParserBase(ITokenStream input, TextWriter output, TextWriter errorOutput) : base(input, output, errorOutput) 
        {
        }

        public void SetProject(IProject project, ArcscriptContext declarations = null) {
            this.Project = project;
            Declarations = declarations ?? new ArcscriptContext(variables: project.GetAllVariables());
        }

        public override string[] RuleNames => throw new System.NotImplementedException();

        public override IVocabulary Vocabulary => throw new System.NotImplementedException();

        public override string GrammarFileName => throw new System.NotImplementedException();

        private ParseException Error(string message, ParserRuleContext context) =>
            new ParseException(message, currentLine, context.Start.StartIndex - openTagEndPos);

        public bool assertVariable(ArcscriptParser.IdentifierContext identifierContext) {
            var variableName = identifierContext.GetText();
            
            if (Declarations.Resolve(variableName) == null)
                throw Error($"The variable {variableName} does not exist", identifierContext);
            return true;
        }

        public void assertAssignable(ArcscriptParser.IdentifierContext identifierContext)
        {
            if (Declarations.Resolve(identifierContext.GetText())?.Kind == ReferenceKind.EnumMember)
                throw Error($"Enum member {identifierContext.GetText()} is read-only", identifierContext);
            assertVariable(identifierContext);
        }

        private string ExpressionEnum(ArcscriptParser.ExpressionContext context)
        {
            if (context is ArcscriptParser.ParenthesizedExpressionContext parenthesized)
                return ExpressionEnum(parenthesized.expression());
            if (context is ArcscriptParser.IdentifierExpressionContext identifier)
                return Declarations.Resolve(identifier.identifier().GetText())?.EnumId;
            return null;
        }

        private bool IsConstantExpression(ArcscriptParser.ExpressionContext context)
        {
            if (context is ArcscriptParser.IdentifierExpressionContext identifier)
                return Declarations.Resolve(identifier.identifier().GetText())?.Kind == ReferenceKind.EnumMember;
            if (context is ArcscriptParser.LiteralExpressionContext) return true;
            if (context is ArcscriptParser.FunctionCallExpressionContext function)
            {
                var call = function.function_call();
                if (!Functions.FunctionDefinitions[call.FNAME().GetText()].IsPure) return false;
                if (call.identifier_list() != null)
                    return call.identifier_list().identifier().All(member => Declarations.Resolve(member.GetText())?.Kind == ReferenceKind.EnumMember);
                return call.argument_list()?.argument().All(argument =>
                    argument.expression() != null && IsConstantExpression(argument.expression())) ?? true;
            }
            return context.GetRuleContexts<ArcscriptParser.ExpressionContext>().All(IsConstantExpression);
        }

        public void validateEnums(ParserRuleContext context)
        {
            if (!Declarations.HasEnums || NumberOfSyntaxErrors > 0) return;
            if (context is ArcscriptParser.Statement_assignmentContext assignment &&
                Declarations.Resolve(assignment.assignable().GetText())?.EnumId is string enumId &&
                (assignment.ASSIGN() == null || ExpressionEnum(assignment.expression()) != enumId))
                throw Error("Enum assignment requires a member or variable of the same enum", context);
            if (context is ArcscriptParser.ComparisonExpressionContext comparison &&
                comparison.AND() == null && comparison.ANDKEYWORD() == null &&
                comparison.OR() == null && comparison.ORKEYWORD() == null)
            {
                var left = ExpressionEnum(comparison.expression(0));
                var right = ExpressionEnum(comparison.expression(1));
                if (left != null && right != null && left != right)
                    throw Error("Cannot compare different enum types", context);
                if ((left != null && right == null && IsConstantExpression(comparison.expression(1))) ||
                    (right != null && left == null && IsConstantExpression(comparison.expression(0))))
                    throw Error("Enum comparisons with constants require a named member", context);
                var id = left ?? right;
                if (id != null && (comparison.LT() != null || comparison.GT() != null ||
                    comparison.LE() != null || comparison.GE() != null) && Declarations.EnumType(id) != typeof(int))
                    throw Error("Only integer enums support ordering", context);
            }
        }

        public bool assertMention(IList<ArcscriptParser.Mention_attributesContext> attrCtxList) {
            Dictionary<string, string> attrs = new Dictionary<string, string>();
            foreach ( var attrCtx in attrCtxList ) {
                string attrName = attrCtx.GetToken(ArcscriptParser.ATTR_NAME, 0)?.GetText();
                string attrValue = attrCtx.GetToken(ArcscriptParser.ATTR_VALUE, 0)?.GetText() ?? "";
                if ( attrValue.StartsWith("\"") && attrValue.EndsWith("\"") ) {
                    attrValue = attrValue.Substring(1, attrValue.Length - 2);
                } else if ( attrValue.StartsWith("'") && attrValue.EndsWith("'") ) {
                    attrValue = attrValue.Substring(1, attrValue.Length - 2);
                }
                attrs.Add(attrName, attrValue);
            }
            string[] classList = attrs["class"].Split(' ');
            if ( !classList.Contains("mention") ) {
                return false;
            }
            if ( attrs["data-type"] != "element" ) {
                return false;
            }
            if ( this.Project.ElementWithId(attrs["data-id"]) == null ) {
                return false;
            }
            return true;
        }

        public bool assertFunctionArguments(IToken fname, ArcscriptParser.Argument_listContext argumentListContext) {
            int argListLength = 0;
            if ( argumentListContext != null && argumentListContext.argument() != null ) {
                argListLength = argumentListContext.argument().Length;
            }
            var min = Functions.FunctionDefinitions[fname.Text].MinArgs;
            var max = Functions.FunctionDefinitions[fname.Text].MaxArgs;
            var argType = Functions.FunctionDefinitions[fname.Text].ArgumentsType;
            if ( ( min != null && argListLength < min ) || ( max != null && argListLength > max ) ) {
                throw new RecognitionException("Incorrect number of arguments for function " + fname.Text, this, this.InputStream, this.Context);
            }
            
            if (argType != null && argumentListContext != null && argumentListContext.argument() != null)
            {
                if (argType == typeof(Variable))
                {
                    throw new RecognitionException("Function " + fname.Text + " accepts variables as arguments", this, this.InputStream, this.Context);
                }
            }
            
            return true;
        }

        public bool assertFunctionArguments(IToken fname, ArcscriptParser.Identifier_listContext identifierListContext) {
            int identifierListLength = 0;
            if (identifierListContext != null && identifierListContext.identifier() != null)
            {
                identifierListLength = identifierListContext.identifier().Length;
            }
            
            var min = Functions.FunctionDefinitions[fname.Text].MinArgs;
            var max = Functions.FunctionDefinitions[fname.Text].MaxArgs;
            if (Functions.FunctionDefinitions[fname.Text].ArgumentsType == typeof(Variable) && identifierListContext != null)
                foreach (var identifier in identifierListContext.identifier()) assertAssignable(identifier);
            if ( ( min != null && identifierListLength < min ) || ( max != null && identifierListLength > max ) ) {
                throw new RecognitionException("Incorrect number of arguments for function " + fname.Text, this, this.InputStream, this.Context);
            }
            
            return true;
        }

        internal void setLineStart(IToken token)
        {
            openTagEndPos = token.StartIndex + token.Text.Length;
        }
    }

}
