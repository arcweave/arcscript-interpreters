parser grammar ArcscriptParser;

// Insert here @header for C++ parser.

options {
	tokenVocab = ArcscriptLexer;
	superClass = ArcscriptParserBase;
}

input: script EOF | codestart expression codeend EOF;

script: script_section+;

script_section:
	blockquote+?
	| paragraph+?
	| assignment_segment
	| function_call_segment
	| conditional_section;

blockquote:
	BLOCKQUOTESTART (
		paragraph
		| assignment_segment
		| function_call_segment
	)* BLOCKQUOTEEND;

paragraph: paragraph_start PARAGRAPHEND { this.currentLine++;};

paragraph_start:
	PARAGRAPHSTART { this.setLineStart($PARAGRAPHSTART); }
	| BQ_PARAGRAPHSTART { this.setLineStart($BQ_PARAGRAPHSTART); };

codestart:
	CODESTART { this.currentLine++; this.setLineStart($CODESTART);}
	| BQ_CODESTART { this.currentLine++; this.setLineStart($BQ_CODESTART);};

codeend: CODEEND;

assignment_segment: codestart statement_assignment codeend;

function_call_segment:
	codestart statement_function_call codeend;

conditional_section:
	if_section else_if_section* else_section? endif_segment;

if_section: codestart if_clause codeend script;

else_if_section: codestart else_if_clause codeend script;

else_section: codestart ELSEKEYWORD codeend script;

if_clause: IFKEYWORD expression;

else_if_clause: ELSEIFKEYWORD expression;

endif_segment: codestart ENDIFKEYWORD codeend;

statement_assignment:
	assignable (
		ASSIGNADD
		| ASSIGNSUB
		| ASSIGNMUL
		| ASSIGNDIV
		| ASSIGNMOD
		| ASSIGN
	) expression;

assignable: IDENTIFIER {this.assertVariable($IDENTIFIER);};

statement_function_call:
	function_call {this.assertFunctionReturnValue($function_call.ctx, false);};

identifier_list:
	IDENTIFIER {this.assertVariable($IDENTIFIER);} (
		',' IDENTIFIER {this.assertVariable($IDENTIFIER);}
	)*;

argument_list: argument (',' argument)*;

argument: expression | mention;

mention:
	MENTION_TAG_OPEN attr += mention_attributes* '>' MENTION_LABEL? TAG_OPEN MENTION_TAG_CLOSE {this.assertMention($attr)
		}?;

mention_attributes: ATTR_NAME (TAG_EQUALS ATTR_VALUE)?;

expression:
	expression '.' IDENTIFIER												# MemberExpression
	| (NEG | NOTKEYWORD) expression											# UnaryExpression
	| ADD expression														# UnaryExpression
	| SUB expression														# UnaryExpression
	| expression (MUL | DIV | MOD) expression								# MultiplicativeExpression
	| expression (ADD | SUB) expression										# AdditiveExpression
	| expression (LT | GT | LE | GE) expression								# ComparisonExpression
	| expression (EQ | NE | (ISKEYWORD NOTKEYWORD) | ISKEYWORD) expression	# ComparisonExpression
	| expression (AND | ANDKEYWORD) expression								# ComparisonExpression
	| expression (OR | ORKEYWORD) expression								# ComparisonExpression
	| IDENTIFIER {this.assertVariable($IDENTIFIER);}						# IdentifierExpression
	| '(' expression ')'													# ParenthesizedExpression
	| function_call {this.assertFunctionReturnValue($function_call.ctx);}	# FunctionCallExpression
	| literal																# LiteralExpression;

literal: BOOLEAN | STRING | numeric_literal;

numeric_literal: FLOAT | INTEGER;

function_call:
	FNAME LPAREN identifier_list? RPAREN {this.assertFunctionArguments($FNAME, $identifier_list.ctx);
		}
	| FNAME LPAREN argument_list? RPAREN {this.assertFunctionArguments($FNAME, $argument_list.ctx);}
		;

// expression: STRING | BOOLEAN | additive_numeric_expression;