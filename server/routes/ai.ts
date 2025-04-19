import { Router, Request, Response } from "express";
import multer from "multer";
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import os from "os";

// Create OpenAI client
if (!process.env.OPENAI_API_KEY) {
  console.error("Warning: OPENAI_API_KEY environment variable is not set");
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    // Create temp directory for uploads if it doesn't exist
    const uploadDir = path.join(os.tmpdir(), 'medapp-uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    // Generate unique filenames
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Create router
export const aiRouter = Router();

// Audio transcription endpoint
aiRouter.post('/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    // Check if file was provided
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    // Transcribe the audio
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-1",
    });

    // Clean up the temporary file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting temporary file:', err);
    });

    res.json({ transcript: transcription.text });
  } catch (error) {
    console.error('Transcription error:', error);
    if (error instanceof Error) {
      // Check for common OpenAI API errors
      if (error.message.includes('API key')) {
        return res.status(500).json({ error: 'OpenAI API key error. Please contact your administrator.' });
      } else if (error.message.includes('Rate limit')) {
        return res.status(429).json({ error: 'OpenAI API rate limit exceeded. Please try again later.' });
      }
    }
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

// SOAP note generation endpoint
aiRouter.post('/generate-soap', async (req: Request, res: Response) => {
  try {
    const { transcript, patientInfo } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'No transcript provided' });
    }

    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a medical documentation assistant. Create a detailed SOAP note from a clinical transcript.
          Format it properly with Subjective, Objective, Assessment, and Plan sections.
          Include all relevant medical information from the transcript.
          Be concise but thorough.
          Patient information: ${JSON.stringify(patientInfo)}`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });
    
    res.json({ soap: response.choices[0].message.content });
  } catch (error) {
    console.error('SOAP note generation error:', error);
    if (error instanceof Error) {
      // Check for common OpenAI API errors
      if (error.message.includes('API key')) {
        return res.status(500).json({ error: 'OpenAI API key error. Please contact your administrator.' });
      } else if (error.message.includes('Rate limit')) {
        return res.status(429).json({ error: 'OpenAI API rate limit exceeded. Please try again later.' });
      } else if (error.message.includes('context length')) {
        return res.status(413).json({ error: 'Transcript is too long. Please upload a shorter consultation.' });
      }
    }
    res.status(500).json({ error: 'Failed to generate SOAP notes' });
  }
});