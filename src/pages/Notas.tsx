import { useEffect, useState } from "react";
import { formatCurrency } from "../lib/utils";
import { Search, Download, FileJson } from "lucide-react";
import { format } from "date-fns";

export default function Notas() {
  const [notas, setNotas] = useState<any[]>([]);
  const [filtros, setFiltros] = useState({
    data_inicio: "",
    data_fim: "",
    fornecedor: ""
  });

  const carregarNotas = () => {
    const params = new URLSearchParams();
    if (filtros.data_inicio) params.append("data_inicio", filtros.data_inicio);
    if (filtros.data_fim) params.append("data_fim", filtros.data_fim);
    if (filtros.fornecedor) params.append("fornecedor", filtros.fornecedor);

    fetch(`/api/notas?${params.toString()}`)
      .then((res) => res.json())
      .then(setNotas)
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    carregarNotas();
  }, [filtros]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Notas Fiscais</h1>
        <p className="text-gray-500 mt-1">Acervo centralizado de NF-e e NFC-e recebidas pelo Agente.</p>
      </header>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-end">
        <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <span className="text-sm font-medium text-gray-700 w-full mb-1">Buscar Fornecedor</span>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Ex: Coca Cola..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={filtros.fornecedor}
              onChange={(e) => setFiltros({...filtros, fornecedor: e.target.value})}
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700">Data Inicial</span>
          <input 
            type="date"
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={filtros.data_inicio}
            onChange={(e) => setFiltros({...filtros, data_inicio: e.target.value})}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700">Data Final</span>
          <input 
            type="date"
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={filtros.data_fim}
            onChange={(e) => setFiltros({...filtros, data_fim: e.target.value})}
          />
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-medium">Data Emissão</th>
                <th className="px-6 py-4 font-medium">Modelo</th>
                <th className="px-6 py-4 font-medium">Fornecedor</th>
                <th className="px-6 py-4 font-medium">Destinatário</th>
                <th className="px-6 py-4 font-medium">Valor Total</th>
                <th className="px-6 py-4 font-medium text-center">XML</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {notas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Nenhuma nota fiscal encontrada para o filtro.
                  </td>
                </tr>
              )}
              {notas.map((nota) => (
                <tr key={nota.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-900">
                    {nota.data_emissao ? format(new Date(nota.data_emissao), 'dd/MM/yyyy HH:mm') : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                      Mod. {nota.modelo}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{nota.fornecedor}</div>
                    <div className="text-xs text-gray-500">{nota.cnpj_fornecedor}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{nota.nome_empresa}</div>
                    <div className="text-xs text-gray-500">{nota.cnpj_empresa}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-medium">
                    {formatCurrency(nota.valor_total)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <a 
                      href={nota.caminho_arquivo} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                      download
                    >
                      <Download className="w-4 h-4" />
                      Baixar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
