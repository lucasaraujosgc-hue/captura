import { useState, useEffect } from "react";
import { getAuthHeaders } from "../lib/auth";
import { HardDrive, Search, Trash2, AlertCircle, File, ChevronLeft, ChevronRight } from "lucide-react";

export default function Armazenamento() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [filtros, setFiltros] = useState({
    empresa_id: "",
    data_inicio: "",
    data_fim: "",
    tamanho_min_kb: "",
    tamanho_max_kb: ""
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  
  const [notas, setNotas] = useState<any[]>([]);
  const [totalNotas, setTotalNotas] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetch("/api/empresas", { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Não autorizado");
        return res.json();
      })
      .then((data) => setEmpresas(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err));
  }, []);

  const handleSearch = async (pageNum = 1) => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      if (filtros.empresa_id) params.append("empresa_id", filtros.empresa_id);
      if (filtros.data_inicio) params.append("data_inicio", filtros.data_inicio);
      if (filtros.data_fim) params.append("data_fim", filtros.data_fim);
      if (filtros.tamanho_min_kb) params.append("tamanho_min", (Number(filtros.tamanho_min_kb) * 1024).toString());
      if (filtros.tamanho_max_kb) params.append("tamanho_max", (Number(filtros.tamanho_max_kb) * 1024).toString());
      params.append("page", pageNum.toString());
      params.append("limit", "15");

      const res = await fetch(`/api/notas?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      
      if (res.ok) {
        setNotas(data.notas || []);
        setTotalNotas(data.total || 0);
        setTotalSize(data.totalSize || 0);
        setTotalPages(data.totalPages || 1);
        setPage(data.page || 1);
      } else {
        alert(data.error || "Erro ao buscar notas.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro na comunicação com o servidor.");
    } finally {
      setIsSearching(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDelete = async () => {
    if (!window.confirm("Atenção: Isso excluirá PERMANENTEMENTE os arquivos e os registros no banco de dados baseados nos filtros. Deseja continuar?")) {
      return;
    }

    setIsDeleting(true);
    setSuccessMsg("");
    try {
      const params = new URLSearchParams();
      if (filtros.empresa_id) params.append("empresa_id", filtros.empresa_id);
      if (filtros.data_inicio) params.append("data_inicio", filtros.data_inicio);
      if (filtros.data_fim) params.append("data_fim", filtros.data_fim);
      if (filtros.tamanho_min_kb) params.append("tamanho_min", (Number(filtros.tamanho_min_kb) * 1024).toString());
      if (filtros.tamanho_max_kb) params.append("tamanho_max", (Number(filtros.tamanho_max_kb) * 1024).toString());

      const res = await fetch(`/api/notas?${params.toString()}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccessMsg(`Foram apagadas ${data.deleted} notas com sucesso.`);
        handleSearch(1); // Refresh list
        setTimeout(() => setSuccessMsg(""), 5000);
      } else {
        alert(data.error || "Erro ao excluir notas.");
      }
    } catch (err) {
      alert("Erro na comunicação com o servidor.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
          <HardDrive className="w-8 h-8 text-blue-600" />
          Galeria de Arquivos
        </h1>
        <p className="text-gray-500 mt-2">Visão geral do armazenamento, pesquisa de notas e limpeza em massa.</p>
      </header>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm">
          <span>{successMsg}</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-500" />
            Filtros
          </div>
          <button
            onClick={() => handleSearch(1)}
            disabled={isSearching}
            className="bg-blue-600 text-white font-medium py-1.5 px-4 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:bg-gray-400"
          >
            <Search className="w-4 h-4" />
            {isSearching ? "Buscando..." : "Buscar"}
          </button>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-2">
          <label className="flex flex-col gap-1.5 lg:col-span-2">
            <span className="text-sm font-medium text-gray-700">Empresa</span>
            <select 
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              value={filtros.empresa_id}
              onChange={e => setFiltros({...filtros, empresa_id: e.target.value})}
            >
              <option value="">Todas as Empresas</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nome} ({emp.cnpj})</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-700">Data Início</span>
            <input 
              type="date"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              value={filtros.data_inicio}
              onChange={e => setFiltros({...filtros, data_inicio: e.target.value})}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-700">Data Fim</span>
            <input 
              type="date"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              value={filtros.data_fim}
              onChange={e => setFiltros({...filtros, data_fim: e.target.value})}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-700">Tamanho Min (KB)</span>
            <input 
              type="number"
              placeholder="Ex: 5"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              value={filtros.tamanho_min_kb}
              onChange={e => setFiltros({...filtros, tamanho_min_kb: e.target.value})}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-700">Tamanho Max (KB)</span>
            <input 
              type="number"
              placeholder="Ex: 500"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              value={filtros.tamanho_max_kb}
              onChange={e => setFiltros({...filtros, tamanho_max_kb: e.target.value})}
            />
          </label>
        </div>
      </div>

      {(totalNotas > 0 || isSearching) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
          <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row items-center justify-between bg-gray-50 gap-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Encontrados: <strong className="text-gray-900">{totalNotas} arquivos</strong>
              </span>
              <span className="text-sm text-gray-600">
                Tamanho Total: <strong className="text-blue-700">{formatBytes(totalSize)}</strong>
              </span>
            </div>
            
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-sm bg-red-100 text-red-700 font-bold py-1.5 px-4 rounded hover:bg-red-200 transition flex items-center gap-2 disabled:bg-gray-200 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              title="Excluir notas exibidas neste filtro"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? "Excluindo..." : "Excluir Este Filtro"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-medium text-gray-600 w-1/4">Empresa</th>
                  <th className="px-6 py-4 font-medium text-gray-600 w-1/3">Chave NFe</th>
                  <th className="px-6 py-4 font-medium text-gray-600">Data</th>
                  <th className="px-6 py-4 font-medium text-gray-600 text-right">Tamanho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {notas.map(nota => (
                  <tr key={nota.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900 truncate max-w-[200px]">
                      {nota.nome_empresa}
                    </td>
                    <td className="px-6 py-3 text-gray-600 font-mono text-xs truncate max-w-[250px]">
                      {nota.chave_nfe}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {nota.data_emissao ? new Date(nota.data_emissao).toLocaleDateString("pt-BR") : "N/D"}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-900">
                      {formatBytes(nota.tamanho_arquivo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <p className="text-sm text-gray-500">
                Página <span className="font-medium text-gray-900">{page}</span> de <span className="font-medium text-gray-900">{totalPages}</span>
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleSearch(page - 1)}
                  disabled={page === 1}
                  className="p-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <button 
                  onClick={() => handleSearch(page + 1)}
                  disabled={page === totalPages}
                  className="p-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
