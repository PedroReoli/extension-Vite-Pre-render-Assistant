# TODO — Publicação no VS Code Marketplace

## 1. Criar conta de Publisher

- [ ] Acessar https://marketplace.visualstudio.com/manage
- [ ] Fazer login com conta Microsoft
- [ ] Criar publisher com ID `reoli`

## 2. Gerar Personal Access Token (PAT)

- [ ] Acessar https://dev.azure.com
- [ ] Clicar no ícone de perfil (canto superior direito)
- [ ] Personal Access Tokens > New Token
- [ ] Configurar:
  - Name: `vsce` (ou qualquer nome)
  - Organization: `All accessible organizations`
  - Expiration: escolher duração
  - Scopes: clicar `Show all scopes` > marcar `Marketplace > Manage`
- [ ] Copiar o token gerado (só aparece uma vez)

## 3. Login e Publicação

```bash
# Login (cola o PAT quando pedir)
npx @vscode/vsce login reoli

# Publicar
npx @vscode/vsce publish
```

## 4. Testar localmente antes de publicar (opcional)

```bash
# Gerar pacote .vsix
npx @vscode/vsce package

# Instalar no VSCode
code --install-extension vite-prerender-assistant-0.1.0.vsix
```

## 5. Atualizar versão para novas releases

Antes de publicar uma atualização:

```bash
# Patch (0.1.0 → 0.1.1)
npx @vscode/vsce publish patch

# Minor (0.1.0 → 0.2.0)
npx @vscode/vsce publish minor

# Major (0.1.0 → 1.0.0)
npx @vscode/vsce publish major
```

## 6. Pendências antes de publicar

- [ ] Ajustar URL do repositório no `package.json` para o repositório real
- [ ] Otimizar `resources/logo.png` (atualmente 1.24MB, ideal < 100KB)
- [ ] Criar README.md para o marketplace (aparece como página da extensão)
