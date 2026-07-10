// アバター/ワークスペースアイコン用の画像処理ヘルパー。
// アップロード画像はブラウザ側で正方形（既定 128px）に中央クロップ＆縮小してから
// data URI 化する。これでサーバに送るデータを小さく保つ（本文サイズ上限内に収める）。

export const AVATAR_SIZE = 128;

export function fileToSquareDataUrl(file: File, size = AVATAR_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("画像ファイルを選んでください。"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("画像処理に失敗しました。"));
          return;
        }
        // 透過画像は白背景で塗りつぶしてから描く（JPEG 化で黒くならないように）。
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// 表示名の頭文字（アバター/アイコンの画像未設定時のフォールバック）。
export function initialOf(label: string): string {
  const s = (label || "").trim();
  return s ? s[0].toUpperCase() : "?";
}
