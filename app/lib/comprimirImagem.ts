/**
 * Comprime e converte uma imagem para WebP usando o Canvas do browser.
 * - Redimensiona proporcionalmente para no máximo `maxDim` pixels (largura ou altura)
 * - Converte para WebP com qualidade `quality` (0 a 1)
 * - Retorna um File com nome terminando em .webp
 *
 * Funciona somente no browser (usa Canvas API).
 */
export async function comprimirImagem(
  arquivo: File,
  maxDim = 800,
  quality = 0.85
): Promise<File> {
  // Se não for imagem, retorna o arquivo original sem alterar
  if (!arquivo.type.startsWith("image/")) return arquivo;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(arquivo);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calcula as novas dimensões mantendo o aspect ratio
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context não disponível"));

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Falha ao converter imagem"));

          // Troca extensão original por .webp no nome do arquivo
          const nomeBase = arquivo.name.replace(/\.[^/.]+$/, "");
          const novoArquivo = new File([blob], `${nomeBase}.webp`, {
            type: "image/webp",
            lastModified: Date.now(),
          });

          resolve(novoArquivo);
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Em caso de erro de carregamento, usa o arquivo original
      resolve(arquivo);
    };

    img.src = objectUrl;
  });
}
