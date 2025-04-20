import { spawn } from "child_process";
import fs from "fs";
import OpenAI from "openai";
import path from "path";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Transcribes an audio file using OpenAI's Whisper model
 * @param audioFilePath Path to the audio file
 * @returns The transcription text
 */
export async function transcribeAudio(audioFilePath: string): Promise<string> {
  try {
    console.log(`Starting transcription for file: ${audioFilePath}`);
    
    // Check if file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`File not found: ${audioFilePath}`);
    }
    
    // Get file size for logging
    const stats = fs.statSync(audioFilePath);
    console.log(`File size: ${stats.size} bytes`);
    
    // Create a read stream for the file
    const audioStream = fs.createReadStream(audioFilePath);
    
    // Request transcription from OpenAI
    console.log('Sending file to OpenAI for transcription...');
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
      language: "en", // Specify English language
      response_format: "text", // Get plain text response
    });
    
    console.log('Transcription completed');
    return transcription;
    
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return "Transcription failed. " + (error instanceof Error ? error.message : String(error));
  }
}

/**
 * Converts WebM to MP3 format using FFmpeg
 * @param inputPath Path to the WebM file
 * @returns Path to the converted MP3 file
 */
export async function convertWebmToMp3(inputPath: string): Promise<string> {
  // Output file path (MP3 file)
  const outputPath = inputPath.replace(/\.[^/.]+$/, '.mp3');
  
  console.log('Starting FFmpeg conversion process');
  console.log('Input path:', inputPath);
  console.log('Output path:', outputPath);
  
  // Use ffmpeg to convert WebM to MP3
  const ffmpegArgs = [
    '-i', inputPath,
    '-vn', // No video
    '-ar', '44100', // Audio sampling rate
    '-ac', '2', // Stereo
    '-b:a', '128k', // Bitrate
    outputPath
  ];
  
  console.log('FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));
  const ffmpeg = spawn('ffmpeg', ffmpegArgs);
  
  // Handle ffmpeg process completion
  await new Promise<void>((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg process exited with code ${code}`));
      }
    });
    
    ffmpeg.stderr.on('data', (data) => {
      console.log(`ffmpeg: ${data}`);
    });
  });
  
  console.log('Conversion completed successfully');
  return outputPath;
}