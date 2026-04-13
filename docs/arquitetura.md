# Arquitetura — Vite Pre-render Assistant

## Visao geral

Extensao para VSCode dividida em cinco modulos com responsabilidades isoladas.

## Modulos

### Detector (`src/detector.ts`)

- Verifica se o workspace contem um projeto Vite
- Valida presenca de `package.json` e dependencia `vite`
- Executado na ativacao da extensao

### Config Manager (`src/configManager.ts`)

- Unica camada que le e escreve `prerender.config.json`
- Cria o arquivo com configuracao padrao se nao existir
- Nunca sobrescreve dados existentes sem validacao
- Detecta arquivos corrompidos e avisa o usuario

### Route Manager (`src/routeManager.ts`)

- Gerencia rotas: listar, adicionar, remover, ativar/desativar
- Persiste estado via Config Manager
- Normaliza paths (garante `/` inicial, remove `/` final)
- Ignora duplicatas

### Runner (`src/runner.ts`)

- Executa `vite build` seguido de script de pre-render
- Usa terminal integrado do VSCode
- Instala dependencias se `node_modules` nao existir
- Gera script temporario `prerender.script.mjs` com rotas habilitadas
- Avisa se nenhuma rota estiver habilitada

### Webview Panel (`src/webview/`)

- `panel.ts`: gerencia ciclo de vida do painel
- `getHtml.ts`: gera HTML com CSS integrado usando variaveis do VSCode
- Comunicacao com backend via `postMessage`

## Arquivo de configuracao

Localizado em `prerender.config.json` na raiz do projeto alvo:

```json
{
  "routes": [
    { "path": "/", "enabled": true },
    { "path": "/sobre", "enabled": false }
  ]
}
```

## Comandos registrados

| Comando | Descricao |
|---|---|
| `vitePrerender.openPanel` | Abre o painel da extensao |
| `vitePrerender.run` | Executa build + pre-render |

## Fluxo de ativacao

1. VSCode detecta `package.json` no workspace
2. `activate()` chama `detectViteProject()`
3. Se for Vite: registra comandos, instancia modulos
4. Se nao for Vite: registra comandos com aviso

## Observador de arquivo

A extensao observa mudancas em `prerender.config.json` via `FileSystemWatcher` e atualiza o painel automaticamente quando o usuario edita o arquivo manualmente.
