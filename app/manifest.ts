import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SANE | Sistema de Orçamentos',
    short_name: 'SANE',
    description: 'Sistema profissional de orçamentos e gestão.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/Logo_Sane_512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable', // <-- O TypeScript agora vai ficar feliz com essa linha!
      },
    ],
  }
}