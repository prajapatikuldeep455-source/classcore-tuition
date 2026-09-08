// wa-hub-ai.js — Multi-provider AI reply engine for ClassCore WhatsApp Hub
// Talks to an AI provider (Anthropic, Google Gemini, or OpenAI) to generate
// one WhatsApp reply "in character" as the business owner. Kept
// dependency-free (uses Node's built-in https) so there's nothing extra to
// npm install.
//
// PROVIDER AUTO-DETECTION: the user pastes ONE API key (whichever provider
// they have), and we figure out which provider it belongs to just from the
// key's shape — no separate "provider" dropdown to keep in sync:
//   - Anthropic  keys start with "sk-ant-"
//   - Google     keys start with "AIza"
//   - OpenAI     keys start with "sk-" (but not "sk-ant-")
// This is the ONLY place that logic lives — main.js/renderer ask this file
// via IPC rather than re-implementing the regex, so there's one source of truth.

const https = require('https');

const MAX_TOKENS = 1024;

const PROVIDER_NAMES = {
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  openai: 'OpenAI (GPT)',
  unknown: 'Unrecognized key format',
};

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-3.5-flash-lite',
  openai: 'gpt-4o-mini',
};

const GEMINI_FALLBACKS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.7-flash'];

function extractOwnerAlert(rawText) {
  if (!rawText) return null;
  const match = rawText.match(/\[(?:OWNER_ALERT|OWNER_ACTION_REQUIRED):\s*([^\]]+)\]/i);
  return match ? match[1].trim() : null;
}

/**
 * Strips accidental AI artifacts like markdown bullets, quotes, or internal
 * reasoning tags before the text is sent as a WhatsApp message.
 */
