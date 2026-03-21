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

  useEffect(() => {
    const processarPDF = async () => {
      try {
        const { data: orcamento, error: erroOrc } = await supabase
          .from("orcamentos")
          .select(`
            *,
            clientes ( nome_razao_social, cpf_cnpj, telefone, endereco, contato_nome, rua_numero, bairro, cidade, uf, cep ),
            vendedores ( nome, telefone, email )
          `)
          .eq("id", id)
          .single();

        if (erroOrc) throw erroOrc;

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

        if (action === "download") {
          const a = document.createElement("a");
          a.href = urlCriada;
          a.download = `Orcamento_${String(dadosCompletos.orcamento.numero_orcamento).padStart(5, "0")}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => window.close(), 100);
        } else {
          window.location.replace(urlCriada);
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

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#323639]">
      <p className="text-gray-400 text-sm font-semibold tracking-[0.2em] uppercase animate-pulse">
        Gerando PDF...
      </p>
    </div>
  );
}