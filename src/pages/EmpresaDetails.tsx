import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { formatCurrency } from "../lib/utils";
import { Search, Download, ArrowLeft, Building2, Calendar, FileDown } from "lucide-react";
import { format } from "date-fns";

export default function EmpresaDetails() {
  const { id } = useParams();
  const [empresa, setEmpresa] = useState<any>(null);
  const [notas, setNotas] = useState<any[]>([]);
  const [totalNotas, setTotalNotas] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  
  const [filtros, setFiltros] = useState({
    data_inicio: "",
    data_fim: "",
    fornecedor: "",
    tipo: "",
    modelo: "",
    status: ""
  });
  const [selectedNotas, setSelectedNotas] = useState<number[]>([]);
  const [isSelectAllContext, setIsSelectAllContext] = useState(false);

  useEffect(() => {
    fetch(`/api/empresas`)
      .then((res) => res.json())
      .then(data => {
         const found = data.find((e: any) => e.id.toString() === id);
         setEmpresa(found);
      });
  }, [id]);

  const carregarNotas = () => {
    if (!id) return;
    const params = new URLSearchParams();
    params.append("empresa_id", id);
    params.append("page", page.toString());
    params.append("limit", "20");
    if (filtros.data_inicio) params.append("data_inicio", filtros.data_inicio);
    if (filtros.data_fim) params.append("data_fim", filtros.data_fim);
    if (filtros.fornecedor) params.append("fornecedor", filtros.fornecedor);
    if (filtros.tipo) params.append("tipo", filtros.tipo);
    if (filtros.modelo) params.append("modelo", filtros.modelo);
    if (filtros.status) params.append("status", filtros.status);

    fetch(`/api/notas?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setNotas(data.notas || []);
        setTotalNotas(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setSelectedNotas([]); 
        setIsSelectAllContext(false);
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    setPage(1); // Reset page to 1 when filters change
  }, [filtros]);

  useEffect(() => {
    carregarNotas();
  }, [id, filtros, page]);

  const handleSelectAllContext = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsSelectAllContext(checked);
    if (checked) {
      setSelectedNotas(notas.map(n => n.id));
    } else {
      setSelectedNotas([]);
    }
  };

  const handleSelectRow = (notaId: number) => {
    if (selectedNotas.includes(notaId)) {
      setSelectedNotas(selectedNotas.filter(id => id !== notaId));
      setIsSelectAllContext(false);
    } else {
      setSelectedNotas([...selectedNotas, notaId]);
    }
  };

  const handleDownloadBatch = () => {
    if (isSelectAllContext && totalNotas > 0) {
      const params = new URLSearchParams();
      params.append("empresa_id", id!);
      if (filtros.data_inicio) params.append("data_inicio", filtros.data_inicio);
      if (filtros.data_fim) params.append("data_fim", filtros.data_fim);
      if (filtros.fornecedor) params.append("fornecedor", filtros.fornecedor);
      if (filtros.tipo) params.append("tipo", filtros.tipo);
      if (filtros.modelo) params.append("modelo", filtros.modelo);
      if (filtros.status) params.append("status", filtros.status);
      window.open(`/api/download-filter?${params.toString()}`, '_blank');
    } else if (selectedNotas.length > 0) {
      window.open(`/api/download-batch?ids=${selectedNotas.join(',')}`, '_blank');
    }
  };

  if (!empresa) return <div className="p-8">Carregando dados da empresa...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/empresas" className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Building2 className="text-blue-600 w-6 h-6" /> 
            {empresa.nome}
          </h1>
          <p className="text-gray-500 text-sm">CNPJ: {empresa.cnpj}</p>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <label className="flex flex-col gap-1.5 lg:col-span-2">
          <span className="text-sm font-medium text-gray-700">Buscar Fornecedor</span>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Ex: Coca Cola..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
              value={filtros.fornecedor}
              onChange={(e) => setFiltros({...filtros, fornecedor: e.target.value})}
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700">Tipo</span>
          <select 
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            value={filtros.tipo}
            onChange={(e) => setFiltros({...filtros, tipo: e.target.value})}
          >
            <option value="">Todos</option>
            <option value="Entrada">Entrada</option>
            <option value="Saida">Saída</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700">Modelo</span>
          <select 
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            value={filtros.modelo}
            onChange={(e) => setFiltros({...filtros, modelo: e.target.value})}
          >
            <option value="">Todos</option>
            <option value="55">NF-e (55)</option>
            <option value="65">NFC-e (65)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700">Status</span>
          <select 
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            value={filtros.status}
            onChange={(e) => setFiltros({...filtros, status: e.target.value})}
          >
            <option value="">Todos</option>
            <option value="Autorizada">Autorizada</option>
            <option value="Cancelada">Cancelada</option>
            <option value="Inutilizada">Inutilizada</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700">Período Inicial</span>
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input 
              type="date"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
              value={filtros.data_inicio}
              onChange={(e) => setFiltros({...filtros, data_inicio: e.target.value})}
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700">Período Final</span>
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input 
              type="date"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
              value={filtros.data_fim}
              onChange={(e) => setFiltros({...filtros, data_fim: e.target.value})}
            />
          </div>
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 font-medium whitespace-nowrap">
          {totalNotas} nota(s) encontrada(s)
        </p>
        
        {isSelectAllContext ? (
          <div className="flex-1 px-4 flex items-center justify-center">
            <p className="text-sm text-blue-700 bg-blue-50 font-medium px-4 py-1.5 rounded-full border border-blue-100">
              Todas as <strong>{totalNotas}</strong> notas deste filtro estão selecionadas para baixar.
            </p>
          </div>
        ) : selectedNotas.length > 0 ? (
          <div className="flex-1 px-4 flex items-center justify-center">
            <p className="text-sm text-blue-700 bg-blue-50 font-medium px-4 py-1.5 rounded-full border border-blue-100">
              <strong>{selectedNotas.length}</strong> nota(s) selecionada(s) nesta página. 
              {totalNotas > selectedNotas.length && (
                <button 
                  onClick={() => setIsSelectAllContext(true)}
                  className="ml-2 underline hover:text-blue-900"
                >
                  Selecionar todas as {totalNotas} notas do filtro.
                </button>
              )}
            </p>
          </div>
        ) : <div className="flex-1" />}

        <button 
          disabled={!isSelectAllContext && selectedNotas.length === 0}
          onClick={handleDownloadBatch}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FileDown className="w-4 h-4" />
          Baixar {selectedNotas.length > 0 ? `(${selectedNotas.length})` : ''} XMLs
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-medium w-4">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    onChange={handleSelectAllContext}
                    checked={notas.length > 0 && selectedNotas.length === notas.length}
                  />
                </th>
                <th className="px-6 py-4 font-medium">Emissão</th>
                <th className="px-6 py-4 font-medium">Mod/Tipo</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Fornecedor</th>
                <th className="px-6 py-4 font-medium">Computador</th>
                <th className="px-6 py-4 font-medium">Valor Total</th>
                <th className="px-6 py-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {notas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <FileDown className="w-8 h-8 text-gray-300 mb-2" />
                      <p>Nenhuma nota fiscal encontrada para o filtro.</p>
                    </div>
                  </td>
                </tr>
              )}
              {notas.map((nota) => (
                <tr key={nota.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      onChange={() => handleSelectRow(nota.id)}
                      checked={selectedNotas.includes(nota.id)}
                    />
                  </td>
                  <td className="px-6 py-4 text-gray-900">
                    {nota.data_emissao ? format(new Date(nota.data_emissao), 'dd/MM/yyyy HH:mm') : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                        {nota.modelo === '55' ? 'NF-e' : 'NFC-e'}
                      </span>
                      {nota.tipo && (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${nota.tipo === 'Entrada' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {nota.tipo}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {nota.status ? (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${nota.status === 'Autorizada' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                        {nota.status}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 truncate max-w-[200px]">{nota.fornecedor}</div>
                    <div className="text-xs text-gray-500">{nota.cnpj_fornecedor}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{nota.hostname || 'Desconhecido'}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-medium">
                    {formatCurrency(nota.valor_total)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <a 
                      href={nota.caminho_arquivo} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      download
                      title="Baixar XML 1"
                    >
                      <Download className="w-4 h-4 cursor-pointer" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <p className="text-sm text-gray-500">
              Mostrando página <span className="font-medium text-gray-900">{page}</span> de <span className="font-medium text-gray-900">{totalPages}</span>
            </p>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-white disabled:opacity-50 transition-colors"
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                let p = page - 2 + idx;
                if (page < 3) p = idx + 1;
                else if (page > totalPages - 2) p = totalPages - 4 + idx;
                
                if (p > 0 && p <= totalPages) {
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 py-1 text-sm border rounded transition-colors ${
                        page === p 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'border-gray-300 hover:bg-white'
                      }`}
                    >
                      {p}
                    </button>
                  );
                }
                return null;
              })}
              <button 
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-white disabled:opacity-50 transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
