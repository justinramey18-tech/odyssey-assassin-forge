export interface Question {
  id: number;
  section: 'explore' | 'connect' | 'drive';
  text: string;
  optionA: {
    text: string;
    value: string;
  };
  optionB: {
    text: string;
    value: string;
  };
}

export interface Answer {
  questionId: number;
  value: string;
}

export interface PersonaResult {
  playerArchetype: string;
  archetypeDescription: string;
  dmPersonaName: string;
  dmPersonaDescription: string;
  dmSystemPrompt: string;
}

export interface TestProgress {
  userId: string;
  answers: Answer[];
  currentQuestion: number;
  startedAt: string;
  updatedAt: string;
}

export interface PersonalityProfile extends PersonaResult {
  id: string;
  userId: string;
  questionsAnswered: number;
  testVersion: string;
  createdAt: string;
}
