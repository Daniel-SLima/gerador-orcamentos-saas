# 📋 PLANO DE IMPLEMENTAÇÃO — SISTEMA SANE
## Guia Completo para Agente de IA

> **ATENÇÃO CRÍTICA:** O sistema já está em produção. NUNCA apagar colunas, NUNCA recriar tabelas, NUNCA alterar constraints existentes. Toda operação é **APENAS ADITIVA** (ADD COLUMN, CREATE TABLE, ALTER TYPE apenas para adicionar valores).

---

## 📁 ESTRUTURA DO PROJETO (referência rápida)

```
app/
├── api/admin/            → APIs de autenticação/admin
├── components/
│   ├── AlertModal.tsx    → Modais de confirmação e alerta
│   ├── Toast.tsx         → Notificações toast (useToast hook)
│   └── NotificationBell.tsx
├── dashboard/
│   ├── clientes/page.tsx
│   ├── historico/page.tsx
│   ├── layout.tsx        → Menu lateral + proteção de rotas
│   ├── orcamentos/page.tsx
│   ├── producao/page.tsx
│   ├── producao/[id]/page.tsx
│   ├── setor/page.tsx    → Tela do operador
│   └── usuarios/page.tsx
├── hooks/usePerfilUsuario.tsx  → Contexto de perfil (isAdmin, isVendedor, isOperador, isFinanceiro)
├── imprimir/[id]/
│   ├── OrcamentoPDF.tsx
│   ├── OrdemProducaoPDF.tsx
│   ├── page.tsx
│   └── types.ts
└── lib/supabase.ts
```

**Padrões do projeto:**
- Toast de sucesso/erro: `const { showToast } = useToast()` → `showToast("mensagem", "success"|"error")`
- Modais: `useAlert()` e `useConfirm()` do `AlertModal.tsx`
- Perfil do usuário: `usePerfilUsuario()` → `{ isAdmin, isVendedor, isOperador, isFinanceiro, isDesativado, setorDoOperador, userId }`
- Supabase client: `import { supabase } from "../../lib/supabase"`
- Estilo: TailwindCSS, mobile-first, sem libs de UI externas

---

## 🔴 FASE 1 — BANCO DE DADOS (Executar PRIMEIRO, antes de qualquer código)

> Execute cada bloco SQL individualmente no Supabase SQL Editor. Verifique o resultado antes de avançar.

### 1.1 — Adicionar coluna `email` na tabela `clientes`

```sql
-- Seguro: ADD COLUMN não afeta dados existentes
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS email text;

-- Verificação
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clientes' AND column_name = 'email';
```

### 1.2 — Adicionar perfil `compras` ao enum de funções

```sql
-- O Postgres não tem ADD VALUE IF NOT EXISTS antes do 14.
-- Use a forma segura abaixo:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'compras' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'funcao_usuario')
  ) THEN
    ALTER TYPE public.funcao_usuario ADD VALUE 'compras';
  END IF;
END
$$;
```

> **ATENÇÃO:** Se a coluna `funcao` em `perfis_usuarios` for do tipo `text` com CHECK CONSTRAINT (não um enum de tipo), use:

```sql
-- ALTERNATIVA se funcao for text com CHECK:
ALTER TABLE public.perfis_usuarios 
DROP CONSTRAINT IF EXISTS perfis_usuarios_funcao_check;

ALTER TABLE public.perfis_usuarios
ADD CONSTRAINT perfis_usuarios_funcao_check 
CHECK (funcao = ANY (ARRAY[
  'admin'::text, 
  'vendedor'::text, 
  'operador'::text, 
  'financeiro'::text, 
  'desativado'::text,
  'compras'::text  -- NOVO
]));

-- Verificação
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.perfis_usuarios'::regclass;
```

### 1.3 — Expandir status aceitos em `itens_op`

```sql
-- Verifica constraint atual
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.itens_op'::regclass 
AND contype = 'c';

-- Se houver constraint de CHECK no status_item, atualiza:
ALTER TABLE public.itens_op 
DROP CONSTRAINT IF EXISTS itens_op_status_item_check;

-- Não adiciona nova constraint restritiva — deixa o campo text livre
-- Os novos valores aceitos (controlados pela aplicação) são:
-- 'pendente', 'em_andamento', 'em_confeccao', 'aguardando_material', 
-- 'finalizado_entregue', 'concluido'
-- Isso é mais flexível e não exige migração de dados existentes.

-- Verificação: confirmar que não há constraint bloqueando
SELECT status_item, COUNT(*) FROM public.itens_op GROUP BY status_item;
```

### 1.4 — Criar tabela `materiais_op`

```sql
CREATE TABLE IF NOT EXISTS public.materiais_op (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  op_id uuid NOT NULL,
  item_op_id uuid,                          -- vínculo opcional com item específico
  descricao text NOT NULL,
  quantidade_necessaria numeric NOT NULL DEFAULT 1,
  unidade text,                             -- ex: 'un', 'kg', 'm²', 'rolo'
  tem_no_galpao boolean NOT NULL DEFAULT false,
  quantidade_galpao numeric DEFAULT 0,
  precisa_comprar boolean NOT NULL DEFAULT true,
  quantidade_comprar numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'solicitado'  
    CHECK (status = ANY (ARRAY[
      'solicitado'::text,
      'comprado'::text,
      'entregue'::text,
      'cancelado'::text
    ])),
  solicitado_por uuid,                       -- user_id do operador
  comprado_por uuid,                         -- user_id do compras
  previsao_entrega date,
  destino_entrega text,                      -- setor/pessoa de destino
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT materiais_op_pkey PRIMARY KEY (id),
  CONSTRAINT materiais_op_op_id_fkey 
    FOREIGN KEY (op_id) REFERENCES public.ordens_producao(id) ON DELETE CASCADE,
  CONSTRAINT materiais_op_item_op_id_fkey 
    FOREIGN KEY (item_op_id) REFERENCES public.itens_op(id) ON DELETE SET NULL,
  CONSTRAINT materiais_op_solicitado_por_fkey 
    FOREIGN KEY (solicitado_por) REFERENCES auth.users(id),
  CONSTRAINT materiais_op_comprado_por_fkey 
    FOREIGN KEY (comprado_por) REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_materiais_op_op_id ON public.materiais_op(op_id);
CREATE INDEX IF NOT EXISTS idx_materiais_op_status ON public.materiais_op(status);
CREATE INDEX IF NOT EXISTS idx_materiais_op_item_op_id ON public.materiais_op(item_op_id);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER materiais_op_updated_at
  BEFORE UPDATE ON public.materiais_op
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS (Row Level Security) — libera para usuários autenticados
ALTER TABLE public.materiais_op ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver materiais" ON public.materiais_op
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operadores e admins podem inserir materiais" ON public.materiais_op
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Operadores, compras e admins podem atualizar" ON public.materiais_op
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Verificação final
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'materiais_op';
```

