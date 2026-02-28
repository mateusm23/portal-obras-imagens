# Como Adicionar uma Nova Obra ao Portal

## Pré-requisitos
- Node.js instalado
- Arquivo `upload_portal.js` na pasta do projeto

---

## Passo 1 — Adicionar o nome no portal

Abra o arquivo `INDEX.HTML` e localize o array `S.obras` (busque por `obras:`).

Adicione o nome da nova obra seguindo o padrão existente:

```javascript
obras: [
  'MAISON',
  'PARQUE DOS INGLESES - LIVERPOOL',
  'PARQUE DOS INGLESES - LONDRES',
  'NOME DA NOVA OBRA',   // ← adicionar aqui
],
```

Salve o arquivo.

---

## Passo 2 — Criar as pastas no GitHub

Acesse: `github.com/mateusm23/portal-obras-imagens`

**Pasta 1 — Capa:**
1. Clique em **Add file → Create new file**
2. Digite no nome:
   ```
   Obras/NOME DA NOVA OBRA/foto_capa/.gitkeep
   ```
3. Deixe o conteúdo vazio e clique em **Commit changes**

**Pasta 2 — Andamento:**
1. Clique em **Add file → Create new file**
2. Digite no nome:
   ```
   Obras/NOME DA NOVA OBRA/fotos_andamento/.gitkeep
   ```
3. Deixe o conteúdo vazio e clique em **Commit changes**

---

## Passo 3 — Publicar o portal atualizado

No terminal, dentro da pasta do projeto:

```bash
node upload_portal.js
```

Resultado esperado:
```
OK  index.html publicado no repositório!
```

A nova obra aparece no portal em até 1 minuto.

---

## Resumo

| Passo | Onde | O que fazer |
|-------|------|-------------|
| 1 | `INDEX.HTML` local | Adicionar nome em `S.obras` |
| 2 | GitHub (site) | Criar 2 pastas com `.gitkeep` |
| 3 | Terminal | `node upload_portal.js` |
