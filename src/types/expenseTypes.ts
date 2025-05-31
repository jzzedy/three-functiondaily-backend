export interface ExpenseInput {
    description: string;
    amount: number;
    category: string; 
    date: string; 
}

export interface Expense extends ExpenseInput {
    id: string;
    userId: string;
    createdAt: string; 
    updatedAt: string; 
}


export type ExpenseCategoryBE =
  | 'Food' | 'Transport' | 'Bills' | 'Entertainment' | 'Health'
  | 'Shopping' | 'Education' | 'Gifts' | 'Other';

export const expenseCategoriesBE: ExpenseCategoryBE[] = [
  'Food', 'Transport', 'Bills', 'Entertainment', 'Health',
  'Shopping', 'Education', 'Gifts', 'Other',
];