### 1.5 — Verificações pós-migração

```sql
-- Confirmar todas as tabelas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Confirmar colunas de clientes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clientes'
ORDER BY ordinal_position;

-- Confirmar materiais_op
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'materiais_op'
ORDER BY ordinal_position;

-- Confirmar que nenhum orçamento foi perdido
SELECT COUNT(*) as total_orcamentos FROM public.orcamentos;
SELECT COUNT(*) as total_clientes FROM public.clientes;
SELECT COUNT(*) as total_itens FROM public.itens_orcamento;
```

---

## 🟡 FASE 2 — ATUALIZAÇÕES DE TIPOS E HOOKS

### 2.1 — Atualizar `app/imprimir/[id]/types.ts`

Adicione o campo `email` na interface `Cliente`:

```typescript
export interface Cliente {
  nome_razao_social: string;
  cpf_cnpj: string;
  telefone: string;
  contato_nome: string;
  email?: string;          // ← ADICIONAR esta linha
  endereco?: string;
  rua_numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
}
```

### 2.2 — Atualizar `app/hooks/usePerfilUsuario.tsx`

Adicione suporte ao novo perfil `compras`:

```typescript
// Dentro da interface PerfilContextType, adicionar:
isCompras: boolean;

// Dentro do PerfilUsuarioProvider, adicionar estado:
const [isCompras, setIsCompras] = useState(false);

// Dentro do carregarPerfil(), após os outros setIs...:
setIsCompras(funcaoAjustada === "compras");

// No reset do onAuthStateChange, adicionar:
setIsCompras(false);

// No Provider value, adicionar:
isCompras,

// No useEffect de reset de valores padrão ao sair (dentro do onAuthStateChange):
setIsCompras(false);
```

**Interface completa atualizada:**
```typescript
interface PerfilContextType {
  isAdmin: boolean;
  isVendedor: boolean;
  isOperador: boolean;
  isFinanceiro: boolean;
  isCompras: boolean;       // ← NOVO
  isDesativado: boolean;
  setorDoOperador: string | null;
  userId: string | null;
  emailUsuario: string | null;
  loadingPerfil: boolean;
}
```

---

## 🟢 FASE 3 — MÓDULO 1: VENDEDORES

### 3.1 — Campo Email em Clientes (`app/dashboard/clientes/page.tsx`)

**Localizar a interface `Cliente` no topo do arquivo e adicionar:**
```typescript
interface Cliente {
  // ... campos existentes ...
  email?: string;    // ← ADICIONAR
}
```

**Adicionar estado no componente (após os estados existentes de inscricaoMunicipal):**
```typescript
const [emailCliente, setEmailCliente] = useState("");
```

**Adicionar campo no formulário (após o campo de telefone, antes do CNPJ):**
```tsx
<div className="md:col-span-6 lg:col-span-4">
  <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
  <input
    type="email"
    value={emailCliente}
    onChange={(e) => setEmailCliente(e.target.value)}
    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
    placeholder="contato@empresa.com.br"
  />
</div>
```

**Em `dadosParaSalvar`, adicionar:**
```typescript
email: emailCliente.trim() || null,
```

**Em `iniciarEdicao`, adicionar:**
```typescript
setEmailCliente(cliente.email || "");
```

**Em `limparFormulario`, adicionar:**
```typescript
setEmailCliente("");
```

**Na tabela desktop (thead), adicionar coluna após Telefone:**
```tsx
<th className="p-4 text-sm font-semibold text-gray-600">E-mail</th>
```

**Na tabela desktop (tbody), adicionar célula após telefone:**
```tsx
<td className="p-4 text-gray-600">{cliente.email || "-"}</td>
```

**No card mobile, adicionar:**
```tsx
{cliente.email && <p><span className="font-medium text-gray-500">E-mail:</span> {cliente.email}</p>}
```

### 3.2 — Roteamento de Orçamentos ADM (`app/dashboard/historico/page.tsx`)

**Problema atual:** O `carregarOrcamentos` filtra por `user_id` para não-admins. Para que um orçamento criado pelo admin (com vendedor_id de outro usuário) apareça no histórico do vendedor, a query deve incluir os casos onde `vendedor_id` corresponde ao `user_id` do usuário logado.

**Localizar a função `carregarOrcamentos` e substituir a lógica de filtro:**

```typescript
// ANTES (substituir estas linhas):
if (!isAdmin && !isFinanceiro) {
  query = query.eq("user_id", user.id);
}

// DEPOIS (lógica nova que inclui orçamentos onde o usuário é o vendedor):
if (!isAdmin && !isFinanceiro) {
  // Busca o vendedor_id correspondente ao user_id atual
  const { data: vendedorData } = await supabase
    .from("vendedores")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (vendedorData?.id) {
    // Mostra orçamentos criados pelo usuário OU onde ele é o vendedor vinculado
    query = query.or(`user_id.eq.${user.id},vendedor_id.eq.${vendedorData.id}`);
  } else {
    query = query.eq("user_id", user.id);
  }
}
```

### 3.3 — Exportação Avançada (Relatórios CSV/PDF) em `app/dashboard/historico/page.tsx`

**Adicionar estados para filtros avançados (após os estados existentes):**

```typescript
// Estados do painel de exportação
const [painelExportAberto, setPainelExportAberto] = useState(false);
const [exportDataInicial, setExportDataInicial] = useState("");
const [exportDataFinal, setExportDataFinal] = useState("");
const [exportStatus, setExportStatus] = useState("todos");
const [exportVendedor, setExportVendedor] = useState("todos");
const [exportBusca, setExportBusca] = useState(""); // busca por nº OP, nº Orçamento
const [exportandoCSV, setExportandoCSV] = useState(false);
const [listaVendedores, setListaVendedores] = useState<{id: string, nome: string}[]>([]);
```

