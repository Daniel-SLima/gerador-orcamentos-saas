/**
 * uploadCloudinary.ts
 * Funções para enviar e deletar arquivos no Cloudinary.
 */

/**
 * Envia um arquivo para o Cloudinary via upload unsigned (preset público).
 * Retorna a URL segura (HTTPS) do arquivo armazenado.
 */
export async function uploadParaCloudinary(arquivo: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Variáveis do Cloudinary não estão configuradas. Verifique o .env.local");
  }

  const formData = new FormData();
  formData.append("file", arquivo);
  formData.append("upload_preset", uploadPreset);

  try {
    const resposta = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.error?.message || "Erro ao fazer upload no Cloudinary");
    }

    // Retorna a URL segura (HTTPS) do arquivo armazenado
    return dados.secure_url as string;
  } catch (erro) {
    console.error("Erro no upload para o Cloudinary:", erro);
    throw erro;
  }
}

/**
 * Deleta um arquivo do Cloudinary chamando a rota de API segura do servidor.
 * Silenciosa em caso de falha — nunca bloqueia a operação principal.
 * A API Secret fica apenas no servidor (nunca exposta ao navegador).
 */
export async function deletarDoCloudinary(url: string): Promise<void> {
  if (!url || !url.includes("cloudinary.com")) return;

  try {
    const resposta = await fetch("/api/cloudinary-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!resposta.ok) {
      const erro = await resposta.json();
      console.warn("Falha ao deletar do Cloudinary:", erro);
    }
  } catch (erro) {
    // Silencioso: falha na deleção não deve impedir o fluxo principal
    console.error("Erro ao tentar deletar arquivo do Cloudinary:", erro);
  }
}
