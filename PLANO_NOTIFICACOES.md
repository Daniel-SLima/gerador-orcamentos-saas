# 🔔 PLANO DE IMPLEMENTAÇÃO — Sistema de Notificações In-App (SANE)

> **Status da Tabela SQL**: ✅ JÁ CRIADA no Supabase (tabela `notifications` com RLS pronta).
> **NÃO execute o SQL novamente.**

---

## 1. CONTEXTO DO PROJETO

### Stack
- **Framework**: Next.js 16 (App Router, todos os componentes usam `"use client"`)
- **Banco**: Supabase (PostgreSQL + Realtime + RLS)
- **Auth**: Supabase Auth
- **CSS**: Tailwind CSS 4
- **Deploy**: Netlify
- **Custo**: R$ 0 — **NÃO adicionar nenhum serviço pago** (Pusher, Firebase, etc.)

### Estrutura de pastas relevante
```
app/
├── lib/supabase.ts              ← Client Supabase (anon key)
├── hooks/usePerfilUsuario.tsx   ← Hook de perfil (isAdmin, isVendedor, isOperador, setorDoOperador, userId)
├── components/
│   ├── AlertModal.tsx           ← Modais de alerta/confirmação usados em todo o sistema
│   └── Toast.tsx                ← Componente de toast
├── dashboard/
│   ├── layout.tsx               ← Layout com sidebar + barra mobile + proteção de rota
│   ├── page.tsx                 ← Dashboard home
│   ├── orcamentos/page.tsx      ← Formulário de criar/editar orçamento
│   ├── historico/page.tsx       ← Lista de orçamentos com ações (mudar status, gerar OP, etc.)
│   ├── producao/page.tsx        ← Central de produção (admin)
│   ├── producao/[id]/page.tsx   ← Detalhe de uma OP
│   ├── setor/page.tsx           ← Tela do operador (tablet)
│   └── usuarios/page.tsx        ← Gerenciamento de equipe
```

### Tipos de Usuário (campo `funcao` na tabela `perfis_usuarios`)
| Função | Descrição |
|--------|-----------|
| `admin` | Acesso total. Pode aprovar/recusar orçamentos, ver produção, gerenciar equipe. |
| `vendedor` | Cria orçamentos, vê apenas os seus. **NÃO pode aprovar/recusar.** |
| `operador` | Usa a tela "Meu Setor" no tablet. Tem campo `setor` (metalurgia, impressao, plotagem, instalacao, embalagem). |
| `desativado` | Bloqueado. |

### Client Supabase (`app/lib/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Hook de Perfil (`app/hooks/usePerfilUsuario.tsx`)
```typescript
// Retorna: { isAdmin, isVendedor, isOperador, isDesativado, setorDoOperador, userId, loadingPerfil }
// Busca de perfis_usuarios onde user_id = auth.uid()
// Disponível via <PerfilUsuarioProvider> no layout.tsx
```

---

## 2. TABELA `notifications` (JÁ CRIADA ✅)

```sql
-- REFERÊNCIA — NÃO EXECUTAR NOVAMENTE
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN ('novo_orcamento', 'orcamento_atualizado', 'orcamento_aprovado', 'orcamento_recusado', 'nova_op')),
  titulo     TEXT NOT NULL,
  mensagem   TEXT,
  link       TEXT,
  lida       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes e RLS já criados
```

---

## 3. O QUE IMPLEMENTAR — 5 TAREFAS

---

### TAREFA 1: Criar componente `NotificationBell`

**Arquivo**: `app/components/NotificationBell.tsx` (NOVO)

Crie um componente `"use client"` com estas funcionalidades:

**Visual**:
- Ícone de sino (SVG) com badge vermelho mostrando número de notificações não-lidas
- Se não há não-lidas, badge não aparece
- Ao clicar no sino, abre dropdown/painel com lista das últimas 20 notificações
- Fechar o painel ao clicar fora dele

**Cada notificação no painel**:
- Ícone baseado no tipo: 📄 `novo_orcamento` | ✏️ `orcamento_atualizado` | ✅ `orcamento_aprovado` | ❌ `orcamento_recusado` | 🏭 `nova_op`
- Título (texto principal)
- Mensagem (texto secundário, menor)
- Tempo relativo ("há 5 min", "há 2h", "ontem")
- Fundo azul claro se não-lida, fundo branco se lida

**Ações**:
- Clicar em uma notificação → marca como lida no banco + navega para `notificacao.link` (se existir)
- Botão "Marcar todas como lidas" no topo do painel