function cleanReply(rawText) {
  if (!rawText) return '';
  let text = rawText.trim();

  // Strip leading thought/reasoning tags or headers (e.g. "Constraint Check: ...", "Reply: ...")
  text = text.replace(/^(?:\*{1,2}|#+)?\s*(?:Constraint Check|Thinking|Reasoning|Thought Process|Internal|Note|Reply|Message|WhatsApp Reply):.*?(?:\n+|$)/gis, '');

  // Strip any stray bullet points, colons, or asterisks at the beginning (e.g. ":**\n* ")
  text = text.replace(/^[:*#\-\s\t]+/g, '');

  // Strip surrounding quotes if the entire reply was wrapped in "..." or '...'
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }
  // Strip stray opening quote if left unclosed
  if (text.startsWith('"') && !text.slice(1).includes('"')) {
    text = text.slice(1).trim();
  }

  // Strip leading bullet markers on any remaining lines
  text = text.replace(/^[*•\-]\s*/gm, '');

  // Strip hidden owner alert tags from customer WhatsApp message
  text = text.replace(/\[(?:OWNER_ALERT|OWNER_ACTION_REQUIRED):\s*[^\]]+\]/gi, '');

  return text.trim();
}

/**
 * Cleans up the most common copy-paste mistakes before we even try to
 * detect the provider: surrounding quotes (people copy from a doc/chat that
 * wrapped the key in quotes), and any stray whitespace/newlines/zero-width
 * characters a bad copy can introduce. Real API keys never contain spaces.
 */
function sanitizeApiKey(raw) {
  let key = (raw || '').trim();
  key = key.replace(/^['"`]+|['"`]+$/g, ''); // surrounding quote characters
  key = key.replace(/[\s\u200B-\u200D\uFEFF]+/g, ''); // all whitespace + zero-width/BOM chars
  return key;
}

/**
 * Figures out which AI provider an API key belongs to, purely from its shape.
 * Returns 'anthropic' | 'google' | 'openai' | 'unknown' | null (empty key).
 *
 * GOOGLE KEY FORMAT NOTE (2026): Google AI Studio switched from the old
 * "Standard" key format (starts "AIza...") to a new "Authorization" key
 * format (starts "AQ...", e.g. "AQ.Ab8..."). As of mid-2026 AI Studio issues
 * ONLY "AQ." keys by default — "AIza" keys are being phased out entirely.
 * Both formats work identically against the API, so we treat either prefix
 * as Google.
 */
function detectProvider(apiKey) {
  const key = sanitizeApiKey(apiKey);
  if (!key) return null;
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('AIza') || key.startsWith('AQ.')) return 'google';
  if (key.startsWith('sk-')) return 'openai';
  return 'unknown';
}

function buildSystemPrompt({ persona, businessInfo, menuPricing }) {
  const lines = [
    "CRITICAL INSTRUCTIONS FOR WHATSAPP REPLIES:",
    "1. LANGUAGE MATCHING: Always reply in the EXACT SAME LANGUAGE the customer messaged in. If the customer messages in English (e.g. 'can you tell me in English'), you MUST reply entirely in fluent, polite English. If they message in Hindi, reply in Hindi. If Hinglish, reply in Hinglish.",
    "2. NO SYSTEM ARTIFACTS: Never output reasoning, 'Constraint Check', asterisks (*), bullets, quotes, or markdown tags. Output ONLY the clean WhatsApp message text.",
    "3. NATURAL & CONCISE: Write as if the business owner is casually and warmly texting back (1-3 sentences max).",
    "4. ACCURATE & HELPFUL: Answer only what was asked clearly. If asked if you are an AI, be honest.",
    "5. NO LABELS: Never write 'Reply:', 'Shop Owner:', or quotes around your message.",
    "6. INQUIRIES & LOCATIONS: When a customer places an order or asks for items/rates/delivery, NEVER confirm the order or promise delivery yourself. Politely state that the details have been noted and are pending verification by the owner, and they will be updated on WhatsApp as soon as the owner confirms it. If the customer wants items at MULTIPLE LOCATIONS, clearly acknowledge all locations in your reply. You MUST proactively ask for their missing details: if their name is not known, ask for it; if their location/area is not specified, ask for it. NEVER ask for their phone number (they are already messaging on WhatsApp).",
    "7. PRICING & RATES: When a customer asks about prices, rates, or total cost, refer STRICTLY to the information provided below. Calculate the total bill accurately based on the stated rates. If an item or specific quantity is not in the price list, state: 'For this rate, our owner will confirm with you.' Never make up or guess random prices.",
    "8. OWNER PERMISSION REQUIRED FOR SPECIAL REQUESTS: If a customer asks for a discount/bargaining, asks for huge/bulk orders, asks for items not in the list, requests cancellation of a confirmed order, or asks for credit/deferred payment, DO NOT make a decision yourself. Politely reply that you will check with the owner: 'I will need permission from the owner for this. I have forwarded your message, they will contact you soon. Thank you! 🙏'. And append [OWNER_ALERT: <brief reason>] at the very end of your reply.",
  ];

  if (menuPricing && menuPricing.trim()) {
    lines.push('', 'Official Menu & Price List / Rates (use these exact rates for answering price questions and calculating bills):', menuPricing.trim());
  }

  if (persona && persona.trim()) {
    lines.push('', 'Voice, personality, and location context:', persona.trim());
  }

  if (businessInfo && businessInfo.trim()) {
    lines.push('', 'Business facts / FAQs (hours, specialty, areas):', businessInfo.trim());
  }

  return lines.join('\n');
}

function callAnthropic({ apiKey, model, system, messages, raw = false }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: model || DEFAULT_MODELS.anthropic,
      max_tokens: MAX_TOKENS,
      system,
      messages,
    });

    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            reject(new Error(`Anthropic API returned unreadable response (status ${res.statusCode})`));
            return;
          }

          if (res.statusCode !== 200) {
            const msg = parsed?.error?.message || `Anthropic API error (status ${res.statusCode})`;
            reject(new Error(msg));
            return;
          }

          const text = parsed?.content?.find((b) => b.type === 'text')?.text?.trim();
          if (!text) {
            reject(new Error('Anthropic API returned no reply text.'));
            return;
          }
          resolve(raw ? text : cleanReply(text));
        });
      }
    );

    req.on('error', (err) => reject(new Error(`Couldn't reach the Anthropic API: ${err.message}`)));
    req.write(body);
    req.end();
  });
}

