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
あなたはプロの薬剤師アシスタントです。提供された薬（PTP包装シート、錠剤、パッケージなど）の画像を詳細に分析してください。
画像内のすべての文字（カタカナ、漢字、アルファベット、数字）を注意深く読み取り、正確な「薬品名」と、その薬の「一般的な用途・効能」を特定してください。
特に、ジェネリック医薬品のメーカー名（例：「SANIK」「サワイ」「トーワ」など）や「配合錠」などの表記も見逃さず、読み取れた最も正確なフルネームを \`name\` に記載してください。

必ず以下のJSON形式でのみ出力してください。マークダウンの\`\`\`json\`\`\`などの修飾は絶対に含めないでください。

{
  "name": "（薬の正確なフルネーム。メーカー名や「配合錠」などの記載があればそれも含む）",
  "usage": "（どんな症状の時に飲む薬か、誰にでもわかる簡潔な説明）"
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