**Realtime** (para atualizar sem recarregar a página):
```typescript
useEffect(() => {
  if (!userId) return;
  const channel = supabase
    .channel(`notif_${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      () => { recarregarNotificacoes(); }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [userId]);
```

**Queries**:
```typescript
// Carregar últimas 20
const { data } = await supabase
  .from("notifications")
  .select("*")
  .eq("user_id", userId)
  .order("created_at", { ascending: false })
  .limit(20);

// Contar não-lidas (para o badge)
const { count } = await supabase
  .from("notifications")
  .select("id", { count: "exact", head: true })
  .eq("user_id", userId)
  .eq("lida", false);

// Marcar como lida
await supabase.from("notifications").update({ lida: true }).eq("id", notifId);

// Marcar todas como lidas
await supabase.from("notifications").update({ lida: true }).eq("user_id", userId).eq("lida", false);
```

**Importações**: usar apenas `supabase` de `../../lib/supabase` e `usePerfilUsuario` de `../../hooks/usePerfilUsuario`. Usar `useRouter` do Next.js para navegação.

**Design**: Consistente com o estilo do sidebar (fundo escuro) e a barra mobile. O painel de notificações deve ter fundo branco com shadow-xl e border.

---

### TAREFA 2: Integrar o sino no layout

**Arquivo**: `app/dashboard/layout.tsx` (MODIFICAR)

- Importar `NotificationBell` de `../components/NotificationBell`
- Renderizar `<NotificationBell />` em DOIS lugares:
  1. **Sidebar desktop**: entre o logo "SANE" e os links do menu
  2. **Barra mobile**: ao lado do botão de hamburger
- O sino aparece para **TODOS os tipos de usuário** (admin, vendedor, operador — todos recebem notificações)

---

### TAREFA 3: Notificar admins ao salvar orçamento

**Arquivo**: `app/dashboard/orcamentos/page.tsx` (MODIFICAR)

Na função `gerarOuAtualizarOrcamento()`, **APÓS** o orçamento ser salvo com sucesso (após salvar itens e anexos, ANTES do `window.open` e `window.location.href`), adicione:

```typescript
// --- NOTIFICAÇÕES PARA ADMINS ---
// Só notifica se o usuário NÃO é admin (admin não notifica a si mesmo)
if (!isAdmin) {
  try {
    const { data: admins } = await supabase
      .from("perfis_usuarios")
      .select("user_id")
      .eq("funcao", "admin");

    if (admins && admins.length > 0) {
      const nomeCliente = clientes.find(c => c.id === clienteId)?.nome_razao_social || "Cliente";
      const notificacoes = admins.map(admin => ({
        user_id: admin.user_id,
        tipo: editId ? "orcamento_atualizado" : "novo_orcamento",
        titulo: editId
          ? `Orçamento atualizado`
          : `Novo orçamento criado`,
        mensagem: `Cliente: ${nomeCliente}`,
        link: `/imprimir/${idFinal}?action=view`,
      }));
      await supabase.from("notifications").insert(notificacoes);
    }
  } catch (err) {
    console.error("Erro ao enviar notificação:", err);
  }
}
```

**Variáveis que já existem no escopo**: `isAdmin` (do hook usePerfilUsuario), `editId` (do searchParams), `idFinal` (ID do orçamento salvo), `clientes` (array no state), `clienteId` (state).

---

### TAREFA 4: Notificações ao mudar status + Notificação de OP gerada

**Arquivo**: `app/dashboard/historico/page.tsx` (MODIFICAR)

#### 4a. Notificar vendedor quando admin aprova/recusa

Na função que muda o status do orçamento (procure onde faz `.update({ status: novoStatus })` na tabela `orcamentos`), APÓS o update ter sucesso:

```typescript
// --- NOTIFICAÇÃO PARA VENDEDOR ---
if (isAdmin && (novoStatus === "Aprovado" || novoStatus === "Recusado")) {
  try {
    const orc = orcamentos.find(o => o.id === id);
    if (orc) {
      const { data: { user } } = await supabase.auth.getUser();
      // Não notifica se o admin é o próprio dono do orçamento
      if (user && orc.user_id !== user.id) {
        const numeroFormatado = String(orc.numero_orcamento).padStart(5, "0");
        await supabase.from("notifications").insert({
          user_id: orc.user_id,
          tipo: novoStatus === "Aprovado" ? "orcamento_aprovado" : "orcamento_recusado",
          titulo: novoStatus === "Aprovado"
            ? `Orçamento #${numeroFormatado} aprovado ✅`
            : `Orçamento #${numeroFormatado} recusado ❌`,
          mensagem: novoStatus === "Aprovado"
            ? "Seu orçamento foi aprovado pelo administrador."
            : "Seu orçamento foi recusado pelo administrador.",
          link: `/imprimir/${id}?action=view`,
        });
      }
    }
  } catch (err) {
    console.error("Erro ao enviar notificação:", err);
  }
}
```

#### 4b. Notificar operadores quando OP é gerada

Na função `confirmarGerarOP()`, APÓS criar a OP e os itens_op com sucesso:

```typescript
// --- NOTIFICAÇÃO PARA OPERADORES DA METALURGIA ---
try {
  const { data: opCriada } = await supabase
    .from("ordens_producao")
    .select("numero_op")
    .eq("orcamento_id", orcamentoOpSelecionado)
    .single();

  if (opCriada) {
    const { data: operadores } = await supabase
      .from("perfis_usuarios")
      .select("user_id")
      .eq("funcao", "operador")
      .eq("setor", "metalurgia");

    if (operadores && operadores.length > 0) {
      const numeroOp = String(opCriada.numero_op).padStart(4, "0");
      const notificacoes = operadores.map(op => ({
        user_id: op.user_id,
        tipo: "nova_op",
        titulo: `Nova OP #${numeroOp} aguardando`,
        mensagem: "Uma nova Ordem de Produção chegou para a Metalurgia.",
        link: "/dashboard/setor",
      }));
      await supabase.from("notifications").insert(notificacoes);
    }
  }
} catch (err) {
  console.error("Erro ao notificar operadores:", err);
}
```

---

### TAREFA 5: Restringir status para vendedores

**Arquivo**: `app/dashboard/historico/page.tsx` (MODIFICAR)

Existem DOIS `<select>` de status na página (um na versão mobile, outro na versão desktop). Em **AMBOS**, faça estas mudanças:

**Esconder opções Aprovado/Recusado para vendedores**:
```tsx
<select
  value={orc.status}
  onChange={(e) => mudarStatus(orc.id, e.target.value)}
  disabled={!isAdmin && (orc.status === "Aprovado" || orc.status === "Recusado")}
  className={...}
