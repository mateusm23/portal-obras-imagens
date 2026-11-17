#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera o index.json com a listagem de todas as imagens do portal.

POR QUE ISSO EXISTE
-------------------
Os relatorios do Power BI antes liam a listagem de fotos chamando a API do
GitHub (api.github.com/.../contents/...). Essa API, quando usada sem token,
permite apenas 60 requisicoes por hora POR IP -- e o IP de saida do escritorio
e compartilhado por todo mundo. Quando o teto estourava, a API devolvia
HTTP 403 e o Power BI mostrava "O acesso ao recurso e proibido".

Com o index.json o Power BI passa a ler um unico arquivo estatico via
raw.githubusercontent.com, que NAO esta sujeito a esse limite de 60/h e nao
exige token nenhum (o repositorio e publico).

COMO RODA
---------
Automaticamente, pelo workflow .github/workflows/gerar-index.yml, toda vez que
algo muda dentro de Obras/ (inclusive uploads feitos pelo upload.html).
Ninguem precisa rodar na mao.

Para rodar localmente, se precisar:  python scripts/gerar_index.py
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

# O workflow sobrescreve via variavel de ambiente; os valores abaixo sao o
# padrao para execucao local.
REPO = os.environ.get("INDEX_REPO", "mateusm23/portal-obras-imagens")
BRANCH = os.environ.get("INDEX_BRANCH", "main")
RAW_BASE = "https://raw.githubusercontent.com"

RAIZ = Path(__file__).resolve().parent.parent
PASTA_OBRAS = RAIZ / "Obras"
SAIDA = RAIZ / "index.json"

# Subpastas esperadas dentro de cada obra.
TIPOS = ("foto_capa", "fotos_andamento")

# Só entram arquivos de imagem. Isso descarta .gitkeep automaticamente, entao
# o Power BI nao precisa mais filtrar ".gitkeep" na consulta.
EXTENSOES = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic", ".avif"}


def chave_natural(nome: str) -> list:
    """Ordenacao natural: '2. foto' vem antes de '10. foto'.

    A ordenacao alfabetica comum colocaria '10.' antes de '2.', baguncando a
    sequencia das fotos de andamento no relatorio.
    """
    partes = re.split(r"(\d+)", nome.casefold())
    return [(1, int(p)) if p.isdigit() else (0, p) for p in partes]


def url_raw(*segmentos: str) -> str:
    """Monta a URL raw ja com cada segmento do caminho escapado.

    Necessario porque os nomes tem espaco, acento e virgula
    (ex.: "01. Be Garden - reboco.jpeg", a obra "E O AMOR").
    """
    caminho = "/".join(quote(s, safe="") for s in segmentos)
    return f"{RAW_BASE}/{REPO}/{BRANCH}/{caminho}"


def coletar() -> list[dict]:
    arquivos: list[dict] = []

    if not PASTA_OBRAS.is_dir():
        raise SystemExit(f"Pasta nao encontrada: {PASTA_OBRAS}")

    pastas_obra = sorted(
        (p for p in PASTA_OBRAS.iterdir() if p.is_dir()),
        key=lambda p: chave_natural(p.name),
    )

    for pasta_obra in pastas_obra:
        for tipo in TIPOS:
            pasta_tipo = pasta_obra / tipo
            if not pasta_tipo.is_dir():
                continue

            imagens = [
                f
                for f in pasta_tipo.iterdir()
                if f.is_file() and f.suffix.casefold() in EXTENSOES
            ]
            imagens.sort(key=lambda f: chave_natural(f.name))

            for ordem, img in enumerate(imagens, start=1):
                arquivos.append(
                    {
                        "obra": pasta_obra.name,
                        "tipo": tipo,
                        "ordem": ordem,
                        "name": img.name,
                        "url": url_raw("Obras", pasta_obra.name, tipo, img.name),
                    }
                )

    return arquivos


def main() -> None:
    arquivos = coletar()

    documento = {
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "repo": REPO,
        "branch": BRANCH,
        "total": len(arquivos),
        "arquivos": arquivos,
    }

    SAIDA.write_text(
        json.dumps(documento, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    obras = {a["obra"] for a in arquivos}
    capas = sum(1 for a in arquivos if a["tipo"] == "foto_capa")
    print(
        f"index.json gerado: {len(arquivos)} imagens "
        f"({capas} capas) em {len(obras)} obras"
    )


if __name__ == "__main__":
    main()
