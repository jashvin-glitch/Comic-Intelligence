import "dotenv/config";
import express from "express";
import multer from "multer";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      cb(null, true);
    } else {
      cb(new Error("PDF files only."));
    }
  }
});

app.use(express.static("."));

app.post("/api/convert", upload.single("pdf"), async (req, res) => {
  let uploadedFile;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Please upload a PDF."
      });
    }

    uploadedFile = await client.files.create({
      file: new File(
        [req.file.buffer],
        req.file.originalname,
        { type: "application/pdf" }
      ),
      purpose: "user_data"
    });

    const response = await client.responses.create({
      model: "gpt-5.5",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              file_id: uploadedFile.id
            },
            {
              type: "input_text",
              text: `
You are StudyComic AI.

Read the uploaded PDF carefully.

Create ONE COMPLETE educational comic-page illustration based ONLY on
the actual information in the PDF.

The comic should have:

- A clear title based on the PDF
- 5–8 comic panels
- A student character
- A teacher/expert character
- Natural speech bubbles
- Important definitions
- Important formulas
- Important examples
- Visual scenes that explain the concepts
- A final quick-revision panel

Style:
- Real comic-book page
- Colorful illustrations
- Strong black panel borders
- Speech balloons
- Expressive characters
- Educational but fun
- Professional composition
- Readable typography
- Not a chat interface
- Not a collection of plain text boxes

Do not invent information that isn't supported by the PDF.
Keep formulas and scientific symbols accurate.
Prioritize the most important study material.
              `
            }
          ]
        }
      ],
      tools: [
        {
          type: "image_generation",
          size: "1024x1536",
          quality: "medium",
          output_format: "png"
        }
      ]
    });

    const imageCall = response.output.find(
      item => item.type === "image_generation_call"
    );

    if (!imageCall || !imageCall.result) {
      throw new Error("No comic image was generated.");
    }

    res.json({
      success: true,
      image: `data:image/png;base64,${imageCall.result}`
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message || "Comic generation failed."
    });

  } finally {
    if (uploadedFile) {
      try {
        await client.files.delete(uploadedFile.id);
      } catch {}
    }
  }
});

app.listen(PORT, () => {
  console.log(`StudyComic running on port ${PORT}`);
});
