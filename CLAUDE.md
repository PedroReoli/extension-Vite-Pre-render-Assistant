# AGENTS.md

Este arquivo define regras obrigatórias para qualquer agente de IA que atue neste repositório.
Todas as instruções abaixo devem ser seguidas estritamente.

## 1. Contexto do Projeto

Além deste arquivo, o agente deve ler e seguir obrigatoriamente:

`./docs/ai/project-rules.md`

Esse arquivo contém:
- regras de negócio
- contratos entre sistemas
- contexto funcional
- restrições específicas do projeto
- decisões arquiteturais não universais

## 2. Hierarquia de Instruções

Ordem de prioridade:

1. Solicitação atual do usuário
2. `AGENTS.md`
3. Arquivo de contexto do projeto
4. Padrões já existentes no código

## 3. Codificação de Texto

### 3.1 Encoding obrigatório

- Padrão obrigatório: `UTF-8`
- Todos os arquivos devem ser tratados como `UTF-8`
- Nunca assumir outro encoding

Todo texto deve suportar corretamente:
- acentuação da língua portuguesa
- caracteres especiais
- Unicode válido

É proibido:
- quebrar acentuação
- gerar caracteres corrompidos
- substituir caracteres válidos incorretamente

### 3.2 Problemas de encoding

Se houver caracteres estranhos:

1. Reinterpretar o arquivo como `UTF-8`
2. Verificar novamente

Se o problema persistir:
- não modificar essas linhas
- não recriar o arquivo por causa desse trecho
- informar o usuário com arquivo e linhas afetadas

## 4. Idioma e Comunicação

### 4.1 Idioma

- Todo conteúdo deve estar em português com grafia correta
- Não gerar palavras truncadas ou sem acentuação
- Evitar mistura desnecessária de idiomas
- Manter consistência terminológica

### 4.2 Comunicação com o usuário

- Linguagem técnica, clara e objetiva
- Sem emojis
- Sem redundância
- Sem explicações desnecessárias

## 5. Regras Gerais de Código

- Não alterar código fora do escopo solicitado
- Não refatorar sem autorização
- Manter o padrão existente
- Presumir `UTF-8` sempre

## 6. Processo Seguro de Edição

Antes de modificar qualquer arquivo:

1. Ler o arquivo completo
2. Confirmar o encoding
3. Validar que o conteúdo corresponde ao esperado

Se houver inconsistência:
- parar
- não reconstruir o arquivo
- informar o usuário

Se houver falha de patch por divergência de linhas:
- interromper a modificação
- informar o usuário
- não tentar contornar recriando conteúdo no escuro

## 7. Verificação de Impacto

Antes de alterar:
- entender o contexto completo
- verificar dependências
- validar impacto da mudança

Se houver dúvida:
- perguntar antes de alterar

## 8. Limite de Alterações

Modificar apenas o mínimo necessário.

É proibido:
- alterar lógica não relacionada
- renomear sem necessidade
- reorganizar estrutura sem pedido
- alterar configurações sem necessidade direta

Se alguma dessas mudanças for necessária:
- parar
- explicar o motivo
- pedir autorização

## 9. Criação de Arquivos

- Não criar arquivos sem autorização

Exceção:
- quando for estritamente necessário para modularização ou clareza arquitetural

Nesses casos:
- justificar a criação
- explicar a estrutura

## 10. Execução de Comandos

- Não executar comandos que alterem ambiente sem autorização

## 11. Commits

Usar `Conventional Commits`:

```text
tipo(escopo): descrição
```

Tipos permitidos:
- `feat`
- `fix`
- `refactor`
- `docs`
- `style`
- `chore`
- `test`

A sugestão de commit deve aparecer no final da resposta quando houver modificação de arquivos.

## 12. Manutenibilidade e Modularização

### 12.1 Limite de arquivo

- Ideal: até 500 linhas

Se ultrapassar sem necessidade:
- modularizar

### 12.2 Organização

Separar responsabilidades conforme o contexto:
- `hooks` para lógica reutilizável
- `services` para integração externa
- `utils` para funções puras
- `components` para UI
- `validators` ou `schemas` para validação

Evitar:
- arquivos com múltiplas responsabilidades
- acoplamento alto

## 13. Layout e Interface

- Layout compacto
- Alta densidade de informação
- Evitar espaços desnecessários
- Evitar rolagem excessiva

Antes de finalizar alterações de interface:
- revisar alinhamento
- revisar responsividade
- revisar consistência visual

## 14. Documentação

Sempre documentar mudanças relevantes.

Inclui:
- endpoints
- jobs
- integrações
- autenticação
- regras de negócio

### 14.1 Backend

Documentação mínima:
- objetivo
- rota e método
- autenticação
- inputs
- outputs
- erros
- validações

### 14.2 Local da documentação

Salvar em:

`docs/`

### 14.3 Definição de pronto

Backend só está completo quando:
- código atualizado
- documentação atualizada

## 15. Segurança

Este projeto deve ser tratado como:
- ambiente de produção real
- sujeito a pentest profissional

### 15.1 Princípios

- defesa em profundidade
- camadas independentes
- falha isolada não deve comprometer o sistema inteiro

### 15.2 Backend

- nunca confiar no frontend
- toda validação deve existir no backend
- autenticação e autorização devem estar no backend

### 15.3 Autenticação

Quando utilizar tokens, como JWT:
- definir expiração adequada
- usar refresh token
- aplicar rotação segura
- invalidar quando necessário
- proteger contra replay
- mitigar vazamento

## 16. Checklist Final

Antes de concluir qualquer tarefa:
- escopo atendido corretamente
- nenhuma alteração desnecessária
- `UTF-8` preservado
- português correto
- layout revisado, se aplicável
- impacto avaliado
- documentação atualizada
- modularização adequada
- nenhum arquivo cresceu desnecessariamente

## 17. Comportamento do Agente

O agente deve:
- perguntar quando houver dúvida
- não assumir requisitos não informados
- não extrapolar o escopo
- seguir este arquivo rigorosamente

## 18. Autoridade

Este arquivo define o comportamento padrão dos agentes neste repositório.

Deve ser seguido em todos os casos.
