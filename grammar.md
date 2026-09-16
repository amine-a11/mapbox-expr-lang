```ebnf
statement  ::= NEWLINE* stmt (NEWLINE+ stmt)* NEWLINE*

stmt       ::= KEYWORD:VAR IDENTIFIER EQ expr
             | expr

expr       ::= comp-expr ( ( KEYWORD:and | KEYWORD:or ) comp-expr)*

comp-expr  ::= KEYWORD:not comp-expr
             | arith-expr ( ( EE | NE | LT | LTE | GT | GTE ) arith-expr)*

arith-expr ::= term ( ( PLUS | MINUS ) term )*

term       ::= factor ( ( MUL | DIV | MOD ) factor )*

factor     ::= ( PLUS | MINUS ) factor
             | power

power      ::= atom ( POW factor )*

atom       ::= INT
             | FLOAT
             | STRING
             | IDENTIFIER ( DOT IDENTIFIER | LPAREN ( expr ( COMMA expr )* )? RPAREN )?
             | KEYWORD:true
             | KEYWORD:false
             | LPAREN expr RPAREN
             | KEYWORD:get LPAREN STRING RPAREN
             | if-expr
             | match-expr
             | interpolate-expr
             | step-expr

if-expr    ::= KEYWORD:if expr KEYWORD:then NEWLINE* expr
               ( NEWLINE* KEYWORD:elif expr KEYWORD:then NEWLINE* expr )*
               NEWLINE* KEYWORD:else NEWLINE* expr

match-expr ::= KEYWORD:match expr NEWLINE*
               ( match-labels KEYWORD:then NEWLINE* expr NEWLINE* )+
               KEYWORD:else NEWLINE* expr

match-labels ::= match-label ( COMMA match-label )*

match-label  ::= INT | FLOAT | STRING

interpolate-expr ::= ( KEYWORD:interpolate | KEYWORD:interpolateHcl | KEYWORD:interpolateLab )
                      interpolation-type expr NEWLINE*
                      ( stop-input KEYWORD:then NEWLINE* expr NEWLINE* )+

interpolation-type ::= IDENTIFIER:"linear"
                      | IDENTIFIER:"exponential" LPAREN expr RPAREN
                      | IDENTIFIER:"cubicBezier" LPAREN expr COMMA expr COMMA expr COMMA expr RPAREN

step-expr  ::= KEYWORD:step expr NEWLINE*
               KEYWORD:default expr NEWLINE*
               ( stop-input KEYWORD:then NEWLINE* expr NEWLINE* )+

stop-input ::= INT | FLOAT

```