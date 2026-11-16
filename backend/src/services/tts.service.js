const TTS_TIMEOUT_MS = 180000;

async function synthesizeSpeech({ text, language, voice = 'female', rate = 1 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const token = (process.env.TTS_SERVICE_TOKEN || '').trim();
    if (isProduction && !token) {
      const error = new Error(
        'Required production configuration is missing: TTS_SERVICE_TOKEN.'
      );
      error.statusCode = 503;
      throw error;
    }

    const configuredUrl = (process.env.TTS_SERVICE_URL || '').trim() ||
      (isProduction ? '' : 'http://127.0.0.1:8001');
    if (!configuredUrl) {
      const error = new Error(
        'Required production configuration is missing: TTS_SERVICE_URL.'
      );
      error.statusCode = 503;
      throw error;
    }

    const serviceUrl = /^https?:\/\//i.test(configuredUrl)
      ? configuredUrl.replace(/\/+$/, '')
      : `https://${configuredUrl.replace(/\/+$/, '')}`;
    if (isProduction && !serviceUrl.startsWith('https://')) {
      const error = new Error('Speech service is unavailable. Please try again.');
      error.statusCode = 503;
      throw error;
    }

    const response = await fetch(`${serviceUrl}/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ text, language, voice, rate }),
      signal: controller.signal
    });

    if (!response.ok) {
      const statusCode = response.status === 504
        ? 504
        : response.status === 503
          ? 503
          : 502;
      const error = new Error(
        response.status === 504
          ? 'Speech generation timed out. Please try again.'
          : 'Speech generation is temporarily unavailable. Please try again.'
      );
      error.statusCode = statusCode;
      throw error;
    }

    if (!(response.headers.get('content-type') || '').toLowerCase().startsWith('audio/mpeg')) {
      const error = new Error('Speech service returned an unexpected audio format.');
      error.statusCode = 502;
      throw error;
    }

    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length === 0) {
      const error = new Error('Speech service returned empty audio.');
      error.statusCode = 502;
      throw error;
    }

    return audio;
  } catch (err) {
    if (err.statusCode) throw err;

    const error = new Error(
      err.name === 'AbortError'
        ? 'Speech generation timed out. Please try again.'
        : 'Speech service is unavailable. Please check the service and try again.'
    );
    error.statusCode = err.name === 'AbortError' ? 504 : 503;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { synthesizeSpeech };
