
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Course, Field, Question, RecipeCard, FinalDeliverables } from "../types";
import { MEDALLION_PRACTICES, AUTOMOTIVE_COMMERCIAL_CONTEXT } from "../knowledgeBase";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_CONTEXT = `
  You are Big Query Broccolini, a senior Data Chef at Big Q for over a decade.
  Appearance: Pixel-art broccoli with a lush green floret hairstyle, a distinguished mustache, 
  and a teal tech-hoodie featuring a 'BQ' golden medallion.
  
  Your Mission: Project CRISTIAN (Calmly Rescue Impossible Schemas Through Intelligent Architecture Normalization).
  Personality: Sassy but world-class professional. You speak with a warm Italian flair.
  
  Domain Expertise:
  - Medallion Architecture: ${JSON.stringify(MEDALLION_PRACTICES)}
  - Automotive/Fleet Assets: ${JSON.stringify(AUTOMOTIVE_COMMERCIAL_CONTEXT)}
  
  Guidelines:
  - For BEVs, always look for charging metrics (KW, State of Charge).
  - For Heavy Duty, always look for GVWR and Class 8 specifics.
  - BigQuery focus: Partitioning, Clustering, and Schema Design.
`;

/**
 * Utility to handle API retries with robust exponential backoff
 * Adjusted for strict quota environments (e.g. 429 errors)
 */
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 5, baseDelay = 5000): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorStr = JSON.stringify(error).toLowerCase();
      const isRateLimit = 
        error?.message?.includes('429') || 
        error?.status === 429 || 
        errorStr.includes('quota') || 
        errorStr.includes('rate_limit') || 
        errorStr.includes('429') ||
        errorStr.includes('resource_exhausted');
      
      if (isRateLimit && i < maxRetries) {
        // More aggressive delay for 429s: 5s, 10s, 20s, 40s, 80s
        const delay = baseDelay * Math.pow(2, i);
        console.warn(`Kitchen is too hot! (429/Quota). Broccolini is cooling down for ${delay}ms before retrying... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function parseFileData(fileName: string, content: string, mimeType: string = 'text/plain'): Promise<Field[]> {
  return callWithRetry(async () => {
    const isPdf = mimeType === 'application/pdf';
    const parts = isPdf 
      ? [
          { inlineData: { mimeType: 'application/pdf', data: content } },
          { text: `${SYSTEM_CONTEXT}\n\nAnalyze the attached PDF file "${fileName}". Extract the data fields/columns described or contained within it and return as JSON.` }
        ]
      : [
          { text: `${SYSTEM_CONTEXT}\n\nAnalyze file "${fileName}":\n\n${content.substring(0, 5000)}\n\nExtract fields and return as JSON.` }
        ];

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              originalName: { type: Type.STRING },
              type: { type: Type.STRING },
              confidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
              description: { type: Type.STRING },
            },
            required: ['name', 'originalName', 'type', 'confidence', 'description']
          }
        }
      }
    });
    return JSON.parse(response.text);
  });
}

export async function generateQuestion(fields: Field[], decisions: RecipeCard[], course: Course): Promise<Question> {
  return callWithRetry(async () => {
    const prompt = `
      ${SYSTEM_CONTEXT}
      Course: ${course}.
      Fields: ${JSON.stringify(fields.map(f => f.name))}.
      Current Decisions: ${JSON.stringify(decisions)}.
      
      Pick an unaddressed field and generate a critical architectural question for the ${course} layer.
      For each option, provide a "suggestedRationale" that explains WHY this choice would be made by an expert architect at Big Q.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            field: { type: Type.STRING },
            observation: { type: Type.STRING },
            ambiguity: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  value: { type: Type.STRING },
                  tradeoff: { type: Type.STRING },
                  suggestedRationale: { type: Type.STRING }
                },
                required: ['text', 'value', 'tradeoff', 'suggestedRationale']
              }
            },
            course: { type: Type.STRING },
            recommendedIndex: { type: Type.INTEGER },
            recommendationConfidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
          },
          required: ['field', 'observation', 'ambiguity', 'options', 'course', 'recommendedIndex']
        }
      }
    });

    return JSON.parse(response.text);
  });
}

