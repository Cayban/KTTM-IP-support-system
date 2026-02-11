import dotenv from "dotenv";
dotenv.config();

const testAPI = async () => {
  try {
    console.log("🔑 Testing API Key...");
    console.log("Key exists:", !!process.env.GEMINI_API_KEY);
    console.log("Key length:", process.env.GEMINI_API_KEY?.length);
    console.log(
      "Key starts with:",
      process.env.GEMINI_API_KEY?.substring(0, 6)
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say hello!" }] }],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Error:", data);
    } else {
      console.log("✅ Success!");
      console.log("Response:", data);
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
};

testAPI();
