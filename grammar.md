```ebnf

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
             | KEYWORD:true
             | KEYWORD:false
             | LPAREN expr RPAREN
             | KEYWORD:get LPAREN STRING RPAREN

```
