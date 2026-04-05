const https = require("https");
const { SYSTEM_PROMPT, buildUserPrompt } = require("./prompts");

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

// ── Claude API call ────────────────────────────────────────
function callClaude(userPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-3-sonnet-20240229", // stable model
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userPrompt
        }
      ]
    });

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", chunk => data += chunk);

      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);

          if (parsed.error) {
            return reject(new Error(JSON.stringify(parsed.error)));
          }

          resolve(parsed);
        } catch (err) {
          reject(new Error("Failed to parse Claude response: " + data));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Normalize helpers ─────────────────────────────────────
function normalizeVariant(variant) {
  const result = {};
  SECTION_KEYS.forEach((key) => {
    const raw = variant[key] || {};
    result[key] = {
      script: raw.script || "",
      coaching: raw.coaching || "",
    };
  });
  return result;
}

function buildEmptySections() {
  const sections = {};
  SECTION_KEYS.forEach((key) => {
    sections[key] = { script: "", coaching: "" };
  });
  return sections;
}

function normalizeSections(parsed, regenerate_section) {
  if (parsed.variation_1 && parsed.variation_2) {
    return {
      variation_1: normalizeVariant(parsed.variation_1),
      variation_2: normalizeVariant(parsed.variation_2),
    };
  }

  if (regenerate_section) {
    const result = buildEmptySections();
    if (parsed[regenerate_section]) {
      result[regenerate_section] = {
        script: parsed[regenerate_section].script || "",
        coaching: parsed[regenerate_section].coaching || "",
      };
    }
    return result;
  }

  const result = {};
  SECTION_KEYS.forEach((key) => {
    const raw = parsed[key] || {};
    result[key] = {
      script: raw.script || "",
      coaching: raw.coaching || "",
    };
  });
  return result;
}

// ── Handler ───────────────────────────────────────────────
exports.handler = async function (event) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const userPrompt = buildUserPrompt(body);

  let claudeResponse;
  try {
    claudeResponse = await callClaude(userPrompt);
  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Claude request failed",
        details: err.message,
      }),
    };
  }

  const rawContent = claudeResponse?.content
    ?.map(c => c.text)
    .join("\n");

  if (!rawContent) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Empty response from Claude",
        full: claudeResponse
      }),
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Claude returned non-JSON content",
        raw_preview: rawContent.slice(0, 500),
      }),
    };
  }

  const sections = normalizeSections(parsed, body.regenerate_section || null);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ sections }),
  };
};
