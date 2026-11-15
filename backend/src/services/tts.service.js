const TTS_TIMEOUT_MS = 120000;

async function synthesizeSpeech({ text, language }) {
  const serviceUrl = (process.env.TTS_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(`${serviceUrl}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'audio/wav' },
      body: JSON.stringify({ text, language }),
      signal: controller.signal
    });
  } catch (err) {
    const error = new Error(
      err.name === 'AbortError'
        ? 'Amharic speech generation timed out.'
        : 'OmniVoice speech service is unavailable. Start the TTS service on the configured backend host.'
    );
    error.statusCode = err.name === 'AbortError' ? 504 : 503;
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = new Error(`OmniVoice speech service returned HTTP ${response.status}.`);
    error.statusCode = 502;
    throw error;
  }

  if (!(response.headers.get('content-type') || '').toLowerCase().startsWith('audio/wav')) {
    const error = new Error('OmniVoice speech service returned an unexpected audio format.');
    error.statusCode = 502;
    throw error;
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0) {
    const error = new Error('OmniVoice speech service returned empty audio.');
    error.statusCode = 502;
    throw error;
  }

  return audio;
}

module.exports = { synthesizeSpeech };
