export type HabitFrequencyBE = 'daily' | 'weekly' | 'monthly';

export interface HabitInput {
    name: string;
    description?: string | null;
    frequency: HabitFrequencyBE;
    goal?: string | null;
    color?: string | null;
    icon?: string | null;
}

export interface HabitCompletionInput {
    date: string; 
    notes?: string | null;
}

export interface HabitCompletion extends HabitCompletionInput {
    id: string;
    habitId: string;
    userId: string; 
    createdAt: string; 
}

export interface Habit extends HabitInput {
    id: string;
    userId: string;
    completions?: HabitCompletion[]; 
    createdAt: string; 
    updatedAt: string; 
}