**Carregar lista de vendedores (no useEffect inicial, apenas para admin/financeiro):**
```typescript
useEffect(() => {
  if ((isAdmin || isFinanceiro) && !loadingPerfil) {
    supabase.from("vendedores").select("id, nome").order("nome")
      .then(({ data }) => { if (data) setListaVendedores(data); });
  }
}, [isAdmin, isFinanceiro, loadingPerfil]);
```

**Adicionar função de exportação CSV:**
```typescript
const exportarCSV = async () => {
  setExportandoCSV(true);
  try {
    let query = supabase
      .from("orcamentos")
      .select(`
        numero_orcamento, data_emissao, valor_total, status,
        clientes ( nome_razao_social ),
        vendedores ( nome ),
        ordens_producao ( numero_op )
      `)
      .order("numero_orcamento", { ascending: false });

    // Filtros
    if (exportDataInicial) query = query.gte("data_emissao", exportDataInicial);
    if (exportDataFinal) query = query.lte("data_emissao", exportDataFinal);
    if (exportStatus !== "todos") {
      if (exportStatus === "vencidos") {
        const hoje = new Date().toISOString().slice(0, 10);
        query = query.lt("data_emissao", hoje).eq("status", "Aberto");
      } else {
        query = query.eq("status", exportStatus);
      }
    }
    if (exportVendedor !== "todos") query = query.eq("vendedor_id", exportVendedor);
    if (exportBusca.trim()) {
      const num = parseInt(exportBusca.trim());
      if (!isNaN(num)) query = query.eq("numero_orcamento", num);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Montar CSV
    const header = ["Nº Orçamento", "Data", "Cliente", "Vendedor", "Valor Total", "Status", "Nº OP"];
    const linhas = (data || []).map((o: any) => {
      const cliente = Array.isArray(o.clientes) ? o.clientes[0] : o.clientes;
      const vendedor = Array.isArray(o.vendedores) ? o.vendedores[0] : o.vendedores;
      const op = Array.isArray(o.ordens_producao) ? o.ordens_producao[0] : o.ordens_producao;
      return [
        o.numero_orcamento,
        o.data_emissao,
        cliente?.nome_razao_social || "-",
        vendedor?.nome || "-",
        `R$ ${Number(o.valor_total).toFixed(2).replace(".", ",")}`,
        o.status,
        op?.numero_op || "-",
      ].join(";");
    });

    const csvContent = "\uFEFF" + [header.join(";"), ...linhas].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_orcamentos_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Relatório CSV exportado com sucesso!", "success");
  } catch (err) {
    showToast("Erro ao exportar: " + (err as Error).message, "error");
  } finally {
    setExportandoCSV(false);
  }
};
```

**Adicionar botão e painel de exportação na UI (antes da lista de orçamentos):**

```tsx
{/* Botão abrir painel de exportação */}
{(isAdmin || isFinanceiro) && (
  <div className="mb-4 flex justify-end">
    <button
      onClick={() => setPainelExportAberto(!painelExportAberto)}
      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Exportar Relatório
    </button>
  </div>
)}

{/* Painel de exportação avançada */}
{painelExportAberto && (isAdmin || isFinanceiro) && (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-6 mb-6">
    <h3 className="text-base font-semibold text-gray-800 mb-4">Filtros para Exportação</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
        <input type="date" value={exportDataInicial} onChange={e => setExportDataInicial(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
        <input type="date" value={exportDataFinal} onChange={e => setExportDataFinal(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select value={exportStatus} onChange={e => setExportStatus(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
          <option value="todos">Todos</option>
          <option value="Aberto">Em Aberto</option>
          <option value="Aprovado">Aprovados</option>
          <option value="Recusado">Recusados</option>
          <option value="Rascunho">Rascunho</option>
          <option value="vencidos">Vencidos (Aberto + data passada)</option>
        </select>
      </div>
      {isAdmin && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vendedor</label>
          <select value={exportVendedor} onChange={e => setExportVendedor(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
            <option value="todos">Todos</option>
            {listaVendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Buscar por Nº</label>
        <input type="text" value={exportBusca} onChange={e => setExportBusca(e.target.value)}
          placeholder="Nº do Orçamento ou OP"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
      </div>
    </div>
    <div className="mt-4 flex flex-col sm:flex-row gap-3">
      <button onClick={exportarCSV} disabled={exportandoCSV}
        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
        {exportandoCSV ? "Exportando..." : "📥 Baixar CSV"}
      </button>
      <button onClick={() => setPainelExportAberto(false)}
        className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
        Fechar
      </button>
    </div>
  </div>
)}
```

### 3.4 — OP do Financeiro (`app/imprimir/[id]/OrdemProducaoPDF.tsx`)

**Criar um novo componente `OrdemProducaoFinanceiroPDF.tsx` no mesmo diretório.**

Este componente é uma cópia do `OrdemProducaoPDF.tsx`, com as seguintes diferenças:

1. Exibe o `valor_unitario_aplicado` de cada item
2. Exibe o `subtotal` de cada item
3. Exibe o `valor_total` do orçamento ao final
4. Pode exibir descontos se houver

**Estrutura do novo arquivo `app/imprimir/[id]/OrdemProducaoFinanceiroPDF.tsx`:**

```typescript
"use client";
// COPIAR TODO O CONTEÚDO DE OrdemProducaoPDF.tsx
// e fazer as seguintes modificações:

// 1. No nome do componente:
export default function OrdemProducaoFinanceiroPDF({ dados, show }: Props) {
  // ...igual ao original

// 2. Na tabela de itens, adicionar colunas de valor:
// Após o cabeçalho existente, adicionar:
<th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "right" }}>Vl. Unit.</th>
<th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "right" }}>Subtotal</th>

// 3. Em cada linha de item, adicionar células:
<td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "right" }}>
  {formatarMoeda(item.valor_unitario_aplicado)}
</td>
<td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "right" }}>
  {formatarMoeda(item.subtotal)}
</td>

// 4. Ao final da tabela de itens, antes do fechamento, adicionar rodapé financeiro:
<tfoot>
  {dados.orcamento.desconto_total && dados.orcamento.desconto_total > 0 ? (
    <tr>
      <td colSpan={/* nColunas - 1 */} style={{ textAlign: "right", padding: "8px", fontWeight: "bold" }}>
        Desconto:
      </td>
      <td style={{ textAlign: "right", padding: "8px", color: "#dc2626" }}>
        - {formatarMoeda(dados.orcamento.desconto_total)}
      </td>
    </tr>
  ) : null}
  <tr style={{ backgroundColor: "#f0fdf4" }}>
    <td colSpan={/* nColunas - 1 */} style={{ textAlign: "right", padding: "10px", fontWeight: "bold", fontSize: "15px" }}>
      VALOR TOTAL:
    </td>
    <td style={{ textAlign: "right", padding: "10px", fontWeight: "bold", fontSize: "15px", color: "#16a34a" }}>
      {formatarMoeda(dados.orcamento.valor_total)}
    </td>
  </tr>
</tfoot>
```