function callGeminiSingle({ apiKey, model, system, messages, raw = false }) {
  return new Promise((resolve, reject) => {
    // Gemini has no separate "assistant" role — it calls the model's own
    // turns "model" instead of "assistant".
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body = JSON.stringify({
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: { maxOutputTokens: MAX_TOKENS },
    });

    const req = https.request(
      {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            reject(new Error(`Google Gemini API returned unreadable response (status ${res.statusCode})`));
            return;
          }

          if (res.statusCode !== 200) {
            const msg = parsed?.error?.message || `Google Gemini API error (status ${res.statusCode})`;
            reject(new Error(msg));
            return;
          }

          const parts = parsed?.candidates?.[0]?.content?.parts || [];
          // Filter out internal thinking / reasoning parts if present
          const nonThoughtParts = parts.filter((p) => !p.thought);
          const text = (nonThoughtParts.length > 0 ? nonThoughtParts : parts)
            .map((p) => p.text || '')
            .join('')
            .trim();

          if (!text) {
            reject(new Error('Google Gemini API returned no reply text (it may have been blocked by safety filters).'));
            return;
          }
          resolve(raw ? text : cleanReply(text));
        });
      }
    );

    req.on('error', (err) => reject(new Error(`Couldn't reach the Google Gemini API: ${err.message}`)));
    req.write(body);
    req.end();
  });
}

/**
 * Calls Gemini with automatic fallback across available models if a model
 * is experiencing high demand (503), quota limits (429), or temporary outages.
 */
async function callGemini({ apiKey, model, system, messages, raw = false }) {
  const modelsToTry = [model, ...GEMINI_FALLBACKS.filter((m) => m !== model)];
  let lastErr;
  for (const m of modelsToTry) {
    try {
      return await callGeminiSingle({ apiKey, model: m, system, messages, raw });
    } catch (err) {
      lastErr = err;
      const isRecoverable =
        err.message.includes('high demand') ||
        err.message.includes('overloaded') ||
        err.message.includes('RESOURCE_EXHAUSTED') ||
        err.message.includes('quota') ||
        err.message.includes('503') ||
        err.message.includes('429') ||
        err.message.includes('not found') ||
        err.message.includes('no longer available');
      if (!isRecoverable) {
        throw err;
      }
    }
  }
  throw lastErr;
}

function callOpenAI({ apiKey, model, system, messages, raw = false }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'system', content: system }, ...messages],
    });

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: `Bearer ${apiKey}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            reject(new Error(`OpenAI API returned unreadable response (status ${res.statusCode})`));
            return;
          }

          if (res.statusCode !== 200) {
            const msg = parsed?.error?.message || `OpenAI API error (status ${res.statusCode})`;
            reject(new Error(msg));
            return;
          }

          const text = parsed?.choices?.[0]?.message?.content?.trim();
          if (!text) {
            reject(new Error('OpenAI API returned no reply text.'));
            return;
          }
          resolve(raw ? text : cleanReply(text));
        });
      }
    );

    req.on('error', (err) => reject(new Error(`Couldn't reach the OpenAI API: ${err.message}`)));
    req.write(body);
    req.end();
  });
}

/**
 * Generates the next reply given conversation history so far.
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} [opts.model]
 * @param {string} [opts.persona]
 * @param {string} [opts.businessInfo]
 * @param {Array<{role:'user'|'assistant', content:string}>} opts.history - prior turns, oldest first, NOT including the new incoming message
 * @param {string} opts.incomingText - the customer's latest message
 */
async function generateReply({ apiKey, model, persona, businessInfo, menuPricing, history, incomingText }) {
  const key = sanitizeApiKey(apiKey);
  if (!key) {
    throw new Error('No AI API key set.');
  }

  const provider = detectProvider(key);
  if (provider === 'unknown') {
    // Show the actual prefix we saw so a mismatched/mistyped key is
    // obvious at a glance instead of a generic "not supported" message.
    const seenPrefix = key.slice(0, 6);
    throw new Error(
      `This doesn't look like a supported API key (it starts with "${seenPrefix}..."). Supported keys: Anthropic (starts with sk-ant-...), Google Gemini (starts with AIza... or the newer AQ. format), or OpenAI (starts with sk-...). Double-check you copied the whole key with nothing extra before/after it.`
    );
  }

  const system = buildSystemPrompt({ persona, businessInfo, menuPricing });
  const messages = [...(history || []), { role: 'user', content: incomingText }];
  let chosenModel = (model && model.trim()) || DEFAULT_MODELS[provider];

  // Safety net: if the user left a model name from a DIFFERENT provider in
  // the Model field (e.g. "claude-sonnet-5" while using a Google key), fall
  // back to the correct default rather than sending a guaranteed-to-fail
  // request.  This catches the most common copy-paste/switch-key mistakes.
  const ml = chosenModel.toLowerCase();
  const mismatch =
    (provider === 'google'    && (ml.includes('claude') || ml.includes('gpt') || ml.startsWith('o1') || ml.startsWith('o3') || ml.startsWith('o4'))) ||
    (provider === 'anthropic' && (ml.includes('gemini') || ml.includes('gpt') || ml.startsWith('o1') || ml.startsWith('o3') || ml.startsWith('o4'))) ||
    (provider === 'openai'    && (ml.includes('claude') || ml.includes('gemini')));
  if (mismatch) {
    chosenModel = DEFAULT_MODELS[provider];
  }

  let rawReply;
  if (provider === 'anthropic') rawReply = await callAnthropic({ apiKey: key, model: chosenModel, system, messages, raw: true });
  else if (provider === 'google') rawReply = await callGemini({ apiKey: key, model: chosenModel, system, messages, raw: true });
  else rawReply = await callOpenAI({ apiKey: key, model: chosenModel, system, messages, raw: true });

  const ownerAlert = extractOwnerAlert(rawReply);
  const text = cleanReply(rawReply);

  return { text, ownerAlert };
}

