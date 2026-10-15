// Tutor de voz: STT -> LLM (tutor) -> TTS, sobre LiveKit.
// Roda com: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET e:
//   OpenAI: AI_PROVIDER=openai (padrão) + OPENAI_API_KEY
//   Groq (grátis): AI_PROVIDER=groq + GROQ_API_KEY (+ GROQ_TTS_MODEL opcional)
//   npm install && npm start   (registra worker "tutor-voice" e aguarda dispatch)
// O backend cria o dispatch em /connect (AgentDispatchClient) com metadata:
//   { scenario, voice, language, level, userLabel }
import { defineAgent, AgentSession, cli, ServerOptions } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';

const PROVIDER = (process.env.AI_PROVIDER ?? 'openai').toLowerCase();
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const mod = (name, fallback) => process.env[name] ?? process.env.AI_PROVIDER ?? fallback;

function makeSTT(kind, language) {
  if (kind === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('Defina GROQ_API_KEY');
    return new openai.STT({
      model: process.env.GROQ_STT_MODEL ?? 'whisper-large-v3-turbo',
      language, baseURL: GROQ_BASE_URL, apiKey,
    });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Defina OPENAI_API_KEY');
  return new openai.STT({ model: 'gpt-4o-mini-transcribe', language, apiKey });
}

function makeLLM(kind) {
  if (kind === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('Defina GROQ_API_KEY');
    return new openai.LLM({
      model: process.env.GROQ_LLM_MODEL ?? 'openai/gpt-oss-20b',
      baseURL: GROQ_BASE_URL, apiKey,
    });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Defina OPENAI_API_KEY');
  return new openai.LLM({ model: 'gpt-4o-mini', apiKey });
}

function makeTTS(kind, voice) {
  if (kind === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('Defina GROQ_API_KEY');
    return new openai.TTS({
      model: process.env.GROQ_TTS_MODEL ?? 'orpheus',
      voice: 'orpheus',
      baseURL: GROQ_BASE_URL, apiKey,
    });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Defina OPENAI_API_KEY');
  return new openai.TTS({ model: 'gpt-4o-mini-tts', voice, apiKey });
}

const VOICE_FALLBACK = { verse: 'nova' };

function pickVoice(name) {
  if (!name) return 'sage';
  if (name in VOICE_FALLBACK) return VOICE_FALLBACK[name];
  return name;
}

function instructionsFor(meta) {
  const language = meta.language ?? 'the user\'s target language';
  const level = meta.level ?? 'intermediate';
  const scenario = meta.scenario ?? 'free conversation';
  return [
    `You are PingoClone, a friendly ${language} tutor speaking with a ${level} student.`,
    `Scenario: ${scenario}.`,
    'Keep replies SHORT (1-3 sentences), conversational, entirely in the target language',
    'unless the student explicitly asks for their native language.',
    'Gently correct one mistake per turn at most, by modelling the correct form.',
    'End each turn with a question or prompt that keeps the conversation going.',
  ].join('\n');
}

export default defineAgent({
  entry: async (ctx) => {
    const meta = (() => { try { return JSON.parse(ctx.job.metadata ?? '{}'); } catch { return {}; } })();
    await ctx.connect();

    // Por modalidade (permite híbrido: Groq grátis p/ ouvir+pensar, OpenAI p/ falar).
    const sttKind = mod('STT_PROVIDER', PROVIDER);
    const llmKind = mod('LLM_PROVIDER', PROVIDER);
    const ttsKind = mod('TTS_PROVIDER', PROVIDER);
    const session = new AgentSession({
      stt: makeSTT(sttKind, meta.language ?? 'en'),
      llm: makeLLM(llmKind),
      tts: makeTTS(ttsKind, pickVoice(meta.voice)),
      turnDetection: 'stt',
    });

    const forward = (type, text) => {
      try {
        ctx.room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({ type, text, at: Date.now() })),
          { topic: 'tutor-events', reliable: true },
        );
      } catch { /* sem ouvintes: ignora */ }
    };

    session.on('user_speech_committed', (ev) => forward('user_transcript', ev.text ?? ''));
    session.on('agent_speech_committed', (ev) => forward('agent_transcript', ev.text ?? ''));

    await session.start({
      agent: { instructions: instructionsFor(meta) },
      room: ctx.room,
    });

    await session.say(
      meta.greeting ?? 'Hey! Ready to practice? Tell me how your day is going.',
      { allowInterruptions: true },
    );
  },
});

cli.runApp(new ServerOptions({ agent: import.meta.filename, agentName: 'tutor-voice' }));
