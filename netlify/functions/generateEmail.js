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
        console.error('API key (GEMINI_KEY) is not configured in Netlify environment variables.');
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured.' }) };
    }

    // Using the correct model endpoint for generateContent with v1beta
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;

    try {
        const { prompt } = JSON.parse(event.body);

        if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
             console.error('Invalid or empty prompt received:', prompt);
             return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or empty prompt provided.' }) };
        }

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                topK: 1,
                topP: 1,
                maxOutputTokens: 8192,
                // Requesting JSON directly from the API
                responseMimeType: "application/json",
            },
            // It's good practice to include safety settings if needed,
            // though defaults are usually reasonable.
            // safetySettings: [
            //   { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            //   { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            //   { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            //   { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            // ]
        };

        console.log('Sending payload to Gemini API:', JSON.stringify(payload, null, 2)); // Log the payload

        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const responseBodyText = await apiResponse.text(); // Get response body as text first for logging
        console.log('Raw Gemini API Response Status:', apiResponse.status);
        console.log('Raw Gemini API Response Body:', responseBodyText);


        if (!apiResponse.ok) {
            console.error('Gemini API Error:', responseBodyText);
            // Try to parse the error response as JSON, fallback to text
            let errorDetails = responseBodyText;
            try {
                errorDetails = JSON.parse(responseBodyText);
            } catch (e) {
                // Ignore parsing error, use the raw text
            }
            return {
                statusCode: apiResponse.status,
                headers,
                body: JSON.stringify({
                    error: `Gemini API responded with status: ${apiResponse.status}`,
                    details: errorDetails
                }),
            };
        }

        let result;
        try {
            result = JSON.parse(responseBodyText); // Parse the raw text we already fetched
        } catch (error) {
             console.error("Failed to parse Gemini API response JSON:", error);
             console.error("Gemini Response Text that failed parsing:", responseBodyText);
             return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: `Failed to parse JSON response from Gemini API: ${error.message}` }),
             };
        }


        const candidate = result.candidates?.[0];
        const textResponse = candidate?.content?.parts?.[0]?.text;

        // Check for potential issues like safety blocks or other finish reasons
        if (candidate && candidate.finishReason && candidate.finishReason !== 'STOP') {
             console.warn(`Gemini API finishReason: ${candidate.finishReason}`, candidate.safetyRatings || '');
             // Depending on the reason, you might want to return a specific error or message
             if (candidate.finishReason === 'SAFETY') {
                 return {
                    statusCode: 400, // Or another appropriate status
                    headers,
                    body: JSON.stringify({ error: 'Content blocked due to safety settings.', details: candidate.safetyRatings }),
                 };
             }
             // For other reasons like MAX_TOKENS, RECITATION, etc.
             return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: `API generation finished unexpectedly: ${candidate.finishReason}` }),
             };
        }

        if (!textResponse) {
             console.error("Invalid API response structure or empty text:", JSON.stringify(result, null, 2));
             return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "No valid text response found in API result." }),
             };
        }

        // --- REMOVED MARKDOWN STRIPPING ---
        // Since we requested "application/json", textResponse should BE the JSON string.
        let parsedJson;
        try {
            // Directly parse the textResponse, assuming it's valid JSON from the API
            parsedJson = JSON.parse(textResponse);
        } catch (error) {
            console.error('Failed to parse the content text as JSON:', error);
            console.error('Content text that failed parsing:', textResponse);
             return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: `API returned text that is not valid JSON: ${error.message}` }),
             };
        }
        // --- END REMOVAL ---


        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(parsedJson), // Return the successfully parsed JSON object
        };

    } catch (error) {
        console.error('Netlify Function Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: `An internal server error occurred: ${error.message}`, details: error.stack }),
        };
    }
};
