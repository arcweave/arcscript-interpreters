lexer grammar ArcscriptLexer;

CODESTART: '<pre' (~('>'))* '><code' (~('>'))* '>' -> pushMode(CODESEGMENT);

PARAGRAPHSTART: (('<p>')|('<p ' (~('>'))* '>')) -> pushMode(PARAGRAPH);
BLOCKQUOTESTART: '<blockquote' (~('>'))* '>' -> pushMode(BLOCKQUOTE);

NORMAL_WHITESPACE: [ \t\r\n]+ -> skip;

mode PARAGRAPH;

PARAGRAPHEND: .*? '</p>' -> popMode;

mode BLOCKQUOTE;
BQ_CODESTART: '<pre' (~('>'))* '><code' (~('>'))* '>' -> pushMode(CODESEGMENT);
BQ_PARAGRAPHSTART: (('<p>')|('<p ' (~('>'))* '>')) -> pushMode(PARAGRAPH);
BLOCKQUOTEEND: '</blockquote>' -> popMode;
BQ_WHITESPACE: [ \t\r\n]+ -> skip;

mode CODESEGMENT;

CODEEND: '</code></pre>' -> popMode;

MENTION_TAG_OPEN: '<span' -> pushMode(MENTIONSEGMENT);

FLOAT: DIGIT*'.'DIGIT+;

INTEGER: DIGIT+;

DIGIT: [0-9];

LPAREN: '(';

RPAREN: ')';

ASSIGNMUL: '*=';
ASSIGNDIV: '/=';
ASSIGNADD: '+=';
ASSIGNSUB: '-=';
ASSIGNMOD: '%=';

MUL: '*';
DIV: '/';
ADD: '+';
SUB: '-';
MOD: '%';

GE: GT '=';
GT: '>' | '&gt;';
LE: LT '=';
LT: '<' | '&lt;';

EQ: '==';
NE: '!=';

AND: '&&' | '&amp;&amp;';
OR: '||';

ASSIGN: '=';
NEG: '!';

COMMA: ',';
LBRACE: '{';
RBRACE: '}';

BOOLEAN: 'true' | 'false';

FNAME: 'abs'|
  'max'|
  'min'|
  'random'|
  'roll'|
  'round'|
  'sqr'|
  'sqrt'|
  'visits';

VFNAME: 'show';

VFNAMEVARS: 'reset' | 'resetAll';

IFKEYWORD: 'if';

ELSEKEYWORD: 'else';

ELSEIFKEYWORD: 'elseif';

ENDIFKEYWORD: 'endif';

ANDKEYWORD: 'and';

ORKEYWORD: 'or';

ISKEYWORD: 'is';

NOTKEYWORD: 'not';

STRING
	: '"' STRING_CONTENT* '"'
	| '\'' STRING_CONTENT* '\''
	;
fragment STRING_CONTENT
	: ~[\\\r\n'"]
	| '\\' [abfnrtv'"\\]
	;

VARIABLE: [A-Za-z$_][0-9A-Za-z$_]*;

WHITESPACE: [ \t\r\n]+ -> skip;

mode MENTIONSEGMENT;

TAG_CLOSE: '>' -> pushMode(MENTIONLABELSEGMENT);

ATTR_NAME: [:a-zA-Z] [:a-zA-Z0-9_.-]*;

TAG_EQUALS: '=' -> pushMode(MENTION_ATTR_SEGMENT);

MENTION_TAG_CLOSE: '/span>' -> popMode;

TAG_WHITESPACE: [ \t\r\n] -> skip;

mode MENTIONLABELSEGMENT;

TAG_OPEN: '<' -> popMode;

MENTION_LABEL: ~'<'+;

mode MENTION_ATTR_SEGMENT;

ATTR_VALUE
  : ' '* ATTRIBUTE -> popMode;

ATTRIBUTE
  : DOUBLE_QUOTE_STRING
  | SINGLE_QUOTE_STRING
  | ATTCHARS
  | HEXCHARS
  | DECCHARS
  ;

fragment ATTCHARS
    : ATTCHAR+ ' '?
    ;

fragment ATTCHAR
    : '-'
    | '_'
    | '.'
    | '/'
    | '+'
    | ','
    | '?'
    | '='
    | ':'
    | ';'
    | '#'
    | [0-9a-zA-Z]
    ;

fragment HEXCHARS
    : '#' [0-9a-fA-F]+
    ;

fragment DECCHARS
    : [0-9]+ '%'?
    ;

fragment DOUBLE_QUOTE_STRING
    : '"' ~[<"]* '"'
    ;

fragment SINGLE_QUOTE_STRING
    : '\'' ~[<']* '\''
    ;
