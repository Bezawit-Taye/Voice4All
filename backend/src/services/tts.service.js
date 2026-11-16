const TTS_TIMEOUT_MS = 180000;
const UPSTREAM_BODY_LOG_LIMIT = 500;

function sanitizeDiagnosticText(value) {
  return String(value || '')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/(https?:\/\/)[^/\s:@]+:[^/@\s]+@/gi, '$1[REDACTED]@')
    .replace(
      /(["']?(?:authorization|[A-Za-z0-9_-]*token|[A-Za-z0-9_-]*secret|password|api[_-]?key)["']?\s*[:=]\s*["']?)[^"',;\s}]+/gi,
      '$1[REDACTED]'
    )
    .slice(0, UPSTREAM_BODY_LOG_LIMIT);
}

function redactSensitiveValues(value) {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /authorization|token|secret|password|api[_-]?key/i.test(key)
        ? '[REDACTED]'
        : redactSensitiveValues(entry)
    ])
  );
}

function sanitizeResponseBody(body) {
  let safeBody = body;
  try {
    safeBody = sanitizeDiagnosticText(
      JSON.stringify(redactSensitiveValues(JSON.parse(body)))
    );
  } catch {
    safeBody = sanitizeDiagnosticText(body);
  }

  if (safeBody.length > UPSTREAM_BODY_LOG_LIMIT) {
    return `${safeBody.slice(0, UPSTREAM_BODY_LOG_LIMIT)}...[truncated]`;
  }
  return safeBody;
}

async function readResponseBodySnippet(response) {
  try {
    return sanitizeResponseBody(await response.text());
  } catch (error) {
    return `[response body unreadable: ${sanitizeDiagnosticText(error.name)}]`;
  }
}

function getUpstreamHost(serviceUrl) {
  try {
    return new URL(serviceUrl).host;
  } catch {
    return 'invalid-url';
  }
}

function logUpstreamDiagnostic(event, details) {
  console.error('[TTS proxy]', JSON.stringify({ event, ...details }));
}

async function synthesizeSpeech({ text, language, voice = 'female', rate = 1 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  let upstreamResponse;
  let upstreamHost = 'unresolved';

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

    upstreamHost = getUpstreamHost(serviceUrl);
    upstreamResponse = await fetch(`${serviceUrl}/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ text, language, voice, rate }),
      signal: controller.signal
    });

    if (!upstreamResponse.ok) {
      const responseBody = await readResponseBodySnippet(upstreamResponse);
      const authenticationFailure = [401, 403].includes(upstreamResponse.status);
      logUpstreamDiagnostic(
        authenticationFailure
          ? 'upstream_authentication_failure'
          : 'upstream_http_failure',
        {
          upstreamHost,
          status: upstreamResponse.status,
          responseBody
        }
      );

      const statusCode = upstreamResponse.status === 504
        ? 504
        : upstreamResponse.status === 503
          ? 503
          : 502;
      const error = new Error(
        upstreamResponse.status === 504
          ? 'Speech generation timed out. Please try again.'
          : 'Speech generation is temporarily unavailable. Please try again.'
      );
      error.statusCode = statusCode;
      throw error;
    }

    const contentType = (upstreamResponse.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('audio/mpeg')) {
      const responseBody = await readResponseBodySnippet(upstreamResponse);
      logUpstreamDiagnostic('upstream_invalid_response_format', {
        upstreamHost,
        status: upstreamResponse.status,
        contentType: contentType || 'missing',
        responseBody
      });
      const error = new Error('Speech service returned an unexpected audio format.');
      error.statusCode = 502;
      throw error;
    }

    const audio = Buffer.from(await upstreamResponse.arrayBuffer());
    if (audio.length === 0) {
      logUpstreamDiagnostic('upstream_empty_audio', {
        upstreamHost,
        status: upstreamResponse.status,
        contentType
      });
      const error = new Error('Speech service returned empty audio.');
      error.statusCode = 502;
      throw error;
    }

    return audio;
  } catch (err) {
    if (err.statusCode) throw err;

    const cause = err.cause || err;
    const timedOut = err.name === 'AbortError';
    logUpstreamDiagnostic(
      timedOut
        ? 'upstream_timeout'
        : upstreamResponse
          ? 'upstream_response_read_error'
          : 'upstream_connection_error',
      {
        upstreamHost,
        ...(upstreamResponse
          ? {
              status: upstreamResponse.status,
              contentType: upstreamResponse.headers.get('content-type') || 'missing'
            }
          : {}),
        errorName: sanitizeDiagnosticText(cause.name || err.name || 'Error'),
        errorCode: sanitizeDiagnosticText(cause.code || err.code || 'unknown'),
        errorMessage: sanitizeDiagnosticText(cause.message || err.message)
      }
    );

    const error = new Error(
      timedOut
        ? 'Speech generation timed out. Please try again.'
        : 'Speech service is unavailable. Please check the service and try again.'
    );
    error.statusCode = timedOut ? 504 : 503;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { synthesizeSpeech };
