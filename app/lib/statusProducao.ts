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
