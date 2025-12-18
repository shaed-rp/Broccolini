
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Course, Field, Question, RecipeCard, FinalDeliverables } from "../types";
import { MEDALLION_PRACTICES, AUTOMOTIVE_COMMERCIAL_CONTEXT } from "../knowledgeBase";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Big Query Broccolini's System Persona
 * Expert in Medallion Architecture, 10 years at Big Q, obsessively clean data chef.
 */
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
 * Parses raw file content to identify fields and potential types.
 */
export async function parseFileData(fileName: string, content: string): Promise<Field[]> {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${SYSTEM_CONTEXT}\n\nAnalyze file "${fileName}":\n\n${content.substring(0, 5000)}\n\nExtract fields and return as JSON.`,
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
}

/**
 * Generates a challenge question for the current medallion layer.
 */
export async function generateQuestion(fields: Field[], decisions: RecipeCard[], course: Course): Promise<Question> {
  const prompt = `
    ${SYSTEM_CONTEXT}
    Course: ${course}.
    Fields: ${JSON.stringify(fields.map(f => f.name))}.
    Current Decisions: ${JSON.stringify(decisions)}.
    
    Pick an unaddressed field and generate a critical architectural question for the ${course} layer.
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
                tradeoff: { type: Type.STRING }
              }
            }
          },
          course: { type: Type.STRING },
          recommendedIndex: { type: Type.INTEGER },
          recommendationConfidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
        }
      }
    }
  });

  return JSON.parse(response.text);
}

/**
 * Incorporates user feedback to refine the current question.
 */
export async function refineQuestion(currentQuestion: Question, userThoughts: string, course: Course): Promise<Question> {
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
                tradeoff: { type: Type.STRING }
              }
            }
          },
          course: { type: Type.STRING },
          recommendedIndex: { type: Type.INTEGER },
          recommendationConfidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
        }
      }
    }
  });

  return JSON.parse(response.text);
}

/**
 * Creates a formalized Recipe Card for a schema decision.
 */
export async function generateRecipeCard(
  field: string, 
  decision: string, 
  rationale: string, 
  course: Course, 
  id: number
): Promise<RecipeCard> {
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
        }
      }
    }
  });

  const card = JSON.parse(response.text);
  return { ...card, id };
}

/**
 * Compiles all decisions into final technical assets.
 */
export async function generateFinalDeliverables(fields: Field[], decisions: RecipeCard[]): Promise<FinalDeliverables> {
  const prompt = `
    ${SYSTEM_CONTEXT}
    Fields: ${JSON.stringify(fields)}
    Decisions: ${JSON.stringify(decisions)}
    
    Synthesize the final BigQuery Medallion Schema, DDL, and documentation.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          jsonSchema: { type: Type.OBJECT },
          bigQueryDDL: { type: Type.STRING },
          dataDictionary: { type: Type.OBJECT },
          glossary: { type: Type.OBJECT },
          transformationRules: { type: Type.STRING },
          limitations: { type: Type.STRING }
        }
      }
    }
  });

  return JSON.parse(response.text);
}

/**
 * Generates Broccolini's voice for a given text.
 */
export async function generateSpeech(text: string): Promise<string> {
  const prompt = `Persona: Big Query Broccolini (Italian Senior Data Chef). 
  Style: Warm, slightly sassy, expert.
  Speak this: ${text}`;
  
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
}
