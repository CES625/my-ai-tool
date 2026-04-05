// netlify/functions/generate-script.js

const https                          = require("https");
const { SYSTEM_PROMPT, buildUserPrompt } = require("./prompts");

const MODEL        = "gpt-5.4-mini";
const SECTION_KEYS = [
  "opening",
  "discovery",
  "core_messaging",
  "objection_handling",
  "call_control",
  "closing",
  "compliance",
  "agent_guidance",
];

// ── OpenAI API call ────────────────────────────────────────
function callOpenAI(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model:           MODEL,
      temperature:     0.4,
      max_tokens:      4096,
      messages,
      response_format: { type: "json_object" },
    });

    const options = {
      hostname: "api.openai.com",
      path:     "/v1/chat/completions",
      method:   "POST",
      headers:  {
        "Content-Type":   "application/json",
        "Authorization":  `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data",  (chunk) => { data += chunk; });
      res.on("end",   () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || "OpenAI API error"));
          resolve(parsed);
        } catch (e) {
          reject(new Error("Failed to parse OpenAI response"));
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.write(body);
    req.end();
  });
}

// ── Normalize a single variation object ───────────────────
function normalizeVariant(variant) {
  const result = {};
  SECTION_KEYS.forEach((key) => {
    const raw = variant[key] || {};
    result[key] = {
      script:   raw.script   || "",
      coaching: raw.coaching || "",
    };
  });
  return result;
}

// ── Build empty sections scaffold ─────────────────────────
function buildEmptySections() {
  const sections = {};
  SECTION_KEYS.forEach((key) => {
    sections[key] = { script: "", coaching: "" };
  });
  return sections;
}

// ── Normalize full API response ────────────────────────────
function normalizeSections(parsed, regenerate_section) {

  // Variation schema: { variation_1: {...}, variation_2: {...} }
  if (parsed.variation_1 && parsed.variation_2) {
    return {
      variation_1: normalizeVariant(parsed.variation_1),
      variation_2: normalizeVariant(parsed.variation_2),
    };
  }

  // Regeneration: single section only
  if (regenerate_section) {
    const result = buildEmptySections();
    if (parsed[regenerate_section]) {
      result[regenerate_section] = {
        script:   parsed[regenerate_section].script   || "",
        coaching: parsed[regenerate_section].coaching || "",
      };
    }
    return result;
  }

  // Standard full script
  const result = {};
  SECTION_KEYS.forEach((key) => {
    const raw = parsed[key] || {};
    result[key] = {
      script:   raw.script   || "",
      coaching: raw.coaching || "",
    };
  });
  return result;
}

// ── Handler ────────────────────────────────────────────────
exports.handler = async function (event) {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type":                 "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers:    corsHeaders,
      body:       JSON.stringify({ error: "Method not allowed" }),
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 500,
      headers:    corsHeaders,
      body:       JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers:    corsHeaders,
      body:       JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const userPrompt = buildUserPrompt(body);
  const messages   = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user",   content: userPrompt },
  ];

  let openAIResponse;
  try {
    openAIResponse = await callOpenAI(messages);
  } catch (err) {
    return {
      statusCode: 502,
      headers:    corsHeaders,
      body:       JSON.stringify({ error: `OpenAI request failed: ${err.message}` }),
    };
  }

  const rawContent = openAIResponse?.choices?.[0]?.message?.content;
  if (!rawContent) {
    return {
      statusCode: 502,
      headers:    corsHeaders,
      body:       JSON.stringify({ error: "Empty response from OpenAI" }),
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return {
      statusCode: 502,
      headers:    corsHeaders,
      body:       JSON.stringify({
        error: "OpenAI returned non-JSON content",
        raw:   rawContent.slice(0, 500),
      }),
    };
  }

  const sections = normalizeSections(parsed, body.regenerate_section || null);

  return {
    statusCode: 200,
    headers:    corsHeaders,
    body:       JSON.stringify({ sections }),
  };
};
