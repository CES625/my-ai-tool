export async function handler(event) {
  try {
    const { prompt } = JSON.parse(event.body);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        result: data?.choices?.[0]?.message?.content || "No response returned"
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        result: "Error: " + error.message
      })
    };
  }
}
