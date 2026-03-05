import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const imageFront = formData.get("imageFront") as File | null;
        const imageBack = formData.get("imageBack") as File | null;

        if (!imageFront || !imageBack) {
            return NextResponse.json(
                { error: "表面と裏面の両方の画像が必要です。" },
                { status: 400 }
            );
        }

        // Convert Files to Base64
        const bufferFront = await imageFront.arrayBuffer();
        const base64Front = Buffer.from(bufferFront).toString("base64");

        const bufferBack = await imageBack.arrayBuffer();
        const base64Back = Buffer.from(bufferBack).toString("base64");

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const prompt = `
あなたはプロの薬剤師アシスタントです。提供された薬の「表面」と「裏面」の２枚の画像を詳細に分析してください。
一方には薬品名や成分、もう一方にはジェネリックメーカー名（例：「SANIK」「サワイ」「トーワ」など）や「配合錠」、用量の記載がある場合が多いため、**両方の画像の情報を統合して**判断してください。

画像内のすべての文字（カタカナ、漢字、アルファベット、数字）を注意深く読み取り、正確な「薬品名」と、その薬の「一般的な用途・効能」を特定してください。
読み取れた最も正確なフルネームを \`name\` に記載してください。

必ず以下のJSON形式でのみ出力してください。マークダウンの\`\`\`json\`\`\`などの修飾は絶対に含めないでください。

{
  "name": "（薬の正確なフルネーム。メーカー名や「配合錠」などの記載が見つかればそれも含む）",
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
                                data: base64Front,
                                mimeType: imageFront.type,
                            }
                        },
                        {
                            inlineData: {
                                data: base64Back,
                                mimeType: imageBack.type,
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
