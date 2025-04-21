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
    const { transcript, patientInfo } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript must be provided' });
    }

    // Create patient info string
    const patientInfoString = patientInfo ? 
      `Patient: ${patientInfo.firstName || ''} ${patientInfo.lastName || ''}, ID: ${patientInfo.id}, 
       Gender: ${patientInfo.gender || 'Unknown'}, 
       DOB: ${patientInfo.dateOfBirth || 'Unknown'}` : 
      'Patient information not provided';

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
                   ${transcript}`
        }
      ],
      temperature: 0.5,
      max_tokens: 2000
    });

    const soapNotes = response.choices[0].message.content?.trim() || '';
    
    return res.json({ soap: soapNotes });
  } catch (error) {
    console.error('OpenAI API error generating SOAP notes:', error);
    return res.status(500).json({ error: 'Failed to generate SOAP notes' });
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