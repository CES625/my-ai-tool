var OpenAI = require("openai");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var sourceContent = body.sourceContent || "";
    var audience = body.audience || "";
    var objective = body.objective || "";
    var pageCount = body.pageCount || 2;
    var depth = body.depth || "Balanced";
    var style = body.style || "Standard Document";
    var tone = body.tone || "Professional & Direct";
    var customTitle = body.customTitle || "";
    var toggles = body.toggles || {};

    if (!sourceContent.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "Source content is required." }) };
    }
    if (!objective.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "Training objective is required." }) };
    }

    var systemPrompt = "You are a senior instructional designer, corporate trainer, and document design expert with deep experience in adult learning, knowledge transfer, and professional content formatting.\n\nCORE OBJECTIVE: Transform source material into a high-quality, structured training document that is clear, concise, professionally formatted, and optimized for real-world business use (contact centers, onboarding, SOPs, training programs).\n\nSTYLE GUIDE:\n- Use clear section hierarchy with Markdown: # for Title, ## for Section Headers, ### for Subsections\n- Use bullet points for readability, numbered steps for sequential processes\n- Use **bold** for emphasis sparingly — only for key terms or critical actions\n- Keep paragraphs short (2-4 lines max)\n- Professional, clear, natural tone — instructional but not robotic\n- Avoid fluff, filler, or overly academic language\n- Write like an experienced operator, not a consultant\n\nPROCESSING RULES:\n1. Analyze source content — identify key ideas, processes, and workflows; remove redundancy and noise\n2. Extract & prioritize — separate critical vs supporting information; highlight actions and decisions\n3. Rebuild for training use — rewrite for clarity and usability; break complex ideas into structured sections; ensure logical progression\n4. Enhance learning — add examples, tips, warnings, or best practices where they add value\n5. Match the requested style adaptation (Standard, Playbook, Executive Brief, SOP, Quick Reference, etc.)\n\nOUTPUT: A fully formatted training document in Markdown. Include a clear title, structured sections with hierarchy, clean formatting, logical flow from introduction to content to reinforcement, and consistent tone throughout.\n\nDo NOT reference the original document, mention AI or any transformation process, or include unnecessary meta-explanations. Produce the document directly.";

    var userPrompt = "Transform the following source content into a professional training document.\n\n";
    userPrompt += "TARGET AUDIENCE: " + audience + "\n";
    userPrompt += "TRAINING OBJECTIVE: " + objective + "\n";
    userPrompt += "DESIRED LENGTH: Approximately " + pageCount + " page(s)\n";
    userPrompt += "CONTENT DEPTH: " + depth + "\n";
    userPrompt += "CREATIVE STYLE: " + style + "\n";
    userPrompt += "TONE: " + tone + "\n";
    if (customTitle) userPrompt += "DOCUMENT TITLE: " + customTitle + "\n";

    var enabledSections = [];
    for (var key in toggles) {
      if (toggles[key]) {
        enabledSections.push(key.replace(/([A-Z])/g, " $1").trim());
      }
    }
    if (enabledSections.length > 0) {
      userPrompt += "INCLUDE THESE SECTIONS: " + enabledSections.join(", ") + "\n";
    }
    userPrompt += "\n--- SOURCE CONTENT ---\n" + sourceContent + "\n--- END SOURCE CONTENT ---";

    var client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    var response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 8000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    });

    var resultText = "";
    if (response.choices && response.choices.length > 0) {
      resultText = response.choices[0].message.content || "";
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: resultText }),
    };
  } catch (err) {
    console.error("Training generator error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Internal server error" }),
    };
  }
};
