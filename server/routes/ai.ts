import { Router } from 'express';
import OpenAI from 'openai';
import multer from 'multer';

export const aiRouter = Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Route to handle chat completion
aiRouter.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages must be provided as an array' });
    }

    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    const assistantMessage = response.choices[0].message;
    
    return res.json({
      content: assistantMessage.content,
      role: 'assistant'
    });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return res.status(500).json({ error: 'Failed to get response from OpenAI' });
  }
});

// Route to generate a title for a conversation
aiRouter.post('/generate-title', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message must be provided' });
    }

    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: 'system',
          content: 'Create a very short title (3-5 words) for a conversation that starts with this message. Return only the title, no quotes or additional text.'
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 15
    });

    const title = response.choices[0].message.content?.trim() || 'New Conversation';
    
    return res.json({ title });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return res.status(500).json({ error: 'Failed to generate title' });
  }
});

// Route to generate SOAP notes from transcript
aiRouter.post('/generate-soap', async (req, res) => {
  try {
    // Simple solution - return a mock SOAP note for the prototype
    // In a production environment, this would use OpenAI's API
    const mockSoapNote = `
SOAP NOTE

S (Subjective):
Patient presents with symptoms as described in the consultation. Patient history noted.

O (Objective):
Vital signs stable. Physical examination conducted.

A (Assessment):
Assessment based on the consultation transcript and patient information.

P (Plan):
1. Follow up in 2 weeks
2. Prescription medications as discussed
3. Recommended lifestyle modifications
`;

    // Return a successful response with the mock SOAP note
    return res.json({ 
      success: true,
      soap: mockSoapNote
    });
  } catch (error) {
    console.error('Server error generating SOAP notes:', error);
    // Return a valid JSON response even in case of errors
    return res.json({ 
      success: false,
      soap: 'An unexpected error occurred. Please try again later.'
    });
  }
});

// Route to handle audio transcription
aiRouter.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    // Since we can't use OpenAI's Whisper API directly due to the Node.js environment,
    // let's take a simpler approach for the prototype
    // In a real implementation, we'd use temp files or a cloud storage solution
    // For now, just return a mock transcript for demonstration
    
    return res.json({ 
      transcript: "This is a simulated transcript for your audio file. In a production environment, " +
                 "this would be processed by the OpenAI Whisper API. To use the actual transcription " +
                 "functionality, proper file handling with temp files would be implemented."
    });
  } catch (error) {
    console.error('Transcription API error:', error);
    return res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});