**Em `app/imprimir/[id]/page.tsx`, adicionar suporte ao novo parâmetro `action=financeiro`:**

```typescript
// Adicionar busca do parâmetro:
const action = searchParams.get("action"); // 'view' | 'download' | 'op' | 'op-financeiro'

// Adicionar renderização condicional:
{action === "op-financeiro" && (
  <OrdemProducaoFinanceiroPDF dados={dados} show={true} />
)}
```

---

## 🟠 FASE 4 — MÓDULO 2: FINANCEIRO

### 4.1 — Downloads Unificados no Histórico

**Em `app/dashboard/historico/page.tsx`, dentro do menu de ações (os 3 pontinhos) de cada orçamento:**

Localizar onde existem os botões `visualizarPDF` e `baixarPDF` e adicionar novos botões para quem é admin ou financeiro.

**Adicionar função para download da OP do Financeiro:**
```typescript
const baixarOPFinanceiro = (id: string) => {
  window.open(`/imprimir/${id}?action=op-financeiro`, "_blank");
  setMenuAbertoId(null);
};

const baixarOPPadrao = (id: string) => {
  window.open(`/imprimir/${id}?action=op`, "_blank");
  setMenuAbertoId(null);
};
```

**No menu de ações, adicionar (após os botões de PDF existentes, visível apenas para admin/financeiro):**
```tsx
{(isAdmin || isFinanceiro) && (
  <>
    <div className="h-px bg-gray-100 my-1 mx-2"></div>
    <button onClick={() => baixarOPPadrao(orc.id)}
      className="px-4 py-2 text-sm text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
      🏭 OP Produção
    </button>
    <button onClick={() => baixarOPFinanceiro(orc.id)}
      className="px-4 py-2 text-sm text-left font-medium text-emerald-700 hover:bg-emerald-50 flex items-center gap-2">
      💰 OP Financeiro
    </button>
  </>
)}
```

### 4.2 — Filtro por Vendedor no Histórico (Financeiro)

**Já existe `filtroVendedor` no estado. Garantir que o filtro seja aplicado na query `carregarOrcamentos`:**

```typescript
// Na função carregarOrcamentos, APÓS o filtro de admin/financeiro,
// adicionar o filtro por vendedor selecionado:
if ((isAdmin || isFinanceiro) && filtroVendedor !== "todos") {
  // Buscar o vendedor_id a partir do nome/id selecionado
  query = query.eq("vendedor_id", filtroVendedor);
}
```

**Garantir que o select de vendedores esteja visível na UI de filtros para financeiro também:**

```tsx
{/* Filtro por Vendedor — visível para admin E financeiro */}
{(isAdmin || isFinanceiro) && (
  <select
    value={filtroVendedor}
    onChange={e => { setFiltroVendedor(e.target.value); setPagina(0); carregarOrcamentos(0); }}
    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="todos">Todos os vendedores</option>
    {listaVendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
  </select>
)}
```

---

## 🔵 FASE 5 — MÓDULO 3: PRODUÇÃO E ESTOQUE

### 5.1 — Novos Status de Produção

**Arquivo: `app/dashboard/producao/[id]/page.tsx` e `app/dashboard/setor/page.tsx`**

**Definir constante de status disponíveis (criar em ambos os arquivos ou em um arquivo compartilhado `app/lib/statusProducao.ts`):**

```typescript
// app/lib/statusProducao.ts
export const STATUS_ITEM_OP = [
  { value: "pendente",              label: "Pendente",                cor: "gray"   },
  { value: "em_andamento",          label: "Em Andamento",            cor: "blue"   },
  { value: "em_confeccao",          label: "Em Confecção",            cor: "purple" },
  { value: "aguardando_material",   label: "Aguardando Material",     cor: "amber"  },
  { value: "finalizado_entregue",   label: "Finalizado e Entregue",   cor: "green"  },
  { value: "concluido",             label: "Concluído",               cor: "emerald"},
] as const;

export type StatusItemOP = typeof STATUS_ITEM_OP[number]["value"];

export const getCorStatus = (status: string) => {
  const mapa: Record<string, string> = {
    pendente:            "bg-gray-100 text-gray-700",
    em_andamento:        "bg-blue-100 text-blue-700",
    em_confeccao:        "bg-purple-100 text-purple-700",
    aguardando_material: "bg-amber-100 text-amber-700",
    finalizado_entregue: "bg-green-100 text-green-700",
    concluido:           "bg-emerald-100 text-emerald-700",
    aguardando:          "bg-gray-100 text-gray-700", // compatibilidade legada
  };
  return mapa[status] || "bg-gray-100 text-gray-700";
};
```

### 5.2 — Visão Global + Edição Local na Tela de Setor

**Arquivo: `app/dashboard/setor/page.tsx`**

**Lógica atual:** Operadores veem apenas os itens do seu setor.

**Nova lógica:** Todos os itens da OP são visíveis. O botão de interação só fica habilitado para o setor do operador logado.

```typescript
// Na query de carregamento, REMOVER o filtro por setor_atual:
// ANTES: .eq("setor_atual", setorDoOperador)
// DEPOIS: sem filtro de setor (buscar todos os itens da OP)

// Na renderização de cada item, adicionar lógica de habilitação:
const podeInteragir = (item: ItemOP) => {
  if (isAdmin) return true;
  return item.setor_atual === setorDoOperador;
};

// No botão de ação:
<button
  disabled={!podeInteragir(item)}
  className={`... ${!podeInteragir(item) ? 'opacity-40 cursor-not-allowed' : ''}`}
  onClick={() => podeInteragir(item) ? abrirModalStatus(item) : null}
>
  {podeInteragir(item) ? "Alterar Status" : "Outro Setor"}
</button>
```

**Adicionar indicador visual de setor atual de cada item:**
```tsx
<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
  item.setor_atual === setorDoOperador 
    ? "bg-blue-100 text-blue-700" 
    : "bg-gray-100 text-gray-500"
}`}>
  {item.setor_atual || "aguardando"}
