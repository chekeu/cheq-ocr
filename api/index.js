const mindee = require("mindee");

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { image } = req.body;
    const apiKey = process.env.MINDEE_API_KEY;

    if (!image) throw new Error("No image provided");
    if (!apiKey) throw new Error("Missing MINDEE_API_KEY");

    // 2. Initialize Client
    const mindeeClient = new mindee.Client({ apiKey: apiKey });

    // 3. Prepare Buffer
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const buffer = Buffer.from(base64Data, "base64");

    // 4. Load Document
    const inputSource = mindeeClient.docFromBuffer(buffer, "receipt.jpg");

    console.log("Enqueueing job to Mindee...");
    
    // We use ReceiptV5 product class instead of a manual modelID string.
    // This ensures it hits the "Expense Receipt" API you have the key for.
    const response = await mindeeClient.enqueueAndGetInference(
      mindee.product.ReceiptV5, 
      inputSource,
      {
        maxRetries: 10
      }
    );

    // 6. Extract Data
    console.log("Job finished. Parsing results.");
    const prediction = response.document.inference.prediction;
    const lineItems = prediction.lineItems || [];

    const cleanItems = lineItems.map((item) => ({
      name: item.description || "Item",
      price: item.totalAmount || 0
    })).filter((i) => i.price > 0);

    // 7. Return JSON
    res.status(200).json({ items: cleanItems });

  } catch (error) {
    console.error("OCR Error:", error);
    res.status(500).json({ 
      error: error.message,
      // If it's a timeout, give a specific hint
      hint: error.message.includes("timed out") ? "Vercel function timed out waiting for OCR." : ""
    });
  }
};