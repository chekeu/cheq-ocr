const mindee = require("mindee");

module.exports = async (req, res) => {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { image } = req.body;
    
    // 2. Load Environment Variables
    const apiKey = process.env.MINDEE_API_KEY;
    const modelId = process.env.MINDEE_MODEL_ID; 

    if (!image) throw new Error("No image provided");
    if (!apiKey) throw new Error("Missing MINDEE_API_KEY");
    if (!modelId) throw new Error("Missing MINDEE_MODEL_ID");

    const mindeeClient = new mindee.ClientV2({ apiKey: apiKey });

    // 4. Prepare Buffer
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const buffer = Buffer.from(base64Data, "base64");

    const inputSource = new mindee.BufferInput({
      buffer: buffer,
      filename: "receipt.jpg",
    });

    console.log("Enqueueing job to Mindee...");

    // 5. Inference Parameters
    const inferenceParams = {
      modelId: modelId,
      rag: undefined,
      rawText: undefined,
      polygon: undefined,
      confidence: undefined,
    };

    // 6. Send & Await (Converted from .then to await for cleaner serverless execution)
    const resp = await mindeeClient.enqueueAndGetInference(
      inputSource,
      inferenceParams
    );

    console.log("Job finished. Parsing results.");
    
    // 7. Parsing Logic (Your custom logic)
    const prediction = resp.inference.result.fields;
    console.log(prediction);

    // Get List Field
    const lineItemsField = prediction.getListField("line_items");
    if (!lineItemsField) {
      throw new Error("No line_items found in response");
    }

    const objectItems = lineItemsField.objectItems;
    const cleanItems = [];

    // Loop items
    for (const item of objectItems) {
      const subFields = item.simpleFields;

      const descField = subFields.get("description");
      const quantityField = subFields.get("quantity");
      const unitPriceField = subFields.get("unit_price");
      const totalPriceField = subFields.get("total_price");

      const nameVal = descField ? (descField.value || descField.toString()) : "Item";
      
      let quantity = 1;
      if (quantityField && quantityField.value !== null) {
        quantity = parseFloat(quantityField.value);
      }

      let singlePrice = 0;
      if (unitPriceField && unitPriceField.value !== null) {
        singlePrice = parseFloat(unitPriceField.value);
      } else if (totalPriceField && totalPriceField.value !== null) {
        const total = parseFloat(totalPriceField.value);
        singlePrice = total / quantity;
      }

      // Unroll quantities
      if (singlePrice > 0) {
        for (let i = 0; i < quantity; i++) {
          cleanItems.push({
            name: nameVal.replace(/\n/g, " "),
            price: singlePrice
          });
        }
      }
    }

    // 8. Extract Metadata
    const getFloat = (key) => {
      const field = prediction.get(key);
      return (field && field.value !== null) ? parseFloat(field.value) : 0;
    };

    const getString = (key) => {
      const field = prediction.get(key);
      return (field && field.value) ? field.value.toString() : "";
    };

    const metadata = {
      store: getString("supplier_name"),
      date: getString("date"),
      time: getString("time"),
      total: getFloat("total_amount"),
      subtotal: getFloat("total_net"),
      tax: getFloat("total_tax"),
      tip: getFloat("tips_gratuity")
    };
    console.log(metadata);
    console.log(`Found ${cleanItems.length} items`);
    
    // Return with 'meta' key to match frontend expectation
    res.status(200).json({ 
      items: cleanItems, 
      meta: metadata 
    });

  } catch (error) {
    console.error("OCR Error:", error);
    res.status(500).json({ 
      error: error.message,
      hint: error.message.includes("timed out") ? "Vercel function timed out waiting for OCR." : ""
    });
  }
};