/**
 * Specialized AI extraction for customer orders from WhatsApp chat history.
 * Uses a dedicated JSON-only system prompt and returns pure parsed object.
 */
async function extractOrderFromConversation({ apiKey, model, conversationText }) {
  const key = sanitizeApiKey(apiKey);
  if (!key) return { hasOrder: false };

  const provider = detectProvider(key);
  if (provider === 'unknown') return { hasOrder: false };

  let chosenModel = (model && model.trim()) || DEFAULT_MODELS[provider];
  const ml = chosenModel.toLowerCase();
  const mismatch =
    (provider === 'google'    && (ml.includes('claude') || ml.includes('gpt') || ml.startsWith('o1') || ml.startsWith('o3') || ml.startsWith('o4'))) ||
    (provider === 'anthropic' && (ml.includes('gemini') || ml.includes('gpt') || ml.startsWith('o1') || ml.startsWith('o3') || ml.startsWith('o4'))) ||
    (provider === 'openai'    && (ml.includes('claude') || ml.includes('gemini')));
  if (mismatch) {
    chosenModel = DEFAULT_MODELS[provider];
  }

  const system = `You are an order extraction engine for a business.
Read the WhatsApp chat between customer and business.
Determine if the customer has placed or inquired about an order (items, quantities, or delivery).

IMPORTANT: If the customer asked for delivery to MULTIPLE different locations or separate orders, create a separate entry in the "orders" array for each distinct location / delivery!

Respond ONLY with a valid JSON object (no markdown code blocks, no backticks, no explanatory text):
{
  "hasOrder": true,
  "orders": [
    {
      "summary": "1-2 sentence order summary for this delivery",
      "customerName": "Customer name if known or empty string",
      "items": [
        { "name": "Item name", "quantity": "Quantity" }
      ],
      "deliveryLocation": "Specific delivery location for this order or empty string",
      "specialInstructions": "Special instructions or empty string"
    }
  ]
}

If no clear order or request for items was made, respond ONLY with:
{"hasOrder": false}`;

  const messages = [{ role: 'user', content: conversationText }];

  try {
    let raw;
    if (provider === 'anthropic') {
      raw = await callAnthropic({ apiKey: key, model: chosenModel, system, messages, raw: true });
    } else if (provider === 'google') {
      raw = await callGemini({ apiKey: key, model: chosenModel, system, messages, raw: true });
    } else {
      raw = await callOpenAI({ apiKey: key, model: chosenModel, system, messages, raw: true });
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { hasOrder: false };
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || !parsed.hasOrder) return { hasOrder: false };

    // If orders array is present, return it
    if (Array.isArray(parsed.orders) && parsed.orders.length > 0) {
      return parsed;
    }
    // Backward-compatibility if model returned single order format
    return {
      hasOrder: true,
      orders: [
        {
          summary: parsed.summary || '',
          customerName: parsed.customerName || '',
          items: parsed.items || [],
          deliveryLocation: parsed.deliveryLocation || '',
          specialInstructions: parsed.specialInstructions || '',
        },
      ],
    };
  } catch (err) {
    return { hasOrder: false };
  }
}

module.exports = {
  generateReply,
  extractOrderFromConversation,
  detectProvider,
  sanitizeApiKey,
  PROVIDER_NAMES,
  DEFAULT_MODELS,
};
