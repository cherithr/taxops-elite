import { useState } from "react";
import { model } from "./gemini";

export default function CopilotView() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const result = await model.generateContent(input);
    setResponse(result.response.text());
    setLoading(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>AI Copilot</h2>
      <textarea value={input} onChange={e => setInput(e.target.value)} rows={4} cols={50} />
      <br />
      <button onClick={handleSend} disabled={loading}>
        {loading ? "Thinking..." : "Ask Gemini"}
      </button>
      {response && <p><strong>Response:</strong> {response}</p>}
    </div>
  );
}
