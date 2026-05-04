"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { usePerfilUsuario } from "../../hooks/usePerfilUsuario";
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
      showAlert("Erro: " + error.message, { type: "error", title: "Erro" });
    } else {
      showAlert("Material marcado como comprado!", { type: "success", title: "OK" });
      setModalCompraId(null);
      setPrevisaoEntrega("");
      setDestinoEntrega("");
      carregarMateriais();
    }
    setSalvandoCompra(false);
  };

  if (loadingPerfil) {
    return <div className="p-6 text-center text-gray-500">Carregando...</div>;
  }

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
