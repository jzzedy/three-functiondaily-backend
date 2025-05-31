import fetch, { FetchError } from 'node-fetch'; 
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""; 

interface GeminiCandidatePart { text?: string; }
interface GeminiCandidateContent { parts?: GeminiCandidatePart[]; }
interface GeminiCandidate { content?: GeminiCandidateContent; }
interface GeminiErrorDetail { code: number; message: string; status: string; }
interface GeminiResponse { candidates?: GeminiCandidate[]; error?: GeminiErrorDetail; }

export const getAiSuggestion = async (prompt: string): Promise<string | null> => {
  console.log('[DEBUG AI_SERVICE] Attempting to get AI suggestion.');
  console.log('[DEBUG AI_SERVICE] Prompt for Gemini:', JSON.stringify(prompt));

  const apiKeyToUse = GEMINI_API_KEY; 

  if (!apiKeyToUse) {
    console.warn('[DEBUG AI_SERVICE] GEMINI_API_KEY is not set. Returning unavailable message.');
    return "AI suggestions are currently unavailable as the API key is not configured.";
  }

  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyToUse}`;
  console.log('[DEBUG AI_SERVICE] Calling Gemini API URL (key hidden for log):', `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_API_KEY_HIDDEN`);


  const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
  const payload = { contents: chatHistory };
  console.log('[DEBUG AI_SERVICE] Payload to Gemini:', JSON.stringify(payload));


  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', },
      body: JSON.stringify(payload),
    });

    console.log('[DEBUG AI_SERVICE] Gemini API response status:', response.status);

    if (!response.ok) {
      let errorDataText = await response.text(); 
      console.error('[DEBUG AI_SERVICE] Gemini API Error - Raw Response Text:', errorDataText);
      let errorData: Partial<GeminiResponse & { message?: string }> = {};
      try {
        errorData = JSON.parse(errorDataText) as GeminiResponse;
      } catch (e) {
        errorData = { message: response.statusText || errorDataText };
      }
      console.error('[DEBUG AI_SERVICE] Gemini API Error - Parsed Response:', errorData);
      const errorMessage = errorData.error?.message || errorData.message || 'Unknown API error from Gemini';
      throw new Error(`Gemini API request failed with status ${response.status}: ${errorMessage}`);
    }

    const result = (await response.json()) as GeminiResponse;
    console.log('[DEBUG AI_SERVICE] Gemini API Raw Result:', JSON.stringify(result, null, 2));


    if (result.candidates?.length && result.candidates[0].content?.parts?.length && result.candidates[0].content.parts[0].text) {
      const aiText = result.candidates[0].content.parts[0].text;
      console.log('[DEBUG AI_SERVICE] Successfully extracted AI text:', aiText);
      return aiText;
    } else if (result.error) {
      console.error('[DEBUG AI_SERVICE] Gemini API returned an error object in result:', result.error);
      throw new Error(`Gemini API Error: ${result.error.message} (Code: ${result.error.code})`);
    } else {
      console.warn('[DEBUG AI_SERVICE] Gemini API response structure unexpected or content missing.');
      return "I'm having a little trouble formulating a response right now. Please try again in a moment!";
    }
  } catch (error: unknown) {
    console.error('[DEBUG AI_SERVICE] Error during Gemini API call:', error);
    if (error instanceof FetchError) {
        return `Network error when trying to reach the AI service: ${error.message}`;
    } else if (error instanceof Error) {
        return `Sorry, I encountered an issue while fetching a suggestion: ${error.message}`;
    }
    return "Sorry, an unexpected error occurred while trying to get a suggestion.";
  }
};