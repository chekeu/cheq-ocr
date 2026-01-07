const mindee = require("mindee");
const modelId = "a1bf935b-a4ad-463b-a491-5fa26b99a9de";

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { image } = req.body;
    const apiKey = process.env.MINDEE_API_KEY;
    
    // Init a new client
    const mindeeClient = new mindee.ClientV2({ apiKey: apiKey });
    if (!image) throw new Error("No image provided");
    if (!apiKey) throw new Error("Missing MINDEE_API_KEY");


    console.log("Enqueueing job to Mindee...");
    
   
// Set inference parameters
const inferenceParams = {
  // ID of the model, required.
  modelId: modelId,

  // Options: set to `true` or `false` to override defaults

  // Enhance extraction accuracy with Retrieval-Augmented Generation.
  rag: undefined,
  // Extract the full text content from the document as strings.
  rawText: undefined,
  // Calculate bounding box polygons for all fields.
  polygon: undefined,
  // Boost the precision and accuracy of all extractions.
  // Calculate confidence scores for all fields.
  confidence: undefined,
};

const inputSource = new mindee.PathInput({ inputPath: image });

// Send for processing
const response = mindeeClient.enqueueAndGetInference(
  inputSource,
  inferenceParams
);

// Handle the response Promise
response.then((resp) => {
  // print a string summary
  console.log(resp.inference.toString());
  
  // Access the result fields
  const fields = response.inference.result.fields;
  console.log(fields);
});

  } catch (error) {
    console.error("OCR Error:", error);
    res.status(500).json({ 
      error: error.message,
      // If it's a timeout, give a specific hint
      hint: error.message.includes("timed out") ? "Vercel function timed out waiting for OCR." : ""
    });
  }
};