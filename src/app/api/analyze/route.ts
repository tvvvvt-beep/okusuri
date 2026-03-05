import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const imageFile = formData.get("image") as File;

        if (!imageFile) {
            return NextResponse.json(
                { error: "画像がアップロードされていません。" },
                { status: 400 }
            );
        }

        // Convert File to Base64
        const buffer = await imageFile.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString("base64");

        // Initialize Gemini SDK
        // Assumes process.env.GEMINI_API_KEY is set
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const prompt = `
これは薬の写真です。以下の情報を一発でわかるように簡潔に教えてください。
必ず以下のJSON形式でのみ出力してください。マークダウンの\`\`\`json\`\`\`などの修飾は不要です。

{
  "name": "（薬の名前）",
  "usage": "（どんな時に飲む薬か、簡潔な説明）"
}
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                data: base64Data,
                                mimeType: imageFile.type,
                            }
                        }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
            }
        });

        const resultText = response.text || "";
        let resultJson;
        try {
            resultJson = JSON.parse(resultText);
        } catch (_) {
            console.error("Failed to parse JSON:", resultText);
            throw new Error("AIからの応答の解析に失敗しました。");
        }

        return NextResponse.json(resultJson);
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json(
            { error: "画像の解析中にエラーが発生しました。" },
            { status: 500 }
        );
    }
}
