/**
 * Comprime e converte uma imagem para WebP usando o Canvas do browser.
 * - Redimensiona proporcionalmente para no maximo `maxDim` pixels (largura ou altura)
 * - Converte para WebP com qualidade `quality` (0 a 1)
 * - Retorna um File com nome terminado em .webp
 * - Preenche o fundo com branco para evitar transparencia preta
 */
export async function comprimirImagem(
  arquivo: File,
  maxDim = 800,
  quality = 0.82
): Promise<File> {
  // Se nao for imagem, retorna o arquivo original sem alterar
  if (!arquivo.type.startsWith("image/")) return arquivo;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(arquivo);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calcula as novas dimensoes mantendo o aspect ratio
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
      if (!ctx) return reject(new Error("Canvas context nao disponivel"));

      // Preenche o fundo com branco para evitar PNGs transparentes pretos
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Falha ao converter imagem"));

          // Troca a extensao para .webp
          const nomeBase = arquivo.name.replace(/\.[^/.]+$/, "");
          const novoArquivo = new File([blob], `${nomeBase}.webp`, {
            type: "image/webp",
            lastModified: Date.now(),
          });

          resolve(novoArquivo);
        },
        "image/webp", // Converte direto para WebP (25-35% menor que JPEG)
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Em caso de erro, retorna o arquivo original
      resolve(arquivo);
    };

    img.src = objectUrl;
  });
}
