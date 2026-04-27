"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { pdf } from "@react-pdf/renderer";
import { DadosImpressao, Cliente, Empresa, ItemOrcamento, Orcamento, Anexo } from "./types";
import { OrcamentoPDF } from "./OrcamentoPDF";
import { OrdemProducaoPDF } from "./OrdemProducaoPDF";

export default function ImprimirOrcamento() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const action = searchParams.get("action") || "view";

  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfNome, setPdfNome] = useState<string>("");

  useEffect(() => {
    const processarPDF = async () => {
      try {
        // C03 — Verificar quem está logado antes de gerar o PDF
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("Você precisa estar logado para visualizar este orçamento.");
          return;
        }

        // Verificar função do usuário
        const { data: perfilData } = await supabase
          .from("perfis_usuarios")
          .select("funcao")
          .eq("user_id", user.id)
          .single();
        const funcao = perfilData?.funcao?.trim().toLowerCase();
        const isAdmin = funcao === "admin";
        const isOperador = funcao === "operador";

        // Buscar o orçamento
        let orcamentoQuery = supabase
          .from("orcamentos")
          .select(`
            *,
            clientes ( nome_razao_social, cpf_cnpj, telefone, endereco, contato_nome, rua_numero, bairro, cidade, uf, cep, inscricao_estadual, inscricao_municipal ),
            vendedores ( nome, telefone, email )
          `)
          .eq("id", id);

        // C03 — Vendedor só pode ver seus próprios orçamentos
        // Admin e Operador podem ver qualquer orçamento (operadores precisam ver OP de qualquer vendedor)
        // Financeiro também pode ver todos os orçamentos
        const isFinanceiro = funcao === "financeiro";
        if (!isAdmin && !isOperador && !isFinanceiro) {
          orcamentoQuery = orcamentoQuery.eq("user_id", user.id);
        }

        const { data: orcamento, error: erroOrc } = await orcamentoQuery.single();

        if (erroOrc || !orcamento) {
          setError("Orçamento não encontrado ou você não tem permissão para visualizá-lo.");
          return;
        }

        const { data: itens, error: erroItens } = await supabase
          .from("itens_orcamento")
          .select(`*, produtos ( imagem_url )`)
          .eq("orcamento_id", id);

        if (erroItens) throw erroItens;

        const { data: empresa } = await supabase
          .from("empresa_perfil")
          .select("*")
          .limit(1)
          .single();

        const { data: anexosData } = await supabase
          .from("orcamento_anexos")
          .select("*")
          .eq("orcamento_id", id);

        const dadosCompletos: DadosImpressao = {
          orcamento: orcamento as unknown as Orcamento,
          cliente: Array.isArray(orcamento.clientes)
            ? orcamento.clientes[0]
            : (orcamento.clientes as unknown as Cliente),
          itens: itens as ItemOrcamento[],
          empresa: empresa as Empresa | null,
          anexos: (anexosData as Anexo[]) || [],
        };

        // Escolhe o componente correto de acordo com o tipo de documento
        const isOP = action === "op";
        const documento = isOP
          ? <OrdemProducaoPDF dados={dadosCompletos} />
          : <OrcamentoPDF dados={dadosCompletos} />;

        const blob = await pdf(documento).toBlob();
        const urlCriada = URL.createObjectURL(blob);
        const nomeArquivo = isOP
          ? `OP_${String(dadosCompletos.orcamento.numero_orcamento).padStart(5, "0")}.pdf`
          : `Orcamento_${String(dadosCompletos.orcamento.numero_orcamento).padStart(5, "0")}.pdf`;

        if (action === "download") {
          const a = document.createElement("a");
          a.href = urlCriada;
          a.download = nomeArquivo;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(urlCriada), 100);
        } else {
          setPdfUrl(urlCriada);
          setPdfNome(nomeArquivo);
        }
      } catch (error) {
        console.error("Erro:", error);
        setError("Não foi possível gerar o orçamento.");
      }
    };

    if (id) processarPDF();
  }, [id, action]);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center text-red-500 font-bold bg-gray-900">
        {error}
      </div>
    );
  }

  if (pdfUrl) {
    return (
      <div className="h-screen w-full flex flex-col bg-[#323639]">
        <div className="flex items-center justify-between px-4 py-2 bg-[#404040] border-b border-[#555]">
          <span className="text-gray-300 text-sm font-medium">{pdfNome}</span>
          <a
            href={pdfUrl}
            download={pdfNome}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-colors"
          >
            ⬇ Baixar PDF
          </a>
        </div>
        <iframe
          src={pdfUrl}
          className="flex-1 w-full border-none"
          title={pdfNome}
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#323639]">
      <p className="text-gray-400 text-sm font-semibold tracking-[0.2em] uppercase animate-pulse">
        Gerando PDF...
      </p>
    </div>
  );
}