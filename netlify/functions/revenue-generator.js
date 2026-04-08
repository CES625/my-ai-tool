const OpenAI = require("openai");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const {
      programType,
      industry,
      currentServices,
      channels,
      touchpoints,
      painPoints,
      kpis,
      constraints,
      count,
      depth
    } = JSON.parse(event.body || "{}");

    if (!programType || !industry || !currentServices) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Program type, industry, and current services are required." })
      };
    }

    const oppCount = Math.min(Math.max(parseInt(count) || 5, 4), 6);
    const depthSetting = (depth || "standard").toLowerCase();

    const depthConfig = {
      concise:  { wordsPerOpp: 220, label: "CONCISE" },
      standard: { wordsPerOpp: 340, label: "STANDARD" },
      deep:     { wordsPerOpp: 480, label: "DEEP" }
    };
    const cfg = depthConfig[depthSetting] || depthConfig.standard;
    const targetWords = cfg.wordsPerOpp * oppCount;
    const maxTokens = Math.min(Math.ceil(targetWords * 2.2) + 800, 16000);

    const systemPrompt = `You are a Chief Revenue Officer with 20+ years of experience in contact center operations, BPO client growth strategy, and revenue expansion. You advise senior operations leaders and client success executives on how to monetize existing programs and propose strategic expansions.

Your job is to generate ${oppCount} distinct, high-impact revenue opportunities for a specific contact center program based on the inputs provided.

CRITICAL OUTPUT REQUIREMENTS:
- Return ONLY valid JSON, no preamble, no markdown fences, no commentary
- Generate EXACTLY ${oppCount} opportunities — not more, not fewer
- REQUIRED LENGTH: approximately ${cfg.wordsPerOpp} words per opportunity across all fields combined. This is a HARD REQUIREMENT — ${cfg.label} depth means substantive, operator-grade detail in every field.
- Every opportunity must tie DIRECTLY to the specific inputs provided. Generic ideas that could apply to any program are unacceptable.
- Include a deliberate mix: at least one quick win (low effort, fast revenue) and at least one strategic expansion (larger, longer-term play)
- Think beyond obvious upsells: new service lines, process ownership expansion, monetizing existing interactions, data-driven opportunities, insourcing adjacent functions
- Write like an experienced operator, not a consultant. Use correct contact center terminology (AHT, FCR, CSAT, occupancy, shrinkage, disposition, calibration, attach rate, etc.) where natural.
- Be decisive and opinionated. No hedging, no balanced menus.

JSON SCHEMA — return exactly this structure:
{
  "opportunities": [
    {
      "name": "Short punchy name (4–8 words)",
      "concept": "Clear explanation of the idea (2–4 sentences)",
      "operations": "How the contact center executes this operationally — staffing, workflow, tech, training implications (3–5 sentences)",
      "revenueModel": "Specific commercial structure: per call, per conversion, rev share %, upsell margin, monthly retainer, tiered SLA premium, etc. Be concrete with example numbers where useful.",
      "fit": "Direct tie to the specific inputs — name the program type, vertical, channel, pain point, or KPI it leverages",
      "impact": "Low" or "Medium" or "High",
      "effort": "Low" or "Medium" or "High",
      "pitchAngle": "Exact framing to use with the client to gain buy-in (2–3 sentences, written as advice to the account lead)"
    }
  ]
}

The "impact" and "effort" fields must be EXACTLY one of: "Low", "Medium", "High" — capitalized, no other values.`;

    const userPrompt = `Generate ${oppCount} revenue opportunities for this contact center program. Target approximately ${cfg.wordsPerOpp} words per opportunity — this is a HARD REQUIREMENT, do not undershoot.

PROGRAM TYPE: ${programType}
INDUSTRY / VERTICAL: ${industry}
CURRENT SERVICES PROVIDED: ${currentServices}
CHANNELS IN USE: ${channels || "Not specified"}
CUSTOMER JOURNEY TOUCHPOINTS: ${touchpoints || "Not specified"}
KNOWN PAIN POINTS / GAPS: ${painPoints || "Not specified"}
CURRENT KPIs / METRICS: ${kpis || "Not specified"}
CONSTRAINTS: ${constraints || "None specified"}

Return ONLY the JSON object. No preamble, no markdown, no explanation. Begin your response with { and end with }.`;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.75,
      response_format: { type: "json_object" }
    });

    const raw = response.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    }

    if (!parsed.opportunities || !Array.isArray(parsed.opportunities)) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Invalid response structure from AI." })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: parsed })
    };
  } catch (err) {
    console.error("Revenue generator error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Generation failed." })
    };
  }
};
