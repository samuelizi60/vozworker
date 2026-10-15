# VozWorker — tutor de voz do PingoClone (LiveKit Agents)

## Rodar local
```bash
npm install
set LIVEKIT_URL=wss://... & set LIVEKIT_API_KEY=... & set LIVEKIT_API_SECRET=...
set AI_PROVIDER=groq & set GROQ_API_KEY=gsk_...
set LIVEKIT_AGENTS_PRELOAD_LOCAL_INFERENCE=0
npm start
```

## Produção (Railway)
Variáveis: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
`AI_PROVIDER=groq`, `GROQ_API_KEY`, `LIVEKIT_AGENTS_PRELOAD_LOCAL_INFERENCE=0`.
Start command: `npm start`.