</span>
```

### 5.3 — Modal de Alteração de Status com Novos Valores

**Em `app/dashboard/setor/page.tsx`, no modal de alteração de status do item:**

```tsx
import { STATUS_ITEM_OP, getCorStatus } from "../../lib/statusProducao";

// Modal de status:
<div className="grid grid-cols-1 gap-2 mt-4">
  {STATUS_ITEM_OP.map(s => (
    <button
      key={s.value}
      onClick={() => atualizarStatusItem(itemSelecionado.id, s.value)}
      className={`w-full px-4 py-3 rounded-lg text-sm font-medium text-left transition-colors ${
        itemSelecionado.status_item === s.value
          ? "ring-2 ring-blue-500 " + getCorStatus(s.value)
          : "bg-gray-50 hover:bg-gray-100 text-gray-700"
      }`}
    >
      {s.label}
      {itemSelecionado.status_item === s.value && " ✓"}
    </button>
  ))}
</div>
```

### 5.4 — Granularidade de Status: Pai e Subitens

**Em `app/dashboard/setor/page.tsx` e `app/dashboard/producao/[id]/page.tsx`:**

Permitir que cada `subitem_op` também tenha `status_item`. Para isso, precisamos adicionar a coluna:

```sql
-- FASE 1 extra: adicionar status em subitens_op
ALTER TABLE public.subitens_op
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pendente';
```

**Na UI de subitens, adicionar selector de status individual:**
```tsx
{/* Para cada subitem, ao lado do checkbox de concluído */}
<select
  value={subitem.status || "pendente"}
  onChange={e => atualizarStatusSubitem(subitem.id, e.target.value)}
  disabled={!podeInteragir(itemPai)}
  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white outline-none"
>
  {STATUS_ITEM_OP.map(s => (
    <option key={s.value} value={s.value}>{s.label}</option>
  ))}
</select>
```

**Adicionar função de atualização:**
```typescript
const atualizarStatusSubitem = async (subitemId: string, novoStatus: string) => {
  const { error } = await supabase
    .from("subitens_op")
    .update({ status: novoStatus })
    .eq("id", subitemId);
  
  if (error) {
    showToast("Erro ao atualizar status: " + error.message, "error");
  } else {
    showToast("Status atualizado!", "success");
    // Recarregar dados
    carregarDados();
  }
};
```

---

## 🟣 FASE 6 — MÓDULO DE REQUISIÇÃO DE MATERIAIS

### 6.1 — Aba de Materiais na Tela de OP (`app/dashboard/producao/[id]/page.tsx`)

**Adicionar interface TypeScript:**
```typescript
interface MaterialOP {
  id: string;
  op_id: string;
  item_op_id: string | null;
  descricao: string;
  quantidade_necessaria: number;
  unidade: string | null;
  tem_no_galpao: boolean;
  quantidade_galpao: number;
  precisa_comprar: boolean;
  quantidade_comprar: number;
  status: "solicitado" | "comprado" | "entregue" | "cancelado";
  previsao_entrega: string | null;
  destino_entrega: string | null;
  observacoes: string | null;
  created_at: string;
}
```

**Adicionar estado de aba ativa e estados de materiais:**
```typescript
const [abaAtiva, setAbaAtiva] = useState<"itens" | "materiais">("itens");
const [materiais, setMateriais] = useState<MaterialOP[]>([]);
const [loadingMateriais, setLoadingMateriais] = useState(false);
const [modalMaterialAberto, setModalMaterialAberto] = useState(false);

// Estados do formulário de material
const [matDescricao, setMatDescricao] = useState("");
const [matQuantNecessaria, setMatQuantNecessaria] = useState<number>(1);
const [matUnidade, setMatUnidade] = useState("");
const [matTemGalpao, setMatTemGalpao] = useState(false);
const [matQuantGalpao, setMatQuantGalpao] = useState<number>(0);
const [matPrecisaComprar, setMatPrecisaComprar] = useState(true);
const [matQuantComprar, setMatQuantComprar] = useState<number>(1);
const [matObservacoes, setMatObservacoes] = useState("");
const [matItemOpId, setMatItemOpId] = useState<string | null>(null);
const [salvandoMaterial, setSalvandoMaterial] = useState(false);
```

**Funções de materiais:**
```typescript
const carregarMateriais = async () => {
  if (!opId) return;
  setLoadingMateriais(true);
  const { data, error } = await supabase
    .from("materiais_op")
    .select("*")
    .eq("op_id", opId)
    .order("created_at", { ascending: false });
  
  if (!error && data) setMateriais(data);
  setLoadingMateriais(false);
};

const salvarMaterial = async () => {
  if (!matDescricao.trim()) {
    showToast("Informe a descrição do material.", "error");
    return;
  }
  setSalvandoMaterial(true);
  
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase.from("materiais_op").insert([{
    op_id: opId,
    item_op_id: matItemOpId || null,
    descricao: matDescricao.trim(),
    quantidade_necessaria: matQuantNecessaria,
    unidade: matUnidade || null,
    tem_no_galpao: matTemGalpao,
    quantidade_galpao: matTemGalpao ? matQuantGalpao : 0,
    precisa_comprar: matPrecisaComprar,
    quantidade_comprar: matPrecisaComprar ? matQuantComprar : 0,
    status: "solicitado",
    solicitado_por: user?.id || null,
    observacoes: matObservacoes || null,
  }]);
  
  if (error) {
    showToast("Erro ao salvar material: " + error.message, "error");
  } else {
    showToast("Material lançado com sucesso!", "success");
    setModalMaterialAberto(false);
    limparFormMaterial();
    carregarMateriais();
  }
  setSalvandoMaterial(false);
};

const limparFormMaterial = () => {
  setMatDescricao(""); setMatQuantNecessaria(1); setMatUnidade("");
  setMatTemGalpao(false); setMatQuantGalpao(0);
  setMatPrecisaComprar(true); setMatQuantComprar(1);
  setMatObservacoes(""); setMatItemOpId(null);
};