>
  <option value="Rascunho">Rascunho</option>
  <option value="Aberto">Aberto</option>
  {isAdmin && <option value="Aprovado">Aprovado</option>}
  {isAdmin && <option value="Recusado">Recusado</option>}
</select>
```

**Lógica**:
- Vendedor só vê "Rascunho" e "Aberto" no dropdown
- Se o orçamento já tem status "Aprovado" ou "Recusado" (mudado pelo admin), o `<select>` fica **disabled** para o vendedor
- Admin continua vendo todas as 4 opções normalmente

---

## 4. TABELA RESUMO — QUEM RECEBE O QUÊ

| Evento | Disparado por | Quem recebe | Tipo | Onde no código |
|--------|--------------|-------------|------|----------------|
| Criar orçamento | Vendedor | Todos os admins | `novo_orcamento` | `orcamentos/page.tsx` → `gerarOuAtualizarOrcamento()` |
| Editar orçamento | Vendedor | Todos os admins | `orcamento_atualizado` | `orcamentos/page.tsx` → `gerarOuAtualizarOrcamento()` |
| Aprovar orçamento | Admin | Vendedor dono | `orcamento_aprovado` | `historico/page.tsx` → função de mudar status |
| Recusar orçamento | Admin | Vendedor dono | `orcamento_recusado` | `historico/page.tsx` → função de mudar status |
| Gerar OP | Admin/Vendedor | Operadores metalurgia | `nova_op` | `historico/page.tsx` → `confirmarGerarOP()` |

---

## 5. REGRAS OBRIGATÓRIAS

1. **Nunca notificar a si mesmo** — se admin cria orçamento, NÃO notifica admins. Se o admin muda status do próprio orçamento, NÃO notifica a si mesmo.
2. **Vendedores NÃO podem Aprovar/Recusar** — essas opções ficam escondidas do `<select>`. Se já aprovado/recusado, o dropdown fica disabled.
3. **Custo zero** — usar apenas Supabase Realtime (gratuito no free tier). NÃO instalar Pusher, Firebase ou qualquer pacote npm externo.
4. **Design consistente** — o sino deve seguir o visual existente do sistema (sidebar escuro, cards brancos).
5. **O Realtime já é usado** — a tela `setor/page.tsx` já usa `supabase.channel().on('postgres_changes')`, então funciona e é grátis.
6. **Não quebrar funcionalidades existentes** — as notificações são adicionais, o fluxo atual deve continuar funcionando mesmo se der erro na notificação (usar try/catch).
