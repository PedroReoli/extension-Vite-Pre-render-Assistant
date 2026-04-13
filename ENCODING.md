# Guia de Caracteres de Encoding Problemático

Este arquivo documenta exemplos comuns de mojibake, normalmente gerado quando conteúdo UTF-8 é interpretado como ISO-8859-1 ou Windows-1252.

### Vogais e Cedilha (Minúsculas)
* `à` -> `Ã `
* `á` -> `Ã¡`
* `â` -> `Ã¢`
* `ã` -> `Ã£`
* `é` -> `Ã©`
* `ê` -> `Ãª`
* `í` -> `Ã­`
* `ó` -> `Ã³`
* `ô` -> `Ã´`
* `õ` -> `Ãµ`
* `ú` -> `Ãº`
* `ç` -> `Ã§`

### Vogais e Cedilha (Maiúsculas)
* `À` -> `Ã€`
* `Á` -> `Ã`
* `Â` -> `Ã‚`
* `Ã` -> `Ãƒ`
* `É` -> `Ã‰`
* `Ê` -> `ÃŠ`
* `Í` -> `Ã`
* `Ó` -> `Ã“`
* `Ô` -> `Ã”`
* `Õ` -> `Ã•`
* `Ú` -> `Ãš`
* `Ç` -> `Ã‡`

### Outros Símbolos
* `º` -> `Âº`
* `ª` -> `Âª`
* `°` -> `Â°`
* `€` -> `â‚¬`
* `–` -> `â€“`
* `—` -> `â€”`
* `“` -> `â€œ`
* `”` -> `â€`
* `’` -> `â€™`
* `•` -> `â€¢`


