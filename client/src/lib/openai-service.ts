import { apiRequest } from "./queryClient";

// Message type for chat interface
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Chat history interface
export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

// Service for interacting with OpenAI API
export async function sendMessage(messages: Message[]): Promise<string> {
  try {
    const response = await apiRequest('POST', '/api/ai/chat', { messages });
    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error('Error sending message to OpenAI:', error);
    throw new Error('Failed to get response from AI assistant');
  }
}

// Helper function to generate a unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Create a new chat session
export function createNewSession(): ChatSession {
  return {
    id: generateId(),
    title: 'New Conversation',
    messages: [
      {
        role: 'system',
        content: 'You are an AI medical assistant helping a healthcare professional. Provide accurate, evidence-based information and always clarify that the doctor should use their professional judgment.'
      }
    ],
    createdAt: new Date()
  };
}

// Get title for chat session based on first user message
export async function generateSessionTitle(message: string): Promise<string> {
  try {
    const response = await apiRequest('POST', '/api/ai/generate-title', { message });
    const data = await response.json();
    return data.title;
  } catch (error) {
    console.error('Error generating session title:', error);
    return 'New Conversation';
  }
}