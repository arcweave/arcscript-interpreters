parser grammar ArcscriptParser;

// Insert here @header for C++ parser.

options {
	tokenVocab = ArcscriptLexer;
	superClass = ArcscriptParserBase;
}

input: script EOF | codestart compound_condition_or codeend EOF;

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

if_clause: IFKEYWORD compound_condition_or;

else_if_clause: ELSEIFKEYWORD compound_condition_or;

endif_segment: codestart ENDIFKEYWORD codeend;

statement_assignment:
	VARIABLE (
		ASSIGNADD
		| ASSIGNSUB
		| ASSIGNMUL
		| ASSIGNDIV
		| ASSIGN
	) compound_condition_or {this.assertVariable($VARIABLE);};

statement_function_call: void_function_call;

argument_list: argument (',' argument)*;

argument: additive_numeric_expression | STRING | mention;

mention:
	MENTION_TAG_OPEN attr += mention_attributes* '>' MENTION_LABEL? TAG_OPEN MENTION_TAG_CLOSE {this.assertMention($attr)
		}?;

mention_attributes: ATTR_NAME (TAG_EQUALS ATTR_VALUE)?;

additive_numeric_expression:
	multiplicative_numeric_expression
	| additive_numeric_expression (ADD | SUB) multiplicative_numeric_expression;

multiplicative_numeric_expression:
	signed_unary_numeric_expression
	| multiplicative_numeric_expression (MUL | DIV) signed_unary_numeric_expression;

signed_unary_numeric_expression:
	sign unary_numeric_expression
	| unary_numeric_expression;

unary_numeric_expression:
	FLOAT
	| VARIABLE {this.assertVariable($VARIABLE);}
	| INTEGER
	| STRING
	| BOOLEAN
	| function_call
	| LPAREN compound_condition_or RPAREN;

function_call:
	FNAME LPAREN argument_list? RPAREN {this.assertFunctionArguments($FNAME, $argument_list.ctx);};

void_function_call:
	VFNAME LPAREN argument_list? RPAREN {this.assertFunctionArguments($VFNAME, $argument_list.ctx);}
	| VFNAMEVARS LPAREN variable_list? RPAREN {this.assertFunctionArguments($VFNAMEVARS, $variable_list.ctx);
		};

sign: ADD | SUB;

variable_list:
	VARIABLE (',' VARIABLE)* {this.assertVariable($VARIABLE);};

compound_condition_or:
	compound_condition_and (
		( OR | ORKEYWORD) compound_condition_or
	)?;

compound_condition_and:
	negated_unary_condition (
		(AND | ANDKEYWORD) compound_condition_and
	)?;

negated_unary_condition: (NEG | NOTKEYWORD)? unary_condition;

unary_condition: condition;

condition: expression (conditional_operator expression)?;

conditional_operator:
	GT
	| GE
	| LT
	| LE
	| EQ
	| NE
	| ISKEYWORD
	| ISKEYWORD NOTKEYWORD;

expression: STRING | BOOLEAN | additive_numeric_expression;