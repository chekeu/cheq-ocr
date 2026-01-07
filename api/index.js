const mindee = require("mindee");

// Initialize Mindee Client
const mindeeClient = new mindee.Client({ apiKey: process.env.MINDEE_API_KEY });

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { image } = req.body;
    if (!image) throw new Error("No image provided");

    // 2. Prepare the Image
    // Remove header if present (data:image/jpeg;base64,...)
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    
    // Convert to Buffer (Node.js native)
    const buffer = Buffer.from(base64Data, "base64");

    // 3. Load into Mindee
    const inputSource = mindeeClient.docFromBuffer(buffer, "receipt.jpg");

    // 4. Call API (Expense Receipt V5)
    console.log("Sending to Mindee...");
    const apiResponse = await mindeeClient.parse(
      mindee.product.ReceiptV5,
      inputSource
    );

    // 5. Parse Response
    const prediction = apiResponse.document.inference.prediction;
    const lineItems = prediction.lineItems || [];

    const cleanItems = lineItems.map((item) => ({
      name: item.description || "Item",
      price: item.totalAmount || 0
    })).filter((i) => i.price > 0);

    // 6. Return JSON
    res.status(200).json({ items: cleanItems });

  } catch (error) {
    console.error("OCR Error:", error);
    res.status(500).json({ error: error.message });
  }
};