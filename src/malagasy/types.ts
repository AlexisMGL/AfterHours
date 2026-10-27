/** Stable IDs are the contract between authored content, engines and browser saves. */
export interface Source {
  id: string; title: string; author: string; url: string;
  category: 'language' | 'grammar' | 'dictionary' | 'geography' | 'audio';
  consulted: boolean; supports: string; license: string; date?: string;
}
export interface World {
  id: string; number: number; name: string; subtitle: string; description: string;
  vocabulary: string[]; grammar: string[]; skills: string[]; culture: string;
  coordinates: [number, number]; prerequisites: string[]; estimatedHours: number;
  implemented: boolean;
}
export interface Concept {
  id: string; category: 'vocabulary' | 'grammar' | 'communication';
  label: string; malagasy?: string; french?: string; objective: string;
  introducedIn: string; prerequisites: string[]; sourceIds: string[];
}
export interface Vocabulary {
  id: string; malagasy: string; french: string; note: string;
  conceptId: string; unitId: string; sourceIds: string[]; audioId?: string;
}
export interface LessonNote { title: string; body: string; example?: string; translation?: string }
export type CharacterId = 'lova' | 'mia';
export interface DialogueTurn {
  speaker: CharacterId; text: string; translation: string; highlight?: string;
  audioId?: string;
}
export interface DialogueScene {
  id: string; setting: string; turns: DialogueTurn[];
  takeaway?: { malagasy: string; french: string };
}
export interface Lesson {
  id: string; worldId: string; unitId: string; title: string; description: string;
  kind: 'learn' | 'story' | 'checkpoint'; objectives: string[];
  introduces: string[]; reviews: string[]; prerequisites: string[];
  exerciseIds: string[]; notes: LessonNote[]; estimatedMinutes: number; sourceIds: string[];
  scenes?: DialogueScene[];
}
export interface Unit {
  id: string; worldId: string; number: number; title: string; malagasyTitle: string;
  description: string; lessonIds: string[]; implemented: boolean; objectives: string[];
}
export type ExerciseType = 'choice' | 'match' | 'order' | 'cloze' | 'translate' | 'reading' | 'dialogue' | 'culture' | 'listening';
export interface Exercise {
  id: string; type: ExerciseType; prompt: string; context?: string;
  question: string; answers: string[]; choices?: string[];
  /** Only explicitly authored Malagasy selections may be pronounced. */
  selectionLanguage?: 'mg'; spokenSelections?: string[];
  tokens?: string[]; pairs?: { left: string; right: string }[];
  explanation: string; concepts: string[]; sourceIds: string[];
  difficulty: number; audioId?: string;
  dialogue?: DialogueTurn[];
}
export interface AudioAsset {
  id: string; url: string; sourceId: string; transcript: string;
  status: 'verified' | 'pending' | 'synthetic';
  character?: CharacterId | 'any';
  performer?: string;
  verification?: 'published-pronunciation' | 'native-speaker-reviewed' | 'model-generated';
  model?: string;
  processing?: { originalAssetId: string; pitchSemitones: number; tempo: number };
}
export interface Content {
  worlds: World[]; units: Unit[]; lessons: Lesson[]; exercises: Exercise[];
  concepts: Concept[]; vocabulary: Vocabulary[]; sources: Source[]; audio: AudioAsset[];
}
export interface Mastery {
  introduced: boolean; attempts: number; correct: number; mistakes: number;
  streak: number; mastery: number; lastPracticed: string | null;
  nextReview: string | null; intervalDays: number;
}
export interface LearningEvent {
  exerciseId: string; correct: boolean; at: string; conceptIds: string[];
}
export interface Progress {
  schemaVersion: 1; createdAt: string; updatedAt: string;
  xp: number; completedLessons: string[]; rewardedExercises: string[];
  concepts: Record<string, Mastery>; history: LearningEvent[];
  activityDates: string[]; achievements: string[];
  settings: { muted: boolean; dailyGoal: number };
}
