# Como os relatórios do Power BI leem as imagens

## O problema que isso resolve

As consultas `IMAGEM` e `CAPA` liam a listagem de fotos chamando a **API do
GitHub**:

```
https://api.github.com/repos/mateusm23/portal-obras-imagens/contents/Obras/GARDEN/fotos_andamento
```

Essa API, sem token, permite **60 requisições por hora por IP**. Como o IP de
saída do escritório é compartilhado por todo mundo, o teto estourava e o GitHub
respondia `HTTP 403`, que o Power BI exibe como:

> O acesso ao recurso é proibido.

Parecia falta de permissão no repositório, mas era só limite de requisições.

## A solução

Um workflow (`.github/workflows/gerar-index.yml`) roda o script
`scripts/gerar_index.py` sempre que algo muda em `Obras/`, e publica um
**`index.json`** na raiz do repositório com a listagem completa de todas as
imagens de todas as obras.

O Power BI passa a ler esse arquivo único via **`raw.githubusercontent.com`**,
que **não tem o limite de 60/h** e **não exige token** (o repositório é público).

Isso é automático: quem sobe foto pelo `upload.html` não precisa fazer mais nada.

### Formato do index.json

```json
{
  "gerado_em": "2026-11-17T21:42:20+00:00",
  "repo": "mateusm23/portal-obras-imagens",
  "branch": "main",
  "total": 346,
  "arquivos": [
    {
      "obra": "GARDEN",
      "tipo": "fotos_andamento",
      "ordem": 1,
      "name": "01. Be Garden - imagem.jpeg",
      "url": "https://raw.githubusercontent.com/mateusm23/portal-obras-imagens/main/Obras/GARDEN/fotos_andamento/01.%20Be%20Garden%20-%20imagem.jpeg"
    }
  ]
}
```

`tipo` é sempre `fotos_andamento` ou `foto_capa`. O `.gitkeep` já vem filtrado.

---

## Código das consultas

Substitua o código das consultas no Editor do Power Query
(**Página Inicial → Editor Avançado**). As colunas de saída continuam sendo
`Name`, `URL_Imagem` e `Indice`, exatamente como antes — nenhum visual, medida
ou relacionamento precisa ser mexido.

**Só a linha `Obra = "..."` muda de relatório para relatório.**

### Consulta `IMAGEM`

```m
let
    // ---- unico ajuste por relatorio ----
    Obra = "GARDEN",
    Tipo = "fotos_andamento",

    // Le a listagem publicada pelo GitHub Actions. O host fica separado do
    // caminho (RelativePath) para o Power BI Service validar a credencial do
    // site uma unica vez.
    Fonte = Json.Document(
        Web.Contents(
            "https://raw.githubusercontent.com",
            [RelativePath = "mateusm23/portal-obras-imagens/main/index.json"]
        )
    ),

    Tabela     = Table.FromRecords(Fonte[arquivos]),
    Filtrado   = Table.SelectRows(Tabela, each [obra] = Obra and [tipo] = Tipo),
    Ordenado   = Table.Sort(Filtrado, {{"ordem", Order.Ascending}}),
    Renomeado  = Table.RenameColumns(Ordenado, {{"name", "Name"}, {"url", "URL_Imagem"}}),
    Colunas    = Table.SelectColumns(Renomeado, {"Name", "URL_Imagem"}),
    Tipado     = Table.TransformColumnTypes(Colunas, {{"Name", type text}, {"URL_Imagem", type text}}),
    Indice     = Table.AddIndexColumn(Tipado, "Indice", 1, 1, Int64.Type)
in
    Indice
```

### Consulta `CAPA`

Idêntica, trocando apenas o `Tipo`:

```m
let
    // ---- unico ajuste por relatorio ----
    Obra = "GARDEN",
    Tipo = "foto_capa",

    Fonte = Json.Document(
        Web.Contents(
            "https://raw.githubusercontent.com",
            [RelativePath = "mateusm23/portal-obras-imagens/main/index.json"]
        )
    ),

    Tabela     = Table.FromRecords(Fonte[arquivos]),
    Filtrado   = Table.SelectRows(Tabela, each [obra] = Obra and [tipo] = Tipo),
    Ordenado   = Table.Sort(Filtrado, {{"ordem", Order.Ascending}}),
    Renomeado  = Table.RenameColumns(Ordenado, {{"name", "Name"}, {"url", "URL_Imagem"}}),
    Colunas    = Table.SelectColumns(Renomeado, {"Name", "URL_Imagem"}),
    Tipado     = Table.TransformColumnTypes(Colunas, {{"Name", type text}, {"URL_Imagem", type text}}),
    Indice     = Table.AddIndexColumn(Tipado, "Indice", 1, 1, Int64.Type)
in
    Indice
```

---

## Na primeira atualização

O Power BI vai pedir credencial para o site novo `raw.githubusercontent.com`:

1. Escolha **Anônimo**
2. Nível de privacidade: **Público**
3. Conectar

Não há token envolvido — o repositório é público.

A coluna `URL_Imagem` deve continuar com **Categoria de dados = URL da Imagem**
(aba *Modelagem*). Se o código foi só substituído, essa configuração se mantém.

## Observações

- **Cache de ~5 minutos.** O `raw.githubusercontent.com` serve por CDN. Depois
  de subir fotos novas, pode levar até uns 5 minutos para o `index.json` novo
  aparecer. Se precisar forçar, atualize de novo após esse intervalo.
- **Nomes dos arquivos definem a ordem.** O prefixo numérico (`01.`, `02.`, …)
  é o que ordena as fotos no relatório. A ordenação é natural, então `2.` vem
  antes de `10.` mesmo sem zero à esquerda.
- **Obra nova** entra sozinha no `index.json` assim que a primeira foto é
  enviada. Basta criar a consulta com `Obra = "NOME DA OBRA"`.
- **Nome da obra** no `Obra = "..."` precisa bater exatamente com o nome da
  pasta em `Obras/` (maiúsculas, acentos e espaços incluídos).
