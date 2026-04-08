/**
 * app/api/cloudinary-check/route.ts
 *
 * Rota de API segura para verificar se um arquivo no Cloudinary ainda existe.
 * Usada para marcar anexos como "perdidos" após o período de expiração automática.
 * C06 — Validação de URL com regex estrita para prevenir SSRF.
 */
import { NextRequest, NextResponse } from "next/server";

// C06 — Regex estrita: apenas URLs reais do Cloudinary são aceitas
const CLOUDINARY_URL_REGEX = /^https:\/\/res\.cloudinary\.com\//;

export async function POST(req: NextRequest) {
  try {
    const { urls } = await req.json();

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ results: {} });
    }

    // Verifica cada URL com HEAD request — retorna um mapa { url: boolean }
    const checks = await Promise.all(
      urls.map(async (url: string) => {
        // C06 — Aceita apenas URLs com o prefixo exato do Cloudinary (previne SSRF)
        if (!url || !CLOUDINARY_URL_REGEX.test(url)) {
          return { url, exists: true }; // URLs não-Cloudinary assumimos válidas
        }
        try {
          const resp = await fetch(url, { method: "HEAD" });
          return { url, exists: resp.ok };
        } catch {
          return { url, exists: false };
        }
      })
    );

    const results: Record<string, boolean> = {};
    for (const check of checks) {
      results[check.url] = check.exists;
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Erro na rota de verificação do Cloudinary:", error);
    return NextResponse.json({ results: {} }, { status: 500 });
  }
}
