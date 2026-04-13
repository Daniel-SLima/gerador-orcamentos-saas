/**
 * middleware.ts — Rate Limiting com Detecção de Bots
 *
 * Estratégia:
 * - Limite suave: 100 req/min por usuário (humano normal nunca atinge)
 * - Detecção de spike: se 5x o limite normal em janela curta, é bot
 * - Tracking por IP + user ID (quando autenticado)
 * - Armazenamento em memória (reseta em restart do servidor)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Configurações de Limite ─────────────────────────────────────────────────
const JANELA_MINUTO_MS = 60_000;
const LIMITE_NORMAL = 100;         // req/min para usuário normal
const LIMITE_SPIKE = 300;           // req/min antes de bloquear por spike
const MULTIPLICADOR_SPIKE = 5;      // 5x média = possivel bot

// Mapa: identifier → { contagem, janelaInicio, hist: number[] }
type Entry = {
  contagem: number;
  janelaInicio: number;
  historico: number[]; // último valor por minuto (últimos 5 min)
};
const rateLimitStore = new Map<string, Entry>();

// Limpa entradas ANTIGAS a cada 5 min (evita memory leak)
const ULTIMA_LIMPEZA = Date.now();

function getIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  // Para APIs autenticadas, incluir user ID seria melhor
  // mas como não temos acesso direto ao token aqui, usamos IP
  return ip;
}

function shouldRateLimit(identifier: string): { blocked: boolean; reason: string; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry) {
    rateLimitStore.set(identifier, { contagem: 1, janelaInicio: now, historico: [1] });
    return { blocked: false, reason: "ok", retryAfter: 0 };
  }

  // Se janela de 1 min passou, reseta
  if (now - entry.janelaInicio >= JANELA_MINUTO_MS) {
    // Salva no histórico (manter últimos 5 min)
    const novoHistorico = [...entry.historico, entry.contagem].slice(-5);
    rateLimitStore.set(identifier, { contagem: 1, janelaInicio: now, historico: novoHistorico });
    return { blocked: false, reason: "ok", retryAfter: 0 };
  }

  // Incrementa
  entry.contagem++;

  // Calcula média histórica (últimos 5 min)
  const mediaHistorico = entry.historico.length > 0
    ? entry.historico.reduce((a, b) => a + b, 0) / entry.historico.length
    : 0;

  // Spike detection: se contagem atual > 5x média E > LIMITE_SPIKE → bot
  const isSpike = mediaHistorico > 0 && entry.contagem > mediaHistorico * MULTIPLICADOR_SPIKE && entry.contagem > LIMITE_SPIKE;

  // Bloqueio normal: > LIMITE_NORMAL na janela
  const isNormalBlock = entry.contagem > LIMITE_NORMAL;

  if (isSpike) {
    return { blocked: true, reason: "spike", retryAfter: 60 };
  }

  if (isNormalBlock) {
    return { blocked: true, reason: "normal", retryAfter: Math.ceil((entry.janelaInicio + JANELA_MINUTO_MS - now) / 1000) };
  }

  return { blocked: false, reason: "ok", retryAfter: 0 };
}

function cleanupOldEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entradas com mais de 10 min de idade
    if (now - entry.janelaInicio > 10 * JANELA_MINUTO_MS) {
      rateLimitStore.delete(key);
    }
  }
}

// Rotas que NÃO precisam de rate limiting (webhooks, health checks)
const ROTAS_BYPASS = ["/api/feed", "/_next", "/favicon", "/health"];

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Bypass para rotas não-API e algunas específicas
  if (!pathname.startsWith("/api/") || ROTAS_BYPASS.some(r => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  const identifier = getIdentifier(req);

  // Cleanup periódico leve
  if (Date.now() - ULTIMA_LIMPEZA > 5 * JANELA_MINUTO_MS) {
    cleanupOldEntries();
  }

  const { blocked, reason, retryAfter } = shouldRateLimit(identifier);

  if (blocked) {
    const resp = NextResponse.json(
      {
        error: "Too many requests.",
        reason: reason === "spike" ? "Comportamento automatizado detectado." : "Limite de requisições excedido.",
      },
      { status: 429 }
    );
    resp.headers.set("Retry-After", String(retryAfter));
    resp.headers.set("X-RateLimit-Limit", String(LIMITE_NORMAL));
    resp.headers.set("X-RateLimit-Remaining", "0");
    return resp;
  }

  // Adiciona headers de informação
  const entry = rateLimitStore.get(identifier);
  const resp = NextResponse.next();
  resp.headers.set("X-RateLimit-Limit", String(LIMITE_NORMAL));
  resp.headers.set("X-RateLimit-Remaining", String(Math.max(0, LIMITE_NORMAL - (entry?.contagem || 0))));
  return resp;
}

export const config = {
  matcher: "/api/:path*",
};