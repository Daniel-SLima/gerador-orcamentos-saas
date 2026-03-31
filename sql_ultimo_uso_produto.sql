-- ============================================================
-- MIGRAÇÃO: Rastreamento de Último Uso de Produto
-- Execute este script no Supabase → SQL Editor
-- ============================================================

-- 1. Adiciona a coluna "ultimo_uso" na tabela produtos
--    (nullable — produtos novos não têm histórico ainda)
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS ultimo_uso TIMESTAMPTZ DEFAULT NULL;

-- 2. (Opcional) Popula o ultimo_uso retroativamente
--    para produtos que já foram usados em orçamentos
UPDATE produtos p
SET ultimo_uso = subquery.ultimo
FROM (
  SELECT io.produto_id, MAX(o.created_at) AS ultimo
  FROM itens_orcamento io
  JOIN orcamentos o ON o.id = io.orcamento_id
  GROUP BY io.produto_id
) subquery
WHERE p.id = subquery.produto_id;

-- ============================================================
-- COLUNA AUXILIAR PARA CONFIGURAÇÃO FUTURA DE PRAZO DE EXPIRAÇÃO
-- (Fica na tabela de perfil da empresa — configuração global)
-- ============================================================
ALTER TABLE empresa_perfil
  ADD COLUMN IF NOT EXISTS prazo_expiracao_produto_dias INTEGER DEFAULT NULL;
-- NULL = sem expiração automática (padrão seguro até o cliente definir)

-- ============================================================
-- RESULTADO ESPERADO:
--   - produtos.ultimo_uso: timestamp da última vez que o produto
--     foi incluído em algum orçamento
--   - empresa_perfil.prazo_expiracao_produto_dias: quando for
--     definido (ex: 180), produtos sem uso há mais dias que esse
--     valor serão marcados como expirados no sistema
-- ============================================================
