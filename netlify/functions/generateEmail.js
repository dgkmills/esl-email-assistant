const fetch = require('node-fetch');

const headers = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    const API_KEY = process.env.GEMINI_KEY;
    if (!API_KEY) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured.' }) };
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;

    try {
        const { prompt } = JSON.parse(event.body);

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.8,
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
        const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!textResponse) {
             console.error("Invalid API response structure:", JSON.stringify(result, null, 2));
             throw new Error("No valid text response from API. The response structure might have changed.");
        }

        const parsedJson = JSON.parse(textResponse);

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
            body: JSON.stringify({ error: 'An internal error occurred. This could be due to a malformed API response or a function timeout.' }),
        };
    }
};

