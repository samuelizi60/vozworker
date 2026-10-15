# Worker de voz (Node)

Registra o worker `tutor-voice` no LiveKit e atende dispatches criados
pela edge function `connect`.

```bash
cd agent
npm install
set LIVEKIT_URL=wss://... & set LIVEKIT_API_KEY=... & set LIVEKIT_API_SECRET=...
set OPENAI_API_KEY=sk-...
npm start
```

Para produção, rode em serviço sempre-ligado (Railway/Fly/Render/VPS) com as
mesmas 4 variáveis. O backend (`connect`) cria o dispatch com metadata
`{ scenario, voice, language, level }`; vozes `sage/ash/coral/nova` vão direto
para o TTS da OpenAI (`verse` cai para `nova`).
Eventos `tutor-events` (data channel): `{ type: 'user_transcript' |
'agent_transcript', text, at }` para legenda/correções no app.
