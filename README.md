# Projeto_IA – Planejador de Estudos Inteligente

Aplicação completa (FastAPI + React) que gera planos de estudo personalizados, exibe os cartões em um Kanban interativo e oferece recursos de acessibilidade por voz usando um mecanismo TTS aberto (Piper). O backend executa a lógica de IA, autenticação e persistência em PostgreSQL; o frontend (Vite/React) cuida do fluxo do usuário, dashboard e quadro de tarefas.

## Principais recursos

- Geração de planos com cards enriquecidos (tipo pedagógico, esforço, revisão, etc.).
- Kanban com destaques (“comece por aqui”), modal detalhado e mudanças de estado locais.
- Autenticação por JWT, tela inicial protegida e redirecionamentos automáticos.
- API `/api/v1/tts` servindo áudio via [Piper TTS](https://github.com/rhasspy/piper), com fallback automático para ElevenLabs (quando configurado) e para o Web Speech.
- Frontend responsivo com rotas privadas/públicas, dashboard com atalhos e acesso rápido aos últimos planos.

## Arquitetura e stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2, PostgreSQL, Uvicorn.
- **Frontend:** React 18 + Vite, TypeScript, shadcn/ui, React Query, react-router-dom.
- **IA/TTS:** Piper (self-hosted), opcional ElevenLabs, modelos internos de classificação/planejamento.
- **Outros:** Docker Compose (serviço Postgres), npm para o frontend.

Estrutura de diretórios relevante:

```
.
├── app/                  # Código FastAPI/SQLAlchemy
├── server.py             # Entrypoint FastAPI
├── migrations/           # Scripts SQL idempotentes
├── adapte-estuda-planejador-main/  # Frontend Vite/React
└── run_project.bat       # Script Windows para subir DB + API + Web
```

## Requisitos

- Python 3.12
- Node.js 18+ e npm
- PostgreSQL 16 (pode ser via Docker `docker compose up db`)
- Piper instalado (`pip install piper-tts`) + modelo `.onnx`
- Conta e chave OpenAI (para geração com GPT), opcional ElevenLabs

## Configuração do backend

1. **Crie/envie variáveis de ambiente** (arquivo `.env` já existe como referência):

   ```ini
   POSTGRES_DB=projeto_ia
   POSTGRES_USER=projeto_ia
   POSTGRES_PASSWORD=devpassword
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5433
   DATABASE_URL=postgresql+psycopg://projeto_ia:devpassword@localhost:5433/projeto_ia

   OPENAI_API_KEY=coloque_sua_chave
   JWT_SECRET=troque_este_valor

   # TTS (Piper)
   PIPER_BIN=piper                       # ou caminho completo para o executável
   PIPER_MODEL_PATH=C:/modelos/pt-br.onnx
   ```

   > Para instalar o Piper: `pip install piper-tts`. Os modelos (.onnx) estão no repositório oficial; escolha um PT‑BR e informe o caminho em `PIPER_MODEL_PATH`.

2. **Instale dependências Python** (use um venv local):

   ```bash
   python -m venv venv
   venv\Scripts\activate          # Windows
   pip install -r requirements.txt
   ```

3. **Suba o PostgreSQL**:

   ```bash
   docker compose up db -d
   ```

4. **Rode o backend**:

   ```bash
   uvicorn server:app --reload
   ```

   Ou use `run_project.bat`, que também sobe o Postgres, instala requisitos e abre o frontend em outra janela.

## Configuração do frontend

1. Entre na pasta `adapte-estuda-planejador-main`.
2. Instale as dependências:

   ```bash
   npm install
   ```

3. Execute em modo dev:

   ```bash
   npm run dev
   ```

   Por padrão o Vite roda em `http://localhost:5173`. Ajuste `VITE_API_BASE` em `.env` do frontend se precisar apontar para outro host da API.

## Fluxos principais

- **Login/Cadastro:** `/login` e `/cadastro` consomem `POST /api/v1/auth/login|register`, salvando o token em `localStorage`. Usuários autenticados são redirecionados para `/dashboard`.
- **Dashboard:** rota privada (`/dashboard`) com atalhos para criar plano, abrir Kanban e acessar o formulário principal. Busca o último plano via `GET /api/v1/plans`.
- **Plano/Kanban:** `GET /api/v1/plans/{id}` retorna plano + cards; o frontend renderiza o board, permite arrastar, abrir modal com dados, iniciar/concluir e registrar anotações (`PATCH /api/v1/plans/...`).
- **TTS:** `POST /api/v1/tts { "text": "Olá", "language": "pt" }` devolve `audio/wav` gerado pelo Piper. O hook `useLanguage` consome esse endpoint automaticamente quando o usuário ativa o modo de voz.

## Testes e desenvolvimento

- **Lint/Testes automatizados:** ainda não há scripts configurados; recomenda-se adicionar `pytest` para backend e `npm run test` (Vitest) no frontend.
- **Banco:** os scripts SQL em `migrations/` são idempotentes e executados no startup via `run_sql_migrations`.
- **TTS local:** use o comando abaixo para validar o Piper/variáveis:

  ```bash
  curl -X POST http://localhost:8000/api/v1/tts \
    -H "Content-Type: application/json" \
    -d '{"text":"Boas-vindas ao Planejador!"}' \
    --output sample.wav
  ```

## Scripts úteis

- `run_project.bat`: automatiza Docker + venv + backend + frontend (ideal para Windows).
- `uvicorn server:app --reload`: inicia só o backend em modo hot-reload.
- `npm run dev` (frontend): abre o Vite na porta 5173.

## Contribuição

1. Crie um branch a partir da base principal.
2. Execute os linters/tests (quando configurados).
3. Abra um PR descrevendo a mudança e como testar.

Sinta-se à vontade para abrir issues com bugs, sugestões de UX ou novos modelos de TTS compatíveis com Piper. Bons estudos! 🎓
