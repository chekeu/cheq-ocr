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

    // 3. Prepare Buffer
    // We strip the header "data:image/jpeg;base64," to get the raw string
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    // Create a native Node.js Buffer
    const buffer = Buffer.from(base64Data, "base64");

    const inputSource = new mindee.BufferInput({
      buffer: buffer,
      filename: "receipt.jpg", // Filename is required but can be arbitrary
    });

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

// Send for processing
const response = mindeeClient.enqueueAndGetInference(
  inputSource,
  inferenceParams
);

// Handle the response Promise
response.then((resp) => {
  console.log("Job finished. Parsing results.");
  console.log(resp.inference.toString());

    // The structure is: response -> document -> inference -> prediction
    const prediction = resp.inference.result;
    
    console.log(prediction)

    // Access the generic map of fields
    const fields = prediction.fields; 

    console.log(fields);
    // Based on your logs, the list is named "line_items"
    const lineItemsField = fields.get("line_items");
    
    // In GeneratedV1, lists are accessed via .values
    const objectItems = lineItemsField.values; 

    const cleanItems = [];

    // Loop over the list of Object fields (Rows)
    for (const itemField of objectItems) {
      // itemField is a Map of sub-fields. 
      // Based on your logs, the sub-fields are "description" and "total_price"
      
      const descObj = itemField.get("description");
      const priceObj = itemField.get("total_price");

      // Extract raw values
      // Note: GeneratedV1 returns objects, we use .toString() or .content
      const nameVal = descObj ? descObj.toString() : "Item";
      const priceVal = priceObj ? parseFloat(priceObj.toString()) : 0;

      if (priceVal > 0) {
        cleanItems.push({
          name: nameVal.replace(/\n/g, " "), // Clean up newlines
          price: priceVal
        });
      }
    }

    console.log(`Found ${cleanItems.length} items`);
    res.status(200).json({ items: cleanItems });

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