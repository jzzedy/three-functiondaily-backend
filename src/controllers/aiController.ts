// src/controllers/aiController.ts
import type { Response } from 'express'; 
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getAiSuggestion } from '../services/aiService';
import pool from '../config/database';
import { format, startOfMonth, endOfMonth, subDays, isSameDay, parseISO } from 'date-fns'; 
import { RowDataPacket } from 'mysql2/promise';
import type { Habit, HabitCompletion, HabitFrequencyBE } from '../types/habitTypes'; 

type AiAction = 
  | 'added' | 'completed' | 'created' | 'threshold_reached' | 'streak_update' 
  | 'repeated_category_expense' | 'general_info' | 'milestone';

interface AiTriggerEventData { 
  itemName?: string; 
  itemValue?: string | number; 
  itemCategory?: string; 
  action?: AiAction; 
  count?: number; 
  currency?: 'PHP' | 'USD'; 
  expenseAmount?: number;
  habitStreakLength?: number;
  [key: string]: any; 
}

// Added suggestionType parameter here
const getRichUserContext = async (userId: string, username?: string | null, eventData?: AiTriggerEventData, suggestionType?: string): Promise<string> => {
    console.log(`[DEBUG AI_CONTROLLER] Getting rich context for userId: ${userId}, eventData:`, eventData, `suggestionType: ${suggestionType}`);
    let contextParts: string[] = [];
    contextParts.push(`User: ${username || 'Valued User'}.`);
    contextParts.push(`Today is ${format(new Date(), 'EEEE, MMMM d,<y_bin_46>')}.`); 

    try {
        // Task context
        const todayYYYYMMDD = format(new Date(), 'yyyy-MM-dd');
        const [overdueTasksResult] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as count FROM Tasks WHERE userId = ? AND isCompleted = FALSE AND deadline < ?", [userId, todayYYYYMMDD]);
        const overdueTasksCount = overdueTasksResult[0]?.count || 0;
        if (overdueTasksCount > 0) contextParts.push(`They have ${overdueTasksCount} overdue task${overdueTasksCount > 1 ? 's' : ''}.`);

        const [dueTodayTasksResult] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as count FROM Tasks WHERE userId = ? AND isCompleted = FALSE AND deadline = ?", [userId, todayYYYYMMDD]);
        const dueTodayTasksCount = dueTodayTasksResult[0]?.count || 0;
        if (dueTodayTasksCount > 0) contextParts.push(`They also have ${dueTodayTasksCount} task${dueTodayTasksCount > 1 ? 's' : ''} due today.`);
        else if (overdueTasksCount === 0 && eventData?.action !== 'completed') contextParts.push("They have no tasks immediately due or overdue.");

        // Use passed suggestionType for conditions
        if (eventData?.action === 'completed' && eventData.itemName) {
            contextParts.push(`They just completed the task: "${eventData.itemName}".`);
        } else if (eventData?.action === 'added' && eventData.itemName && (suggestionType === 'task_tip')) { 
            contextParts.push(`They just added a new task: "${eventData.itemName}".`);
        }

        // Expense context
        const now = new Date();
        const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
        const [monthlyExpensesResult] = await pool.query<RowDataPacket[]>("SELECT SUM(amount) as total FROM Expenses WHERE userId = ? AND date BETWEEN ? AND ?", [userId, monthStart, monthEnd]);
        const monthlyTotal = monthlyExpensesResult[0]?.total || 0;
        if (monthlyTotal > 0) contextParts.push(`This month, they have spent ${eventData?.currency || '$'}${parseFloat(monthlyTotal).toFixed(2)} so far.`);

        // Use passed suggestionType for conditions
        if(suggestionType === 'expense_insight') { 
            if(eventData?.action === 'added' && eventData.itemCategory && eventData.itemValue) {
                contextParts.push(`They just added an expense of ${eventData.itemValue} for "${eventData.itemCategory}".`);
            }
            if(eventData?.action === 'threshold_reached' && eventData.itemCategory && eventData.expenseAmount && eventData.currency) {
                contextParts.push(`They just logged a significant expense of ${eventData.currency}${Number(eventData.expenseAmount).toFixed(2)} for "${eventData.itemCategory}".`);
            }
            if(eventData?.action === 'repeated_category_expense' && eventData.itemCategory && eventData.count) {
                contextParts.push(`They have logged expenses for "${eventData.itemCategory}" ${eventData.count} times today.`);
            }
        }

        // Habit context
        // Use passed suggestionType for conditions
        if (suggestionType === 'habit_motivation') { 
            if (eventData?.action === 'created' && eventData.itemName) {
                contextParts.push(`They just created a new habit: "${eventData.itemName}".`);
            }
            if (eventData?.action === 'streak_update' && eventData.itemName && eventData.habitStreakLength) {
                contextParts.push(`They are now on a ${eventData.habitStreakLength}-day streak for their habit: "${eventData.itemName}".`);
            } else if (!eventData?.action) { 
                const [habitsResult] = await pool.query<RowDataPacket[]>("SELECT name FROM Habits WHERE userId = ? ORDER BY updatedAt DESC LIMIT 1", [userId]); 
                if (habitsResult.length > 0) {
                    contextParts.push(`One of their habits is "${habitsResult[0].name}".`);
                }
            }
        }

    } catch (e) { console.error("[DEBUG AI_CONTROLLER] Error fetching detailed context for AI:", e); }

    const finalContext = contextParts.join(' ');
    console.log(`[DEBUG AI_CONTROLLER] Final user context for AI: "${finalContext}"`);
    return finalContext;
};

