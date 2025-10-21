const fetch = require('node-fetch');

// CORS headers to allow requests from any origin
const headers = {
  'Access-Control-Allow-Origin': '*', // Or your specific domain for better security
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
    // Handle preflight CORS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    const API_KEY = process.env.GEMINI_KEY;
    if (!API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'API key is not configured.' })
        };
    }

    // Corrected the typo in the URL here
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;

    try {
        const { prompt } = JSON.parse(event.body);

        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }],
             generationConfig: {
                temperature: 0.7,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
                // Request JSON output
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
                body: JSON.stringify({ error: `Gemini API responded with status: ${apiResponse.status}` }),
            };
        }

        const result = await apiResponse.json();
        
        // The API now returns a JSON string in the text part, so we need to parse it.
        const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) {
             throw new Error("No text response from API.");
        }

        const parsedJson = JSON.parse(textResponse);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(parsedJson), // Forward the parsed JSON
        };

    } catch (error) {
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'An internal error occurred or the API returned an unexpected format.' }),
        };
    }
};

