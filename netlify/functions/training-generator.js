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

    /* ── Calculate word target and max_tokens based on page count ── */
    /* ~400 words per page for well-formatted training docs */
    var wordsPerPage = 400;
    var targetWords = pageCount * wordsPerPage;
    var minWords = Math.round(targetWords * 0.85);
    var maxWords = Math.round(targetWords * 1.15);
    /* ~1.5 tokens per word for markdown output, plus buffer */
    var dynamicMaxTokens = Math.min(Math.max(Math.round(targetWords * 2), 4000), 16000);

    var systemPrompt = "You are a senior instructional designer, corporate trainer, and document design expert with deep experience in adult learning, knowledge transfer, and professional content formatting.\n\nCORE OBJECTIVE: Transform source material into a high-quality, structured training document that is clear, concise, professionally formatted, and optimized for real-world business use (contact centers, onboarding, SOPs, training programs).\n\nSTYLE GUIDE:\n- Use clear section hierarchy with Markdown: # for Title, ## for Section Headers, ### for Subsections\n- Use bullet points for readability, numbered steps for sequential processes\n- Use **bold** for emphasis sparingly — only for key terms or critical actions\n- Keep paragraphs short (2-4 lines max) but DO NOT let this reduce overall document length\n- Professional, clear, natural tone — instructional but not robotic\n- Avoid fluff and filler, but DO expand on substance — include detailed explanations, concrete examples, actionable steps, and thorough coverage of each topic\n- Write like an experienced operator, not a consultant\n\nCRITICAL LENGTH REQUIREMENT:\n- You MUST produce a document that meets the specified word count target\n- Short paragraphs does NOT mean short document — it means many well-organized short paragraphs\n- Expand content by adding depth: more examples, more detail in each step, more context, more scenarios, more coaching guidance\n- If the source material is thin, expand by elaborating on implications, adding best practices, common pitfalls, and implementation guidance\n- Never truncate or summarize when length is requested — build out full, substantive content\n\nPROCESSING RULES:\n1. Analyze source content — identify key ideas, processes, and workflows; remove redundancy and noise\n2. Extract & prioritize — separate critical vs supporting information; highlight actions and decisions\n3. Rebuild for training use — rewrite for clarity and usability; break complex ideas into structured sections; ensure logical progression\n4. Enhance learning — add examples, tips, warnings, or best practices where they add value\n5. Match the requested style adaptation (Standard, Playbook, Executive Brief, SOP, Quick Reference, etc.)\n\nOUTPUT: A fully formatted training document in Markdown. Include a clear title, structured sections with hierarchy, clean formatting, logical flow from introduction to content to reinforcement, and consistent tone throughout.\n\nDo NOT reference the original document, mention AI or any transformation process, or include unnecessary meta-explanations. Produce the document directly.";

    var userPrompt = "Transform the following source content into a professional training document.\n\n";
    userPrompt += "TARGET AUDIENCE: " + audience + "\n";
    userPrompt += "TRAINING OBJECTIVE: " + objective + "\n";
    userPrompt += "REQUIRED LENGTH: " + pageCount + " page(s) — this means " + targetWords + " words (between " + minWords + " and " + maxWords + " words). This is a HARD REQUIREMENT, not a suggestion. You must produce a document within this word range. If you are under " + minWords + " words, continue adding substantive content, examples, and detail until you reach the target.\n";
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
    userPrompt += "\nRemember: your output MUST be " + targetWords + " words (\u00B115%). Do not stop early.\n";
    userPrompt += "\n--- SOURCE CONTENT ---\n" + sourceContent + "\n--- END SOURCE CONTENT ---";

    var client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    var response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: dynamicMaxTokens,
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
