import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { transcribeAudio, generateSoapNote } from "./openai";
import multer from "multer";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { insertConsultationSchema, insertCustomerSchema } from "@shared/schema";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

// Setup multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

const consultationUpdateSchema = insertConsultationSchema.pick({
  finalSoapNote: true,
  isFinalized: true,
});

function getAudioContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".ogg":
      return "audio/ogg";
    case ".webm":
      return "audio/webm";
    case ".m4a":
      return "audio/mp4";
    default:
      return "application/octet-stream";
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Consultation routes
  app.post("/api/consultations", isAuthenticated, upload.single('audio'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { customerName, customerId } = req.body;
      
      if (!customerName && !customerId) {
        return res.status(400).json({ message: "Customer name or ID is required" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Audio file is required" });
      }

      const customerRecord = customerId
        ? await storage.getCustomer(parseInt(customerId), userId)
        : undefined;
      if (customerId && !customerRecord) {
        return res.status(404).json({ message: "Patient not found" });
      }
      const clientName = customerRecord?.name || customerName;
      const patientId = customerRecord?.patientId || "unknown";
      const petName = customerRecord?.petName || "patient";
      const now = new Date();
      const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const timeStamp = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const fileName = `${patientId}_${petName}_${dateStamp}_${timeStamp}`.replace(/[^a-zA-Z0-9_]/g, "_");

      // Determine file extension based on original filename or content type
      const originalName = req.file.originalname || 'recording.webm';
      const extension = path.extname(originalName) || '.webm';
      const originalPath = req.file.path;
      const newPath = originalPath + extension;
      fs.renameSync(originalPath, newPath);

      // Create consultation record - handle both new customer system and legacy
      const consultation = await storage.createConsultation({
        userId,
        customerId: customerId ? parseInt(customerId) : undefined,
        customerName: clientName,
        patientId,
        petName,
        fileName,
        audioUrl: newPath,
        status: "processing",
      });

      // Process transcription in background
      processTranscription(consultation.id, newPath);

      res.json(consultation);
    } catch (error) {
      console.error("Error creating consultation:", error);
      res.status(500).json({ message: "Failed to create consultation" });
    }
  });

  // Customer routes
  app.get('/api/customers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const customers = await storage.getUserCustomers(userId);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.post('/api/customers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const customerData = insertCustomerSchema.parse({ ...req.body, userId });
      const customer = await storage.createCustomer(customerData);
      res.json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  app.get('/api/customers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const customerId = parseInt(req.params.id);
      const customer = await storage.getCustomer(customerId, userId);
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.get('/api/customers/:id/consultations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const customerId = parseInt(req.params.id);
      const consultations = await storage.getCustomerConsultations(customerId, userId);
      res.json(consultations);
    } catch (error) {
      console.error("Error fetching customer consultations:", error);
      res.status(500).json({ message: "Failed to fetch customer consultations" });
    }
  });

  app.put('/api/customers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const customerId = parseInt(req.params.id);
      const updates = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(customerId, updates);
      res.json(customer);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  app.delete('/api/customers/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const customerId = parseInt(req.params.id);
      await storage.deleteCustomer(customerId, userId);
      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  app.get("/api/consultations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const consultations = await storage.getUserConsultations(userId);
      res.json(consultations);
    } catch (error) {
      console.error("Error fetching consultations:", error);
      res.status(500).json({ message: "Failed to fetch consultations" });
    }
  });

  app.get("/api/consultations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const consultationId = parseInt(req.params.id);
      const consultation = await storage.getConsultation(consultationId, userId);
      
      if (!consultation) {
        return res.status(404).json({ message: "Consultation not found" });
      }

      res.json(consultation);
    } catch (error) {
      console.error("Error fetching consultation:", error);
      res.status(500).json({ message: "Failed to fetch consultation" });
    }
  });

  app.get("/api/consultations/:id/audio", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const consultationId = parseInt(req.params.id);
      const consultation = await storage.getConsultation(consultationId, userId);

      if (!consultation || !consultation.audioUrl) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      const audioPath = consultation.audioUrl;
      if (!fs.existsSync(audioPath)) {
        return res.status(404).json({ message: "Audio file not found on disk" });
      }

      const isMP3 = audioPath.toLowerCase().endsWith(".mp3");
      const baseName =
        consultation.fileName?.replace(/[^a-zA-Z0-9_]/g, "_") ||
        `consultation_${consultationId}`;
      const mp3OutputPath = audioPath.replace(/\.[^/.]+$/, ".mp3");
      const mp3FileName = `${baseName}.mp3`;

      if (isMP3 || fs.existsSync(mp3OutputPath)) {
        const streamPath = isMP3 ? audioPath : mp3OutputPath;
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Disposition", `inline; filename="${mp3FileName}"`);
        return fs.createReadStream(streamPath).pipe(res);
      }

      try {
        const ffmpeg = spawn("ffmpeg", [
          "-i",
          audioPath,
          "-codec:a",
          "libmp3lame",
          "-b:a",
          "128k",
          "-f",
          "mp3",
          mp3OutputPath,
        ]);

        ffmpeg.on("close", (code: number) => {
          if (code === 0 && fs.existsSync(mp3OutputPath)) {
            res.setHeader("Content-Type", "audio/mpeg");
            res.setHeader("Content-Disposition", `inline; filename="${mp3FileName}"`);
            return fs.createReadStream(mp3OutputPath).pipe(res);
          }
          res.setHeader("Content-Type", getAudioContentType(audioPath));
          res.setHeader("Content-Disposition", "inline");
          return fs.createReadStream(audioPath).pipe(res);
        });

        ffmpeg.on("error", (err: Error) => {
          console.error("FFmpeg error:", err);
          res.setHeader("Content-Type", getAudioContentType(audioPath));
          res.setHeader("Content-Disposition", "inline");
          return fs.createReadStream(audioPath).pipe(res);
        });
      } catch (error) {
        console.error("Error spawning ffmpeg:", error);
        res.setHeader("Content-Type", getAudioContentType(audioPath));
        res.setHeader("Content-Disposition", "inline");
        return fs.createReadStream(audioPath).pipe(res);
      }
    } catch (error) {
      console.error("Error streaming audio:", error);
      res.status(500).json({ message: "Failed to stream audio" });
    }
  });

  app.put("/api/consultations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const consultationId = parseInt(req.params.id);
      const consultation = await storage.getConsultation(consultationId, userId);
      if (!consultation) {
        return res.status(404).json({ message: "Consultation not found" });
      }

      const updates = consultationUpdateSchema.partial().parse(req.body);
      const updatedConsultation = await storage.updateConsultation(consultationId, updates);
      res.json(updatedConsultation);
    } catch (error) {
      console.error("Error updating consultation:", error);
      res.status(500).json({ message: "Failed to update consultation" });
    }
  });

  app.get("/api/consultations/:id/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const consultationId = parseInt(req.params.id);
      const type = req.query.type === "soap" ? "soap" : "transcript";
      const source = req.query.source === "ai" ? "ai" : "final";

      const consultation = await storage.getConsultation(consultationId, userId);
      if (!consultation) {
        return res.status(404).json({ message: "Consultation not found" });
      }

      const isTranscript = type === "transcript";
      const title = isTranscript ? "Full Transcript" : "SOAP Note";
      const bodyText = isTranscript
        ? consultation.fullTranscription || ""
        : source === "ai"
          ? consultation.aiSoapNote || ""
          : consultation.finalSoapNote || consultation.aiSoapNote || "";

      const doc = buildDocxDocument({
        title,
        consultation,
        bodyText,
      });
      const buffer = await Packer.toBuffer(doc);

      const baseName = consultation.fileName || `consultation_${consultationId}`;
      const suffix = isTranscript ? "transcript" : "soap_note";
      const fileName = `${baseName}_${suffix}.docx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      console.error("Error exporting consultation:", error);
      res.status(500).json({ message: "Failed to export consultation" });
    }
  });

  app.get("/api/consultations/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const consultationId = parseInt(req.params.id);
      
      const consultation = await storage.getConsultation(consultationId, userId);
      if (!consultation || !consultation.audioUrl) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      const audioPath = consultation.audioUrl;
      if (!fs.existsSync(audioPath)) {
        return res.status(404).json({ message: "Audio file not found on disk" });
      }

      // Check if file is already MP3
      const isMP3 = audioPath.toLowerCase().endsWith('.mp3');
      const baseName = consultation.fileName?.replace(/[^a-zA-Z0-9_]/g, '_') || `consultation_${consultationId}`;
      const mp3FileName = `${baseName}.mp3`;

      if (isMP3) {
        // Serve existing MP3 file directly
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${mp3FileName}"`);
        fs.createReadStream(audioPath).pipe(res);
      } else {
        // Convert to MP3 and serve
        const mp3OutputPath = audioPath.replace(/\.[^/.]+$/, '.mp3');
        
        // Check if converted MP3 already exists
        if (fs.existsSync(mp3OutputPath)) {
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Content-Disposition', `attachment; filename="${mp3FileName}"`);
          fs.createReadStream(mp3OutputPath).pipe(res);
        } else {
          // Convert to MP3 using ffmpeg
          try {
            const ffmpeg = spawn('ffmpeg', [
              '-i', audioPath,
              '-codec:a', 'libmp3lame',
              '-b:a', '128k',
              '-f', 'mp3',
              mp3OutputPath
            ]);

            let errorOutput = '';
            
            ffmpeg.stderr.on('data', (data) => {
              errorOutput += data.toString();
            });

            ffmpeg.on('close', (code: number) => {
              if (code === 0 && fs.existsSync(mp3OutputPath)) {
                res.setHeader('Content-Type', 'audio/mpeg');
                res.setHeader('Content-Disposition', `attachment; filename="${mp3FileName}"`);
                fs.createReadStream(mp3OutputPath).pipe(res);
              } else {
                console.error("FFmpeg conversion failed:", errorOutput);
                res.setHeader("Content-Type", getAudioContentType(audioPath));
                res.setHeader(
                  "Content-Disposition",
                  `attachment; filename="${path.basename(audioPath)}"`
                );
                fs.createReadStream(audioPath).pipe(res);
              }
            });

            ffmpeg.on('error', (err: Error) => {
              console.error("FFmpeg error:", err);
              res.setHeader("Content-Type", getAudioContentType(audioPath));
              res.setHeader(
                "Content-Disposition",
                `attachment; filename="${path.basename(audioPath)}"`
              );
              fs.createReadStream(audioPath).pipe(res);
            });
          } catch (err) {
            console.error("Error spawning ffmpeg:", err);
            res.setHeader("Content-Type", getAudioContentType(audioPath));
            res.setHeader(
              "Content-Disposition",
              `attachment; filename="${path.basename(audioPath)}"`
            );
            fs.createReadStream(audioPath).pipe(res);
          }
        }
      }
    } catch (error) {
      console.error("Error downloading audio:", error);
      res.status(500).json({ message: "Failed to download audio" });
    }
  });

  app.delete("/api/consultations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const consultationId = parseInt(req.params.id);
      
      // Get consultation to find audio file
      const consultation = await storage.getConsultation(consultationId, userId);
      if (consultation && consultation.audioUrl) {
        // Delete audio file
        try {
          fs.unlinkSync(consultation.audioUrl);
          // Also delete converted MP3 if it exists
          const mp3Path = consultation.audioUrl.replace(/\.[^/.]+$/, '.mp3');
          if (fs.existsSync(mp3Path)) {
            fs.unlinkSync(mp3Path);
          }
        } catch (err) {
          console.warn("Could not delete audio file:", err);
        }
      }

      await storage.deleteConsultation(consultationId, userId);
      res.json({ message: "Consultation deleted successfully" });
    } catch (error) {
      console.error("Error deleting consultation:", error);
      res.status(500).json({ message: "Failed to delete consultation" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function processTranscription(consultationId: number, audioFilePath: string) {
  try {
    // Transcribe audio
    const { text } = await transcribeAudio(audioFilePath);
    
    // Generate SOAP note
    const soapNote = await generateSoapNote(text);
    const formattedSoap = `Subjective:\n${soapNote.subjective}\n\nObjective:\n${soapNote.objective}\n\nAssessment:\n${soapNote.assessment}\n\nPlan:\n${soapNote.plan}`;

    // Update consultation with results
    await storage.updateConsultation(consultationId, {
      fullTranscription: text,
      aiSoapNote: formattedSoap,
      finalSoapNote: formattedSoap,
      status: "completed",
    });

    console.log(`Transcription completed for consultation ${consultationId}`);
  } catch (error) {
    console.error(`Error processing transcription for consultation ${consultationId}:`, error);
    
    // Update consultation with error status
    await storage.updateConsultation(consultationId, {
      status: "failed",
    });
  }
}

function buildDocxDocument({
  title,
  consultation,
  bodyText,
}: {
  title: string;
  consultation: any;
  bodyText: string;
}) {
  const headerLines = [
    `Patient ID: ${consultation.patientId || "Unknown"}`,
    `Pet Name: ${consultation.petName || "Unknown"}`,
    `Client Name: ${consultation.customerName || "Unknown"}`,
    `Visit Date: ${consultation.recordedAt ? new Date(consultation.recordedAt).toLocaleString() : "Unknown"}`,
  ];

  const paragraphs = [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
    ...headerLines.map((line) => new Paragraph({ text: line })),
    new Paragraph({ text: "" }),
    ...bodyText.split("\n").map((line) => new Paragraph({ children: [new TextRun(line)] })),
  ];

  return new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });
}
