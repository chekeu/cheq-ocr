const mindee = require("mindee");

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { image } = req.body;
    const apiKey = process.env.MINDEE_API_KEY;

    if (!image) throw new Error("No image provided");
    if (!apiKey) throw new Error("Missing MINDEE_API_KEY");

    // 2. Initialize Client
    // We use the standard Client, which supports V5 automatically
    const mindeeClient = new mindee.Client({ apiKey: apiKey });

    // 3. Prepare Buffer from Base64
    // Strip the "data:image/jpeg;base64," prefix if it exists
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const buffer = Buffer.from(base64Data, "base64");

    // 4. Load Document
    const inputSource = mindeeClient.docFromBuffer(buffer, "receipt.jpg");

    // 5. Parse using ReceiptV5 (Standard off-the-shelf model)
    // We use 'parse' (Synchronous) instead of 'enqueue' (Async) 
    // because Vercel functions have short timeouts.
    console.log("Sending to Mindee ReceiptV5...");
    
    const apiResponse = await mindeeClient.parse(
      mindee.product.ReceiptV5,
      inputSource
    );

    // 6. Extract Data
    // The SDK parses the JSON into a clean object for us
    const prediction = apiResponse.document.inference.prediction;
    const lineItems = prediction.lineItems || [];

    // Map to Cheq format
    const cleanItems = lineItems.map((item) => ({
      name: item.description || "Item",
      price: item.totalAmount || 0
    })).filter((i) => i.price > 0); // Remove zero-price noise

    // 7. Success
    console.log(`Found ${cleanItems.length} items`);
    res.status(200).json({ items: cleanItems });

  } catch (error) {
    console.error("OCR Error:", error);
    
    // Return specific error message to help debug
    res.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
};