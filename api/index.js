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
    const prediction = resp.inference.result.fields;

    console.log(prediction);
    const lineItemsField = prediction.getListField("line_items");

    console.log(lineItemsField);
    if (!lineItemsField) {
      throw new Error("No line_items found in response");
    }

    // 3. Access the items array (ListField.values)
    const objectItems = lineItemsField.objectItems

    console.log(objectItems)
    const cleanItems = [];

    for (const item of objectItems) {
      // Access the sub-map using simpleFields as you discovered
      const subFields = item.simpleFields;

      // Get fields
      const descField = subFields.get("description");
      const quantityField = subFields.get("quantity");
      const unitPriceField = subFields.get("unit_price");
      const totalPriceField = subFields.get("total_price");

      // Extract Name
      const nameVal = descField ? (descField.value || descField.toString()) : "Item";
      
      // Extract Quantity (Default to 1)
      let quantity = 1;
      if (quantityField && quantityField.value !== null) {
        quantity = parseFloat(quantityField.value);
      }

      // Determine Individual Price
      // Priority: Unit Price > (Total Price / Quantity) > Total Price
      let singlePrice = 0;

      if (unitPriceField && unitPriceField.value !== null) {
        singlePrice = parseFloat(unitPriceField.value);
      } else if (totalPriceField && totalPriceField.value !== null) {
        const total = parseFloat(totalPriceField.value);
        singlePrice = total / quantity;
      }

      // Push individual items based on quantity
      if (singlePrice > 0) {
        for (let i = 0; i < quantity; i++) {
          cleanItems.push({
            name: nameVal.replace(/\n/g, " "),
            price: singlePrice
          });
        }
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