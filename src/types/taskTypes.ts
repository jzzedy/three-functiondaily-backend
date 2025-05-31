export interface TaskInput {
    title: string;
    description?: string | null;
    deadline?: string | null; 
    category?: string | null;
    isCompleted?: boolean;
}

export interface Task extends TaskInput {
    id: string;
    userId: string;
    createdAt: string; 
    updatedAt: string; 
    isCompleted: boolean; 
}