const confirmarRecebimentoMaterial = async (materialId: string) => {
  const { error } = await supabase
    .from("materiais_op")
    .update({ status: "entregue" })
    .eq("id", materialId);
  
  if (error) showToast("Erro: " + error.message, "error");
  else { showToast("Material marcado como recebido!", "success"); carregarMateriais(); }
};
```

**Adicionar na renderização da OP, abas de navegação:**
```tsx
{/* Abas */}
<div className="flex border-b border-gray-200 mb-4">
  <button
    onClick={() => setAbaAtiva("itens")}
    className={`px-4 py-3 text-sm font-medium transition-colors ${
      abaAtiva === "itens"
        ? "border-b-2 border-blue-600 text-blue-600"
        : "text-gray-500 hover:text-gray-700"
    }`}
  >
    📋 Itens da OP
  </button>
  <button
    onClick={() => { setAbaAtiva("materiais"); carregarMateriais(); }}
    className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
      abaAtiva === "materiais"
        ? "border-b-2 border-blue-600 text-blue-600"
        : "text-gray-500 hover:text-gray-700"
    }`}
  >
    🧱 Materiais
    {materiais.filter(m => m.status === "solicitado").length > 0 && (
      <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
        {materiais.filter(m => m.status === "solicitado").length}
      </span>
    )}
  </button>
</div>

{/* Conteúdo das abas */}
{abaAtiva === "materiais" && (
  <div>
    <div className="flex justify-between items-center mb-4">
      <h3 className="font-semibold text-gray-800">Requisição de Materiais</h3>
      <button
        onClick={() => setModalMaterialAberto(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        + Lançar Material
      </button>
    </div>
    
    {loadingMateriais ? (
      <div className="text-center py-8 text-gray-400">Carregando...</div>
    ) : materiais.length === 0 ? (
      <div className="text-center py-8 text-gray-400">
        Nenhum material lançado para esta OP.
      </div>
    ) : (
      <div className="space-y-3">
        {materiais.map(mat => (
          <div key={mat.id} className={`p-4 rounded-xl border ${
            mat.status === "solicitado" ? "border-amber-200 bg-amber-50" :
            mat.status === "comprado" ? "border-blue-200 bg-blue-50" :
            mat.status === "entregue" ? "border-green-200 bg-green-50" :
            "border-gray-200 bg-gray-50"
          }`}>
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{mat.descricao}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Qtd: {mat.quantidade_necessaria} {mat.unidade || "un"}
                  {mat.tem_no_galpao && ` · No galpão: ${mat.quantidade_galpao}`}
                  {mat.precisa_comprar && ` · Comprar: ${mat.quantidade_comprar}`}
                </p>
                {mat.observacoes && (
                  <p className="text-xs text-gray-500 mt-1">{mat.observacoes}</p>
                )}
                {mat.previsao_entrega && (
                  <p className="text-xs text-blue-700 mt-1">📅 Previsão: {mat.previsao_entrega}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  mat.status === "solicitado" ? "bg-amber-200 text-amber-800" :
                  mat.status === "comprado" ? "bg-blue-200 text-blue-800" :
                  mat.status === "entregue" ? "bg-green-200 text-green-800" :
                  "bg-gray-200 text-gray-700"
                }`}>
                  {mat.status === "solicitado" ? "Solicitado" :
                   mat.status === "comprado" ? "Comprado" :
                   mat.status === "entregue" ? "Entregue" : "Cancelado"}
                </span>
                {mat.status === "comprado" && (
                  <button
                    onClick={() => confirmarRecebimentoMaterial(mat.id)}
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    ✓ Confirmar Recebimento
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

**Modal de lançamento de material:**
```tsx
{modalMaterialAberto && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
      <div className="p-5 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Lançar Material</h3>
        <button onClick={() => { setModalMaterialAberto(false); limparFormMaterial(); }}
          className="text-gray-400 hover:text-red-500 p-1 rounded">✕</button>
      </div>
      <div className="p-5 space-y-4">
        {/* Vincular a item específico (opcional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vincular ao item (opcional)</label>
          <select value={matItemOpId || ""} onChange={e => setMatItemOpId(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none">
            <option value="">OP Geral</option>
            {/* itensOp é o array de itens já carregado na página */}
            {itensOp.map(item => (
              <option key={item.id} value={item.id}>{item.descricao}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Material *</label>
          <input value={matDescricao} onChange={e => setMatDescricao(e.target.value)}
            placeholder="Ex: Chapa de aço 2mm" required
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
            <input type="number" min={0.1} step={0.1} value={matQuantNecessaria}
              onChange={e => setMatQuantNecessaria(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
            <input value={matUnidade} onChange={e => setMatUnidade(e.target.value)}
              placeholder="un, kg, m²..." 
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
          </div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={matTemGalpao} onChange={e => setMatTemGalpao(e.target.checked)}
              className="rounded text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Tem no galpão</span>
          </label>
          {matTemGalpao && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Qtd no galpão</label>
              <input type="number" min={0} value={matQuantGalpao}
                onChange={e => setMatQuantGalpao(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
            </div>
          )}
        </div>
        <div className="p-3 bg-amber-50 rounded-lg space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={matPrecisaComprar} onChange={e => setMatPrecisaComprar(e.target.checked)}
              className="rounded text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Precisa comprar</span>
          </label>
          {matPrecisaComprar && (
            <div>
              <label className="block text-xs text-amber-700 mb-1">Qtd para comprar</label>
              <input type="number" min={0.1} step={0.1} value={matQuantComprar}
                onChange={e => setMatQuantComprar(Number(e.target.value))}
                className="w-full px-3 py-2 border border-amber-200 bg-white rounded-lg text-sm outline-none" />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
          <textarea value={matObservacoes} onChange={e => setMatObservacoes(e.target.value)}
            rows={2} placeholder="Especificações, fornecedor preferido..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none resize-none" />
        </div>
      </div>
      <div className="p-5 border-t border-gray-100 flex gap-3">
        <button onClick={salvarMaterial} disabled={salvandoMaterial}
          className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {salvandoMaterial ? "Salvando..." : "Salvar Material"}
        </button>
        <button onClick={() => { setModalMaterialAberto(false); limparFormMaterial(); }}
          className="px-4 py-3 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
```

---

## ⚫ FASE 7 — NOVO MÓDULO: COMPRAS

### 7.1 — Criar tela `app/dashboard/compras/page.tsx`

Esta é uma tela nova, dedicada ao perfil `compras`.

```typescript
"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { usePerfilUsuario } from "../../hooks/usePerfilUsuario";
import { useToast } from "../../components/Toast";
import { AlertModal, useAlert } from "../../components/AlertModal";

interface MaterialSolicitado {
  id: string;
  op_id: string;
  descricao: string;
  quantidade_necessaria: number;
  unidade: string | null;
  quantidade_comprar: number;
  status: string;
  observacoes: string | null;
  previsao_entrega: string | null;
  destino_entrega: string | null;
  created_at: string;
  ordens_producao: {
    numero_op: number;
    orcamentos: {
      numero_orcamento: number;
      clientes: { nome_razao_social: string } | null;
    } | null;
  } | null;
}

export default function ComprasPage() {
  const [materiais, setMateriais] = useState<MaterialSolicitado[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("solicitado");
  const [modalCompraId, setModalCompraId] = useState<string | null>(null);
  const [previsaoEntrega, setPrevisaoEntrega] = useState("");
  const [destinoEntrega, setDestinoEntrega] = useState("");
  const [salvandoCompra, setSalvandoCompra] = useState(false);
  
  const { isAdmin, isCompras, loadingPerfil } = usePerfilUsuario();
  const { showToast } = useToast();
  const { showAlert, alertProps } = useAlert();

  useEffect(() => {
    if (!loadingPerfil) carregarMateriais();
  }, [loadingPerfil, filtroStatus]);

  const carregarMateriais = async () => {
    setLoading(true);
    let query = supabase
      .from("materiais_op")
      .select(`
        *,
        ordens_producao (
          numero_op,
          orcamentos (
            numero_orcamento,
            clientes ( nome_razao_social )
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (filtroStatus !== "todos") query = query.eq("status", filtroStatus);

    const { data, error } = await query;
    if (!error && data) setMateriais(data as unknown as MaterialSolicitado[]);
    setLoading(false);
  };

  const marcarComoComprado = async () => {
    if (!modalCompraId) return;
    setSalvandoCompra(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("materiais_op")
      .update({
        status: "comprado",
        comprado_por: user?.id,
        previsao_entrega: previsaoEntrega || null,
        destino_entrega: destinoEntrega || null,
      })
      .eq("id", modalCompraId);

    if (error) {
      showToast("Erro: " + error.message, "error");
    } else {
      showToast("Material marcado como comprado!", "success");
      setModalCompraId(null);
      setPrevisaoEntrega("");
      setDestinoEntrega("");
      carregarMateriais();
    }
    setSalvandoCompra(false);
  };

  if (!isAdmin && !isCompras) {
    return (
      <div className="p-6 text-center text-gray-500">
        Acesso não autorizado.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Central de Compras</h1>
      <p className="text-gray-500 text-sm mb-6">
        Materiais solicitados pela produção que precisam ser comprados.
      </p>

      {/* Filtro de status */}
      <div className="flex gap-2 flex-wrap mb-6">
        {[
          { value: "solicitado", label: "Solicitados", cor: "amber" },
          { value: "comprado", label: "Comprados", cor: "blue" },
          { value: "entregue", label: "Entregues", cor: "green" },
          { value: "todos", label: "Todos", cor: "gray" },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFiltroStatus(f.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filtroStatus === f.value
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : materiais.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">
          Nenhum material encontrado.
        </div>
      ) : (
        <div className="space-y-3">
          {materiais.map(mat => {
            const op = mat.ordens_producao;
            const orc = op?.orcamentos;
            const cliente = Array.isArray(orc?.clientes) ? orc?.clientes[0] : orc?.clientes;
            
            return (
              <div key={mat.id} className={`bg-white rounded-2xl border p-4 shadow-sm ${
                mat.status === "solicitado" ? "border-amber-200" :
                mat.status === "comprado" ? "border-blue-200" :
                "border-gray-100"
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                        OP #{op?.numero_op} · Orç #{orc?.numero_orcamento}
                      </span>
                      {cliente && (
                        <span className="text-xs text-gray-500">{cliente.nome_razao_social}</span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">{mat.descricao}</p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      Qtd: <strong>{mat.quantidade_comprar} {mat.unidade || "un"}</strong>
                    </p>
                    {mat.observacoes && (
                      <p className="text-xs text-gray-500 mt-1 italic">{mat.observacoes}</p>
                    )}
                    {mat.previsao_entrega && (
                      <p className="text-xs text-blue-700 mt-1">
                        📅 Entrega prevista: {new Date(mat.previsao_entrega + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {mat.destino_entrega && (
                      <p className="text-xs text-purple-700 mt-0.5">📍 Destino: {mat.destino_entrega}</p>
                    )}
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      mat.status === "solicitado" ? "bg-amber-100 text-amber-800" :
                      mat.status === "comprado" ? "bg-blue-100 text-blue-800" :
                      mat.status === "entregue" ? "bg-green-100 text-green-800" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {mat.status === "solicitado" ? "Aguardando compra" :
                       mat.status === "comprado" ? "Comprado" :
                       mat.status === "entregue" ? "Entregue" : mat.status}
                    </span>
                    {mat.status === "solicitado" && (
                      <button
                        onClick={() => setModalCompraId(mat.id)}
                        className="text-sm px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                      >
                        Marcar Comprado
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de confirmação de compra */}
      {modalCompraId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Confirmar Compra</h3>
              <p className="text-sm text-gray-500 mt-1">Informe os detalhes da compra realizada.</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Previsão de Entrega
                </label>
                <input
                  type="date"
                  value={previsaoEntrega}
                  onChange={e => setPrevisaoEntrega(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pessoa / Setor de Destino
                </label>
                <input
                  value={destinoEntrega}
                  onChange={e => setDestinoEntrega(e.target.value)}
                  placeholder="Ex: Metalurgia / Impressão"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button
                onClick={marcarComoComprado}
                disabled={salvandoCompra}
                className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {salvandoCompra ? "Salvando..." : "Confirmar Compra"}
              </button>
              <button
                onClick={() => { setModalCompraId(null); setPrevisaoEntrega(""); setDestinoEntrega(""); }}
                className="px-4 py-3 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal {...alertProps} />
    </div>
  );
}
```

### 7.2 — Atualizar o Menu Lateral (`app/dashboard/layout.tsx`)

**Localizar o `menuItemsAdminVendedor` e adicionar entrada de Compras:**
```typescript
// Dentro de menuItemsAdminVendedor (após Produção):
...(isAdmin ? [{ href: "/dashboard/compras", label: "Compras", icon: "🛒" }] : []),
```

**Adicionar menu para o perfil Compras:**
```typescript
const menuItemsCompras = [
  { href: "/dashboard", label: "Início", icon: "🏠" },
  { href: "/dashboard/compras", label: "Compras", icon: "🛒" },
  { href: "/dashboard/mudar-senha", label: "Segurança", icon: "🔒" },
];

// Na lógica de seleção do menu:
const menuItems = isOperador ? menuItemsOperador 
  : isFinanceiro ? menuItemsFinanceiro 
  : isCompras ? menuItemsCompras          // ← ADICIONAR esta linha
  : menuItemsAdminVendedor;
```

**Adicionar proteção de rota para Compras:**
```typescript
// No useEffect de proteção de rotas:
useEffect(() => {
  if (!loadingPerfil && !isCheckingAuth && isCompras) {
    const rotasPermitidas = ["/dashboard/compras", "/dashboard/mudar-senha", "/dashboard"];
    const acessoPermitido = rotasPermitidas.some(rota => pathname.startsWith(rota));
    if (!acessoPermitido) router.replace("/dashboard/compras");
  }
}, [isCompras, pathname, loadingPerfil, isCheckingAuth, router]);
```

**Adicionar `isCompras` na desestruturação do hook no layout:**
```typescript
const { isAdmin, isOperador, isFinanceiro, isCompras, isDesativado, loadingPerfil } = usePerfilUsuario();
```

### 7.3 — Atualizar Tela de Usuários (`app/dashboard/usuarios/page.tsx`)

**Na lista de opções de função (select de role/função), adicionar a opção Compras:**
```tsx
<option value="compras">Compras</option>
```

---

## ✅ FASE 8 — VERIFICAÇÕES FINAIS

### 8.1 — Checklist de compatibilidade

Após implementar cada fase, verificar:

- [ ] Orçamentos existentes continuam aparecendo no histórico
- [ ] Clientes existentes continuam aparecendo sem o campo email (é nullable)
- [ ] Operadores ainda conseguem acessar a tela de setor
- [ ] Financeiro ainda acessa histórico com filtros
- [ ] Admin continua vendo tudo
- [ ] Vendedor só vê seus orçamentos (incluindo os criados pelo admin onde ele é vendedor)
- [ ] A página `/imprimir/[id]` continua funcionando para OPs e Orçamentos existentes
- [ ] A tabela `materiais_op` foi criada sem erros no Supabase

### 8.2 — Testes por perfil

| Perfil | Rota Principal | Pode criar orçamento | Vê produção | Acessa compras |
|--------|---------------|---------------------|-------------|----------------|
| admin | /dashboard | ✅ | ✅ | ✅ |
| vendedor | /dashboard | ✅ | ❌ | ❌ |
| operador | /dashboard/setor | ❌ | ✅ (seu setor) | ❌ |
| financeiro | /dashboard | ❌ | ❌ | ❌ |
| compras | /dashboard/compras | ❌ | ❌ | ✅ |
| desativado | — (expulso) | ❌ | ❌ | ❌ |

### 8.3 — Ordem de implementação recomendada

```
1. SQL da Fase 1 (banco de dados) → verificar no Supabase
2. Fase 2 (tipos e hooks) → sem impacto em produção
3. Fase 3.1 (email em clientes) → isolado, sem quebrar nada
4. Fase 3.2 (roteamento vendedor) → testar com orçamento de teste
5. Fase 3.3 (exportação) → adicionar UI sem remover nada
6. Fase 3.4 (OP Financeiro) → novo arquivo, sem alterar o existente
7. Fase 4 (botões financeiro) → apenas adicionando botões
8. Fase 5 (status produção) → cuidado para não quebrar fluxo existente
9. Fase 6 (materiais) → tela nova + aba nova
10. Fase 7 (compras) → perfil e tela novos
```

---

## 🎨 PADRÕES DE UI OBRIGATÓRIOS

### Responsividade
- Sempre usar `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` para formulários
- Modais: `fixed inset-0` com `items-end sm:items-center` (abre na base no mobile, centro no desktop)
- Tabelas: esconder no mobile com `hidden md:block`, mostrar cards com `block md:hidden`
- Padding: `p-4 md:p-8` para páginas principais

### Estados de Loading
- Sempre usar `disabled={saving}` em botões de submit
- Sempre mostrar texto alternativo: `{saving ? "Salvando..." : "Salvar"}`
- Spinners: `<svg className="animate-spin ...">` (padrão já existente no projeto)

### Feedback visual
- Sucesso: `showToast("Mensagem", "success")`
- Erro: `showToast("Mensagem", "error")`
- Confirmação destrutiva: `showConfirm("mensagem", { type: "error", ... })`

### Cores dos badges de status
```
pendente          → bg-gray-100 text-gray-700
em_andamento      → bg-blue-100 text-blue-700
em_confeccao      → bg-purple-100 text-purple-700
aguardando_material → bg-amber-100 text-amber-700
finalizado_entregue → bg-green-100 text-green-700
concluido         → bg-emerald-100 text-emerald-700
solicitado (compra) → bg-amber-100 text-amber-800
comprado          → bg-blue-100 text-blue-800
entregue          → bg-green-100 text-green-800
```

---

## 📝 OBSERVAÇÕES IMPORTANTES PARA O AGENTE

1. **NUNCA** deletar ou renomear colunas existentes. Apenas `ADD COLUMN IF NOT EXISTS`.
2. **NUNCA** alterar o comportamento de queries existentes que funcionam. Apenas adicionar condições opcionais.
3. O campo `email` em `clientes` deve ser **nullable** (sem `NOT NULL`).
4. O status `aguardando` em `itens_op` é um valor legado — manter compatibilidade, não remover.
5. A coluna `setor` em `subitens_op` não existe — adicionar via SQL antes de usar.
6. Ao criar `OrdemProducaoFinanceiroPDF.tsx`, **copiar** o original e modificar — não importar um do outro.
7. O hook `usePerfilUsuario` é um **Context** — qualquer adição deve ser feita em **todos os lugares**: interface, estado, setter, reset no signOut, e no Provider value.
8. A rota `/imprimir/[id]` renderiza tanto o orçamento quanto a OP conforme o `action` param — preservar este comportamento ao adicionar `op-financeiro`.
9. Todo acesso ao Supabase usa o client do lado do cliente (`app/lib/supabase.ts`) — não criar novos clients desnecessários.
10. O projeto usa **App Router do Next.js** — todas as páginas com state são `"use client"`.
