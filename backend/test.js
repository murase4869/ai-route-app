// test.js
const API_KEY = "AIzaSyAutSs7pVDUNZHp4hwo449b4uJSaOjkgOc"; 

// 💡 generateContent（生成）ではなく、models（一覧取得）のURLに変更しました
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function checkAvailableModels() {
  console.log("この鍵で利用できるAIモデルをGoogleに問い合わせ中...");
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.models) {
      console.log("【成功！利用可能なモデル一覧】:");
      // generateContent が使えるモデルだけを絞り込んで表示
      const generateContentModels = data.models
        .filter(m => m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name);
      
      console.log(generateContentModels.join("\n"));
    } else {
      console.log("【結果】:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("【通信エラー】:", error);
  }
}

checkAvailableModels();