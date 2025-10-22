const fetch = require('node-fetch');

// Set common headers for CORS and allowed methods
const headers = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
    // Handle preflight CORS request
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    const API_KEY = process.env.GEMINI_KEY;
    if (!API_KEY) {
        console.error('API key is not configured.');
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured.' }) };
    }

    // REVERTED: Changed back to the original, working model name for the v1beta endpoint.
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;

    try {
        const { prompt } = JSON.parse(event.body);

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7, // Lowered for more predictable JSON structure
                topK: 1,
                topP: 1,
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
            },
        };

        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error('Gemini API Error:', errorBody);
            return {
                statusCode: apiResponse.status,
                headers,
                body: JSON.stringify({ error: `Gemini API responded with status: ${apiResponse.status}, Body: ${errorBody}` }),
            };
        }

        const result = await apiResponse.json();
        const candidate = result.candidates?.[0];
        const textResponse = candidate?.content?.parts?.[0]?.text;
        
        if (!textResponse) {
             console.error("Invalid API response structure:", JSON.stringify(result, null, 2));
             if (candidate && candidate.finishReason !== 'STOP') {
                throw new Error(`API generation finished for reason: ${candidate.finishReason}. Check safety ratings or prompt content.`);
             }
             throw new Error("No valid text response from API. The response structure might have changed or be empty.");
        }

        // The API should return clean JSON, but as a fallback, try to extract it if it's wrapped in markdown code blocks.
        let cleanJsonText = textResponse.trim();
        if (cleanJsonText.startsWith('```json')) {
            cleanJsonText = cleanJsonText.substring(7, cleanJsonText.length - 3).trim();
        } else if (cleanJsonText.startsWith('```')) {
             cleanJsonText = cleanJsonText.substring(3, cleanJsonText.length - 3).trim();
        }
        
        const parsedJson = JSON.parse(cleanJsonText);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(parsedJson),
        };

    } catch (error) {
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: `An internal error occurred: ${error.message}` }),
        };
    }
};