export async function refineQuestion(currentQuestion: Question, userThoughts: string, course: Course): Promise<Question> {
  return callWithRetry(async () => {
    const prompt = `
      ${SYSTEM_CONTEXT}
      Current Challenge: ${JSON.stringify(currentQuestion)}
      User Insight: "${userThoughts}"
      
      Adjust the options and recommendation based on this new culinary insight. 
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            field: { type: Type.STRING },
            observation: { type: Type.STRING },
            ambiguity: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  value: { type: Type.STRING },
                  tradeoff: { type: Type.STRING },
                  suggestedRationale: { type: Type.STRING }
                },
                required: ['text', 'value', 'tradeoff', 'suggestedRationale']
              }
            },
            course: { type: Type.STRING },
            recommendedIndex: { type: Type.INTEGER },
            recommendationConfidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
          },
          required: ['field', 'observation', 'ambiguity', 'options', 'course', 'recommendedIndex']
        }
      }
    });

    return JSON.parse(response.text);
  });
}

export async function generateRecipeCard(
  field: string, 
  decision: string, 
  rationale: string, 
  course: Course, 
  id: number
): Promise<RecipeCard> {
  return callWithRetry(async () => {
    const prompt = `
      ${SYSTEM_CONTEXT}
      Field: ${field}
      Decision: ${decision}
      Rationale: ${rationale}
      Course: ${course}
      
      Generate a Recipe Card including a "bigQueryNote" (technical implementation) and a sassy "broccoliniReaction".
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fieldName: { type: Type.STRING },
            course: { type: Type.STRING },
            decision: { type: Type.STRING },
            rationale: { type: Type.STRING },
            bigQueryNote: { type: Type.STRING },
            broccoliniReaction: { type: Type.STRING }
          },
          required: ['fieldName', 'course', 'decision', 'rationale', 'bigQueryNote', 'broccoliniReaction']
        }
      }
    });

    const card = JSON.parse(response.text);
    return { ...card, id };
  });
}

export async function generateFinalDeliverables(fields: Field[], decisions: RecipeCard[]): Promise<FinalDeliverables> {
  return callWithRetry(async () => {
    const prompt = `
      ${SYSTEM_CONTEXT}
      Fields: ${JSON.stringify(fields)}
      Decisions: ${JSON.stringify(decisions)}
      
      Synthesize the final technical assets for Project CRISTIAN. 
      - jsonSchema: Provide a stringified JSON schema representing the Gold layer.
      - bigQueryDDL: Provide full SQL to create Bronze, Silver, and Gold tables.
      - dataDictionary: Provide an array of objects with fieldName, description, sourceMapping, and layer.
      - glossary: Provide an array of objects with term and definition.
      - transformationRules: Key logic to move from Bronze to Gold.
      - limitations: Any data quality caveats.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            jsonSchema: { type: Type.STRING },
            bigQueryDDL: { type: Type.STRING },
            dataDictionary: { 
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  fieldName: { type: Type.STRING },
                  description: { type: Type.STRING },
                  sourceMapping: { type: Type.STRING },
                  layer: { type: Type.STRING }
                },
                required: ['fieldName', 'description', 'sourceMapping', 'layer']
              }
            },
            glossary: { 
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  definition: { type: Type.STRING }
                },
                required: ['term', 'definition']
              }
            },
            transformationRules: { type: Type.STRING },
            limitations: { type: Type.STRING }
          },
          required: ['jsonSchema', 'bigQueryDDL', 'dataDictionary', 'glossary', 'transformationRules', 'limitations']
        }
      }
    });

    const raw = JSON.parse(response.text);
    
    // Reconstruct Record types expected by the frontend
    const dataDictionary: Record<string, any> = {};
    raw.dataDictionary.forEach((item: any) => {
      dataDictionary[item.fieldName] = {
        description: item.description,
        sourceMapping: item.sourceMapping,
        layer: item.layer
      };
    });

    const glossary: Record<string, string> = {};
    raw.glossary.forEach((item: any) => {
      glossary[item.term] = item.definition;
    });

    let parsedJsonSchema = {};
    try {
      parsedJsonSchema = JSON.parse(raw.jsonSchema);
    } catch (e) {
      console.warn("Failed to parse jsonSchema string, using raw value", e);
      parsedJsonSchema = { error: "Schema parsing failed", raw: raw.jsonSchema };
    }

    return {
      ...raw,
      jsonSchema: parsedJsonSchema,
      dataDictionary,
      glossary
    };
  });
}

export async function generateSpeech(text: string): Promise<string> {
  return callWithRetry(async () => {
    const prompt = `Persona: Big Query Broccolini (Italian Senior Data Chef). Speak this: ${text}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Audio generation failed");
    return base64Audio;
  }, 2, 3000); // Fewer retries for speech to avoid long blocking UI states
}
