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
    const prediction = resp.inference.result.prediction;
    
    console.log(prediction)

 // 2. Access 'line_items' (Which is a ListField)
    const lineItemsField = prediction.fields.get("line_items");

    if (!lineItemsField) {
      throw new Error("No line_items found in response");
    }

    // 3. Access the items array (ListField.values)
    const objectItems = lineItemsField.values; 

    console.log(objectItems)
    const cleanItems = [];

    // 4. Loop over ObjectField items
    for (const item of objectItems) {
      // item is an ObjectField.
      // In the V4 SDK, ObjectField properties are stored in .fields (which is another Map)
      const subFields = item.fields;

      // 5. Get Sub-Fields
      const descField = subFields.get("description");
      const priceField = subFields.get("total_price");

      // 6. Extract Values
      // SimpleField usually has a .value property, or .content / .toString()
      const nameVal = descField ? (descField.value || descField.toString()) : "Item";
      
      // Price might be string or number, force float
      let priceVal = 0;
      if (priceField) {
         // If it's a SimpleField, .value should be the number
         priceVal = parseFloat(priceField.value || priceField.toString());
      }

      if (priceVal > 0) {
        cleanItems.push({
          name: nameVal.replace(/\n/g, " "),
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