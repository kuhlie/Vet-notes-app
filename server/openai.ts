import OpenAI from "openai";
import fs from "fs";
import { execSync } from "child_process";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export async function transcribeAudio(audioFilePath: string): Promise<{ text: string }> {
  try {
    // First, let's try to convert the audio to a reliable format using ffmpeg
    const mp3FilePath = audioFilePath.replace(/\.[^/.]+$/, ".mp3");
    
    let fileToUse = audioFilePath;
    let conversionSuccessful = false;
    
    try {
      // Use more robust ffmpeg conversion with error handling
      execSync(`ffmpeg -y -i "${audioFilePath}" -ar 16000 -ac 1 -c:a libmp3lame -b:a 64k "${mp3FilePath}"`, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000 // 30 second timeout
      });
      
      if (fs.existsSync(mp3FilePath) && fs.statSync(mp3FilePath).size > 0) {
        fileToUse = mp3FilePath;
        conversionSuccessful = true;
        console.log("Successfully converted audio to MP3");
      }
    } catch (ffmpegError) {
      console.log("FFmpeg conversion failed, will try alternative approach:", (ffmpegError as Error).message);
      
      // Try a different conversion approach for WebM files
      try {
        execSync(`ffmpeg -y -f webm -i "${audioFilePath}" -ar 16000 -ac 1 -f wav "${audioFilePath}.wav"`, { 
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000
        });
        
        if (fs.existsSync(audioFilePath + '.wav') && fs.statSync(audioFilePath + '.wav').size > 0) {
          fileToUse = audioFilePath + '.wav';
          conversionSuccessful = true;
          console.log("Successfully converted WebM to WAV");
        }
      } catch (wavError) {
        console.log("WAV conversion also failed:", (wavError as Error).message);
      }
    }

    // Verify the file exists and has content
    if (!fs.existsSync(fileToUse) || fs.statSync(fileToUse).size === 0) {
      throw new Error("Audio file is empty or corrupted");
    }

    console.log(`Using file for transcription: ${fileToUse}, size: ${fs.statSync(fileToUse).size} bytes`);

    const audioReadStream = fs.createReadStream(fileToUse);

    const transcription = await openai.audio.transcriptions.create({
      file: audioReadStream,
      model: "whisper-1",
    });

    // Clean up converted files
    if (conversionSuccessful) {
      if (fs.existsSync(mp3FilePath)) fs.unlinkSync(mp3FilePath);
      if (fs.existsSync(audioFilePath + '.wav')) fs.unlinkSync(audioFilePath + '.wav');
    }

    return {
      text: transcription.text,
    };
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error("Failed to transcribe audio: " + (error as Error).message);
  }
}

export async function generateSoapNote(fullTranscription: string): Promise<{
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}> {
  try {
    const prompt = `
You are a veterinary clinical assistant. Analyze the following consultation transcription and extract only clinically relevant information. Exclude chit-chat and non-medical conversation.

Please provide a SOAP note in JSON format with the following fields:
- subjective: History, owner-reported concerns, symptoms, timeline
- objective: Physical exam findings, vitals, diagnostics, measurable observations
- assessment: Differential diagnoses or assessment
- plan: Treatment plan, medications, follow-up, client instructions

If a section is not mentioned in the transcript, use "Not mentioned".

Transcription:
${fullTranscription}

Respond with only the JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a veterinary clinical assistant that extracts structured clinical information from consultation transcriptions.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      subjective: result.subjective || "Not mentioned",
      objective: result.objective || "Not mentioned",
      assessment: result.assessment || "Not mentioned",
      plan: result.plan || "Not mentioned",
    };
  } catch (error) {
    console.error("Error generating SOAP note:", error);
    throw new Error("Failed to generate SOAP note: " + (error as Error).message);
  }
}
