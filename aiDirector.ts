import { GoogleGenAI, Type } from "@google/genai";
import { PlanetInfo, GameEvent, Resources } from "../types/game";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const generatePlanet = async (): Promise<PlanetInfo> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Generate a unique sci-fi planet for a survival game. Provide name, type, atmosphere, temperature, and a brief description. Also provide a 'mission objective' (e.g., 'Establish a mineral mine', 'Find signs of ancient life'). Also suggest starting resources (oxygen, energy, food, minerals) between 50-100.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          type: { type: Type.STRING },
          atmosphere: { type: Type.STRING },
          temperature: { type: Type.STRING },
          description: { type: Type.STRING },
          objective: { type: Type.STRING },
          initialResources: {
            type: Type.OBJECT,
            properties: {
              oxygen: { type: Type.NUMBER },
              energy: { type: Type.NUMBER },
              food: { type: Type.NUMBER },
              minerals: { type: Type.NUMBER },
              fuel: { type: Type.NUMBER },
            },
            required: ["oxygen", "energy", "food", "minerals", "fuel"]
          }
        },
        required: ["name", "type", "atmosphere", "temperature", "description", "objective", "initialResources"]
      }
    }
  });

  return JSON.parse(response.text || '{}') as PlanetInfo;
};

export const generateDailyEvent = async (planet: PlanetInfo, resources: Resources, day: number): Promise<GameEvent> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `The player is on planet ${planet.name} (${planet.type}). Current day: ${day}. Resources: ${JSON.stringify(resources)}. Generate a random survival event. It could be a storm, a discovery, or a mechanical failure.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["positive", "negative", "neutral"] },
          impact: {
            type: Type.OBJECT,
            properties: {
              oxygen: { type: Type.NUMBER },
              energy: { type: Type.NUMBER },
              food: { type: Type.NUMBER },
              minerals: { type: Type.NUMBER },
            }
          }
        },
        required: ["title", "description", "type"]
      }
    }
  });

  const eventData = JSON.parse(response.text || '{}');
  return {
    ...eventData,
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now()
  } as GameEvent;
};
