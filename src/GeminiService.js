/**
 * Service to interact with the Google Gemini API directly from the client side.
 */

// Helper to sanitize and extract highlight tags from the AI text response
export function parseAiResponse(text) {
  const highlightRegex = /\[Highlight:\s*([a-zA-Z0-9.\s()_-]+)\]/gi;
  let match;
  let activeHighlight = null;
  
  // Find the last highlight tag in the response, or the first one
  if ((match = highlightRegex.exec(text)) !== null) {
    activeHighlight = match[1].trim();
  }
  
  // Clean the text by removing all highlight tags from the user-facing message
  const cleanedText = text.replace(/\[Highlight:\s*[a-zA-Z0-9.\s()_-]+\]/gi, '').trim();
  
  return {
    text: cleanedText,
    highlight: activeHighlight
  };
}

export async function askGeminiTutor(messageHistory, apiKey, selectedNodeName = null) {
  if (!apiKey) {
    throw new Error('API Key is missing. Please configure it in the settings.');
  }

  // System instruction to guide the Gemini model
  const systemInstruction = `You are a formal, professional, and highly educational 3D Human Anatomy Tutor. 
Your goal is to explain anatomical structures, functions, and clinical significance clearly, concisely, and formally.

We have a 3D model of the human body loaded side-by-side with you. 
The 3D model consists of specific meshes representing anatomical regions named in this precise format:
"[System].[Region].[Side].[Index]" 

Here is how the names are structured:
- System: Abdomen, Arm, Back, Chest, Hair, Head, Leg, Neck, Pelvis
- Side: "l" for Left, "r" for Right
- Index: typically "001"

Examples of exact 3D node names:
- Head.Frontal region.l.001 (or .r.001)
- Neck.Carotid triangle.l.001
- Abdomen.Umbilical region.l.001
- Arm.Deltoid region.l.001
- Leg.Sole.l.001
- Pelvis.Anal region.l.001

CRITICAL REQUIREMENT:
If you are explaining a specific part of the body, or if the user asks about an organ/region, you MUST include a highlight tag in your text in the format: [Highlight: NodeName]
The NodeName must exactly match one of the region names. Make an educated guess of the node name based on the naming style above.
For example: "The forehead is covered by the frontal region of the skull [Highlight: Head.Frontal region.l.001]."

Provide formal, clear, and structured explanations. Do not use markdown headers that are too large (use ### instead of #). Keep responses educational, clean, and professional.`;

  // Format history for the Gemini API
  // Gemini API expects contents to start with 'user' and alternate strictly between 'user' and 'model'
  const contents = [];
  let foundFirstUser = false;
  
  for (const msg of messageHistory) {
    if (msg.role === 'user') {
      foundFirstUser = true;
      contents.push({
        role: 'user',
        parts: [{ text: msg.text }]
      });
    } else if (msg.role === 'ai' && foundFirstUser) {
      contents.push({
        role: 'model',
        parts: [{ text: msg.text }]
      });
    }
  }

  // If there is an active selected organ, append it as context
  let contextPrompt = '';
  if (selectedNodeName) {
    contextPrompt = `\n(Context: The user has selected the 3D region: "${selectedNodeName}". Focus your explanation or reference this region if applicable, and remember to include the [Highlight: ${selectedNodeName}] tag in your response.)`;
  }

  // Add the current user prompt to contents
  const lastUserMsg = contents[contents.length - 1];
  if (lastUserMsg && lastUserMsg.role === 'user') {
    lastUserMsg.parts[0].text += contextPrompt;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000
      }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || `HTTP error! status: ${response.status}`;
    throw new Error(errMsg);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!rawText) {
    throw new Error('Received empty response from the Gemini API.');
  }

  return parseAiResponse(rawText);
}
