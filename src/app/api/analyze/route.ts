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

        // 薬学知識を持つSystem Instructionの定義
        const systemInstruction = `
あなたは日本の調剤薬局で働く、極めて優秀な薬剤師アシスタントです。
以下の【薬学知識ベース】と【判定ルール】を厳密に適用して、画像から薬を特定してください。

【薬学知識ベース】
1. ジェネリック医薬品の命名規則:「成分名 ＋ 剤形 ＋ 規格 ＋ 『メーカー略称』」となることが多い。
   (例: アムロジピン錠5mg「トーワ」、ロキソプロフェンNa錠60mg「サワイ」)
2. 代表的なメーカー略称:
   - 「SANIK」= サノフィのジェネリック
   - 「サワイ」= 沢井製薬
   - 「トーワ」= 東和薬品
   - 「日医工」= 日医工
   - 「アメル」= 共和薬品
   - 「サンド」= サンド
   - 「YD」= 陽進堂
3. 配合錠によくあるパターン:
   - 「ブソフェキ配合錠」= ブデソニド ＋ フェキソフェナジン塩酸塩 の配合錠
   - その他、複数の成分が混ざっている場合は「〜配合錠」という表記になりやすい。
4. PTPシートの特徴:
   - 表面(膨らんでいる方)には「成分名」や「用量(mgなど)」が印字されやすい。
   - 裏面(銀色の方)には「製品名(フルネーム)」と「メーカー略称(SANIKなど)」が印字されやすい。

【判定ルール】
- 提供された「表面」と「裏面」の画像の両方のテキストを統合して判断すること。
- 断片的な文字情報から推測せず、上記知識ベースと照合して最も確からしいフルネームを組み立てること。
- ジェネリックや配合錠の表記があれば、省略せずに必ずフルの製品名として出力すること。
`;

        const prompt = `
画像内の文字（カタカナ、漢字、アルファベット、数字）を注意深く読み取り、あなたの持つ知識ベースと照らし合わせて、最終的な「薬品の正確なフルネーム」と「一般的な用途・効能」を特定してください。
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
                systemInstruction: systemInstruction,
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
