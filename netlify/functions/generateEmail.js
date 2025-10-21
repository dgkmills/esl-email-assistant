const fetch = require('node-fetch');

exports.handler = async (event) => {
    // Netlify functions are triggered by HTTP events. We only accept POST.
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // The Gemini API key is stored as an environment variable in Netlify
    const API_KEY = process.env.GEMINI_KEY;
    if (!API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'API key is not configured.' })
        };
    }

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
                body: JSON.stringify({ error: `Gemini API responded with status: ${apiResponse.status}` }),
            };
        }

        const result = await apiResponse.json();
        
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";

        return {
            statusCode: 200,
            body: JSON.stringify({ text }),
        };

    } catch (error) {
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal error occurred.' }),
        };
    }
};