export const handleAiSuggestion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  console.log('[DEBUG AI_CONTROLLER] handleAiSuggestion called. Body:', req.body);
  const { suggestionType, data: eventData } = req.body as { suggestionType: string, data?: AiTriggerEventData }; 
  const userId = req.user?.id;
  const username = req.user?.username;

  if (!userId) {
    res.status(401).json({ message: 'User not authenticated.' });
    return;
  }
  if (!suggestionType) {
    res.status(400).json({ message: 'suggestionType is required.' });
    return;
  }

  let prompt = "";
  // Pass suggestionType to getRichUserContext
  const userContext = await getRichUserContext(userId, username, eventData, suggestionType); 

  switch (suggestionType) {
    case 'general_greeting':
      prompt = `Based on this context: "${userContext}". Generate a very short, friendly, and positive greeting or an insightful thought for the user (1-2 sentences max). Be encouraging.`;
      break;
    case 'task_tip':
      if (eventData?.action === 'added' && eventData.itemName) {
        prompt = `Context: "${userContext}". The user just added a new task: "${eventData.itemName}". Offer a brief, encouraging tip about starting new tasks or staying organized (1-2 sentences max).`;
      } else if (eventData?.action === 'completed' && eventData.itemName) {
        prompt = `Context: "${userContext}". The user just completed a task: "${eventData.itemName}". Offer brief praise and a positive follow-up thought or tip (1-2 sentences max).`;
      } else {
        prompt = `Context: "${userContext}". Offer a concise, actionable, and empathetic productivity tip specifically related to managing tasks. If they have overdue tasks, acknowledge it gently and offer a tip for tackling them. If they have tasks due today, offer a tip for focus. If no tasks, a general productivity tip is fine (1-2 sentences max).`;
      }
      break;
    case 'expense_insight':
      if (eventData?.action === 'threshold_reached' && eventData.currency && eventData.expenseAmount && eventData.itemCategory) {
        prompt = `Context: "${userContext}". The user just logged a significant expense: ${eventData.currency}${Number(eventData.expenseAmount).toFixed(2)} for "${eventData.itemCategory}". Offer a very brief, non-judgmental observation or a gentle tip about mindful spending (1-2 sentences max).`;
      } else if (eventData?.action === 'repeated_category_expense' && eventData.itemCategory && eventData.count) {
        prompt = `Context: "${userContext}". The user has logged expenses for "${eventData.itemCategory}" ${eventData.count} times today. Offer a brief, neutral observation or a gentle question about this pattern (1-2 sentences max). Avoid being accusatory.`;
      } else if (eventData?.action === 'added' && eventData.itemValue && eventData.itemCategory) {
         prompt = `Context: "${userContext}". The user just added an expense: ${eventData.itemValue} for "${eventData.itemCategory}". Offer a brief, positive acknowledgement or a very general financial wellness tip (1-2 sentences max).`;
      }
       else {
        prompt = `Context: "${userContext}". Give a short, general, and positive tip about personal finance awareness or a small, encouraging insight about spending habits, avoiding judgment (1-2 sentences max). Do not lecture.`;
      }
      break;
    case 'habit_motivation':
      if (eventData?.action === 'created' && eventData.itemName) {
        prompt = `Context: "${userContext}". The user just created a new habit: "${eventData.itemName}". Offer a short, encouraging message about starting new habits (1-2 sentences max).`;
      } else if (eventData?.action === 'streak_update' && eventData.itemName && eventData.habitStreakLength) {
        prompt = `Context: "${userContext}". The user is now on a ${eventData.habitStreakLength}-day streak for their habit: "${eventData.itemName}". Provide a specific, positive, and motivational message celebrating this milestone (1-2 sentences max).`;
      } else {
        prompt = `Context: "${userContext}". Provide a short, encouraging message about building or maintaining good habits (1-2 sentences max).`;
      }
      break;
    case 'daily_summary_prompt':
        prompt = `Context: "${userContext}". Generate a single, engaging, and positive open-ended question to help the user reflect on their day's achievements or positive aspects, or to plan for a productive tomorrow (1 sentence max).`;
        break;
    default:
      prompt = `Context: "${userContext}". Offer a general piece of wisdom, a light-hearted positive comment, or a very short motivational quote (1-2 sentences max).`;
  }
  console.log(`[DEBUG AI_CONTROLLER] Generated prompt for type '${suggestionType}', action '${eventData?.action}': "${prompt}"`);

  try {
    const aiText = await getAiSuggestion(prompt);
    console.log('[DEBUG AI_CONTROLLER] Text received from aiService:', aiText);
    if (aiText && !aiText.toLowerCase().includes("unavailable") && !aiText.toLowerCase().includes("couldn't fetch")) {
      res.status(200).json({
        messageType: 'ai_suggestion',
        text: aiText,
        suggestionCategory: suggestionType,
      });
    } else {
      console.warn('[DEBUG AI_CONTROLLER] AI service returned null or unavailable message. Sending 503.');
      res.status(503).json({ message: aiText || 'AI service could not generate a suggestion at this time.' });
    }
  } catch (error) {
    console.error('[DEBUG AI_CONTROLLER] Error in AI suggestion handler:', error);
    res.status(500).json({ message: 'Server error while processing AI suggestion.' });
  }
};

declare module 'mysql2/promise' {
    interface RowDataPacket {
        [column: string]: any;
    }
}