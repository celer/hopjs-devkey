/*
 * Classic example grammar, which recognizes simple arithmetic expressions like
 * "2*(3+4)". The parser generated from this grammar then computes their value.
 */

start
  = not

not
  = _ "!" _ and:and { return { not: and } }
  / and:and { return and; }

and
  = left:or _ "&&" _ right:not { return { and: [ left, right ] } }
  / or

or
  = left:primary _ "||" _ right:not { return { or: [ left, right ] } }
  / primary

primary
  = test
  / "(" _ not:not _ ")" {  return not; }


hexDigit
  = [0-9a-fA-F]

test
  = path:[A-Za-z0-9/-/_\[\]\*\^\$\!\.]+ _ ":" _ value:value { return { path:path.join(""), value:value }}

value
  = digit:digit { return digit; }
  / string:string { return string; }
  / boolean:boolean { return boolean; }
  / regex:regex { return regex; }

digit
  = digit:[0-9\.\e]+  { return digit.join(""); }

string "string"
  = '"' '"' _             { return "";    }
  / '"' chars:chars '"' _ { return chars; }
  / '\'' chars:chars '\'' _ { return chars; }

regex 
  = '/' '/' _             { return new RegExp("");    }
  / '/' rechars:rechars '/' modifiers:[igm]*  _ { return new RegExp(rechars,modifiers.join("")); }

chars
  = chars:char+ { return chars.join(""); }

rechars
  = rechars:rechar+ { return rechars.join(""); }

rechar
  = [A-Za-z0-9\.\+\*\$\^\(\)\[\]\{\}\@\#\%\&\_\-\=\,\;\:\"\'\?]
  / '\\"'  { return '"';  }
  / "\\\\" { return "\\"; }
  / "\\\\/"  { return "\/"; }
  / "\\b"  { return "\b"; }
  / "\\f"  { return "\f"; }
  / "\\n"  { return "\n"; }
  / "\\r"  { return "\r"; }
  / "\\t"  { return "\t"; }
  / "\\s"  { return "\s"; }
  / "\\w"  { return "\w"; }
  / "\\u" digits:$(hexDigit hexDigit hexDigit hexDigit) {
      return String.fromCharCode(parseInt(digits, 16));
    }

char
  // In the original JSON grammar: "any-Unicode-character-except-"-or-\-or-control-character"
  = [^"\\\0-\x1F\x7f]
  / '\\"'  { return '"';  }
  / "\\\\" { return "\\"; }
  / "\\/"  { return "/";  }
  / "\\b"  { return "\b"; }
  / "\\f"  { return "\f"; }
  / "\\n"  { return "\n"; }
  / "\\r"  { return "\r"; }
  / "\\t"  { return "\t"; }
  / "\\u" digits:$(hexDigit hexDigit hexDigit hexDigit) {
      return String.fromCharCode(parseInt(digits, 16));
    }

boolean
  = "true" { return true; }
  / "false" { return false; }

_ "whitespace"
  = whitespace*

whitespace
  = [ \t\n\r]
