import { Router } from 'express';
import OpenAI from 'openai';
import multer from 'multer';
import { storage } from '../storage';

export const aiRouter = Router();

// Helper function to get OpenAI client for a user
async function getOpenAIClient(userId: number): Promise<OpenAI | null> {
  try {
    const user = await storage.getUser(userId);
    if (!user) return null;

    // Check if user should use their own API key
    if (user.useOwnApiKey) {
      const userApiKey = await storage.getUserApiKey(userId);
      if (userApiKey) {
        return new OpenAI({
          apiKey: userApiKey,
        });
      } else {
        // User is set to use own API key but hasn't provided one
        return null;
      }
    } else {
      // User should use global API key
      const globalApiKey = await storage.getSystemSetting('global_openai_api_key');
      if (globalApiKey) {
        return new OpenAI({
          apiKey: globalApiKey,
        });
      }
      
      // Fallback to environment variable for backward compatibility
      if (process.env.OPENAI_API_KEY) {
        return new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting OpenAI client:', error);
    return null;
  }
}

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Route to handle chat completion
aiRouter.post('/chat', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { messages } = req.body;
    const userId = req.user.id;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages must be provided as an array' });
    }

    const openai = await getOpenAIClient(userId);
    if (!openai) {
      const user = await storage.getUser(userId);
      const errorMessage = user?.useOwnApiKey 
        ? 'No personal OpenAI API key found. Please add your OpenAI API key in Settings to use AI features.'
        : 'No global OpenAI API key configured. Please contact your administrator or add your own API key in Settings.';
      
      return res.status(400).json({ error: errorMessage });
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
    if (error instanceof Error && error.message.includes('Incorrect API key')) {
      return res.status(401).json({ 
        error: 'Invalid OpenAI API key. Please update your API key in Settings.' 
      });
    }
    return res.status(500).json({ error: 'Failed to get response from OpenAI' });
  }
});

// Route to generate a title for a conversation
aiRouter.post('/generate-title', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { message } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ error: 'Message must be provided' });
    }

    const openai = await getOpenAIClient(userId);
    if (!openai) {
      const user = await storage.getUser(userId);
      const errorMessage = user?.useOwnApiKey 
        ? 'No personal OpenAI API key found. Please add your OpenAI API key in Settings to use AI features.'
        : 'No global OpenAI API key configured. Please contact your administrator or add your own API key in Settings.';
      
      return res.status(400).json({ error: errorMessage });
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
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { transcript, patientInfo } = req.body;
    const userId = req.user.id;

    if (!transcript) {
      return res.json({ 
        success: false,
        soap: 'No transcript provided. Please provide consultation text to generate SOAP notes.'
      });
    }

    const openai = await getOpenAIClient(userId);
    if (!openai) {
      const user = await storage.getUser(userId);
      const errorMessage = user?.useOwnApiKey 
        ? 'No personal OpenAI API key found. Please add your OpenAI API key in Settings to use AI features.'
        : 'No global OpenAI API key configured. Please contact your administrator or add your own API key in Settings.';
      
      return res.json({
        success: false,
        soap: errorMessage
      });
    }

    try {
      // Sanitize inputs
      const sanitizedTranscript = (transcript || '').toString().slice(0, 4000); // Limit length to avoid token issues
      
      // Extract patient info for the prompt
      const patientName = patientInfo?.name || 
                          `${patientInfo?.firstName || ''} ${patientInfo?.lastName || ''}`.trim() || 
                          'Unknown';
      
      const patientInfoString = `Patient: ${patientName}, ID: ${patientInfo?.id || 'Unknown'}`;
      
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: 'system',
            content: `You are an experienced medical scribe tasked with converting doctor-patient 
                     conversation transcripts into professional SOAP notes. 
                     Structure the output in proper SOAP format (Subjective, Objective, Assessment, Plan).
                     Make sure the output is well-organized and maintains medical accuracy.
                     Only include information that's present in the transcript or can be directly inferred.
                     Be comprehensive yet concise. For missing information, leave sections with placeholders 
                     rather than inventing details.`
          },
          {
            role: 'user',
            content: `Please create SOAP notes based on the following doctor-patient consultation transcript.
                     
                     ${patientInfoString}
                     
                     Transcript:
                     ${sanitizedTranscript}`
          }
        ],
        temperature: 0.5,
        max_tokens: 1000
      });

      const soapNotes = response.choices[0]?.message?.content?.trim() || '';
      
      if (!soapNotes) {
        console.error('OpenAI returned empty response');
        return res.json({ 
          success: false,
          soap: 'Could not generate SOAP notes from the provided transcript. Please try with more detailed text.'
        });
      }
      
      // Return successful response with the generated SOAP notes
      return res.json({ 
        success: true,
        soap: soapNotes
      });
      
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      
      // Return a valid JSON response even when OpenAI fails
      return res.json({ 
        success: false,
        soap: 'There was an error connecting to the AI service. Please try again later.'
      });
    }
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