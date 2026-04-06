/**
 * app/api/cloudinary-delete/route.ts
 *
 * Rota de API segura (servidor) para deletar arquivos do Cloudinary.
 * A API Secret fica APENAS no servidor — nunca é exposta ao navegador.
 * Chamada pelo cliente via fetch('/api/cloudinary-delete', { method: 'POST', ... })
 */
import { NextRequest, NextResponse } from "next/server";
import { deletarDoCloudinaryServidor } from "../../lib/cloudinaryServer";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    const result = await deletarDoCloudinaryServidor(url);
    
    if (result.error) {
      return NextResponse.json({ error: (result.error as any).message || "Erro interno ao deletar arquivo." }, { status: 500 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro na rota de deleção do Cloudinary:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar a deleção." },
      { status: 500 }
    );
  }
}
