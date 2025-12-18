
export enum Confidence {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low'
}

export enum Course {
  BRONZE = 'Bronze',
  SILVER = 'Silver',
  GOLD = 'Gold',
  BONUS = 'Bonus'
}

export enum KitchenStatus {
  DUMPSTER_FIRE = '🗑️ Dumpster Fire',
  FUNCTIONAL = '🍳 Functional',
  PROFESSIONAL = '👨‍🍳 Professional',
  MICHELIN_STAR = '⭐ Michelin Star'
}

export interface Field {
  name: string;
  originalName: string;
  type: string;
  confidence: Confidence;
  description: string;
  sampleData?: any[];
}

export interface RecipeCard {
  id: number;
  fieldName: string;
  course: Course;
  decision: string;
  rationale: string;
  bigQueryNote: string;
  broccoliniReaction: string;
}

export interface GameState {
  currentCourse: Course;
  fields: Field[];
  decisions: RecipeCard[];
  points: number;
  kitchenMeter: KitchenStatus;
  currentQuestion: Question | null;
  isCompleted: boolean;
  history: string[];
}

export interface Question {
  field: string;
  observation: string;
  ambiguity: string;
  options: { 
    text: string; 
    value: string; 
    tradeoff: string;
    suggestedRationale: string; // Pre-populated rationale
  }[];
  course: Course;
  recommendedIndex?: number;
  recommendationConfidence?: Confidence;
}

export interface DataDictionaryEntry {
  description: string;
  sourceMapping: string;
  layer: Course;
}

export interface FinalDeliverables {
  jsonSchema: Record<string, any>;
  bigQueryDDL: string;
  dataDictionary: Record<string, DataDictionaryEntry>;
  glossary: Record<string, string>;
  transformationRules: string;
  limitations: string;
}
