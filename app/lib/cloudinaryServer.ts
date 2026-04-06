import { createHash } from "crypto";

export async function deletarDoCloudinaryServidor(url: string | null) {
  if (!url || !url.includes("cloudinary.com")) return { ok: true, skipped: true };

  try {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("Credenciais do Cloudinary não configuradas no servidor.");
    }

    const match = url.match(
      /cloudinary\.com\/[^\/]+\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+?)(\.[^.\/]+)?$/
    );

    if (!match) {
      throw new Error("Não foi possível extrair o public_id da URL.");
    }

    const resourceType = match[1];
    const publicId = match[2];
    const timestamp = Math.floor(Date.now() / 1000);

    const signatureString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = createHash("sha256").update(signatureString).digest("hex");

    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp.toString());
    formData.append("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
      { method: "POST", body: formData }
    );

    const result = await response.json();
    return { ok: result.result === "ok", details: result };
  } catch (error) {
    console.error("Erro interno ao deletar do Cloudinary:", error);
    return { ok: false, error };
  }
}
