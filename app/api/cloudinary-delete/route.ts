/**
 * app/api/cloudinary-delete/route.ts
 *
 * Rota de API segura (servidor) para deletar arquivos do Cloudinary.
 * A API Secret fica APENAS no servidor — nunca é exposta ao navegador.
 * Chamada pelo cliente via fetch('/api/cloudinary-delete', { method: 'POST', ... })
 */
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Credenciais do Cloudinary não configuradas no servidor." },
        { status: 500 }
      );
    }

    // Se não for uma URL do Cloudinary, não há nada a fazer
    if (!url || !url.includes("cloudinary.com")) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Extrai resource_type e public_id da URL do Cloudinary
    // Formato: https://res.cloudinary.com/{cloud}/{resource_type}/upload/v{version}/{public_id}.{ext}
    const match = url.match(
      /cloudinary\.com\/[^\/]+\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+?)(\.[^.\/]+)?$/
    );

    if (!match) {
      return NextResponse.json(
        { error: "Não foi possível extrair o public_id da URL." },
        { status: 400 }
      );
    }

    const resourceType = match[1]; // 'image', 'video' ou 'raw'
    const publicId = match[2];     // public_id sem extensão
    const timestamp = Math.floor(Date.now() / 1000);

    // Gera a assinatura SHA-256 exigida pela API do Cloudinary para autenticar a deleção
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

    if (result.result !== "ok") {
      console.warn("Cloudinary destroy result:", result);
    }

    return NextResponse.json({ ok: result.result === "ok", details: result });
  } catch (error) {
    console.error("Erro na rota de deleção do Cloudinary:", error);
    return NextResponse.json(
      { error: "Erro interno ao deletar arquivo." },
      { status: 500 }
    );
  }
}
