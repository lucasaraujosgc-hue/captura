import { useState, useEffect } from "react";
import { getAuthHeaders } from "../lib/auth";
import { HardDrive, Search, Trash2, AlertCircle } from "lucide-react";

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

  useEffect(() => {
    fetch("/api/empresas", { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Não autorizado");
        return res.json();
      })
      .then((data) => setEmpresas(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err));
  }, []);

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
        // Reload storage bytes from header via quick event dispatch or reload
        setTimeout(() => window.location.reload(), 2000);
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
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
          <HardDrive className="w-8 h-8 text-blue-600" />
          Gerenciamento de Armazenamento
        </h1>
        <p className="text-gray-500 mt-2">Filtre notas fiscais por tamanho, data e empresa para realizar exclusões em massa e liberar espaço em disco.</p>
      </header>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{successMsg}</span>
          <span className="text-sm">A página será atualizada em breve...</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-3">
          <Search className="w-5 h-5 text-gray-500" />
          Filtros de Exclusão
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">Empresa</span>
            <select 
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              value={filtros.empresa_id}
              onChange={e => setFiltros({...filtros, empresa_id: e.target.value})}
            >
              <option value="">Todas as Empresas</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nome} ({emp.cnpj})</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">Data Inicial</span>
            <input 
              type="date"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              value={filtros.data_inicio}
              onChange={e => setFiltros({...filtros, data_inicio: e.target.value})}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">Data Final</span>
            <input 
              type="date"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              value={filtros.data_fim}
              onChange={e => setFiltros({...filtros, data_fim: e.target.value})}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">Tamanho Mínimo (KB)</span>
            <input 
              type="number"
              placeholder="Ex: 5"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              value={filtros.tamanho_min_kb}
              onChange={e => setFiltros({...filtros, tamanho_min_kb: e.target.value})}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">Tamanho Máximo (KB)</span>
            <input 
              type="number"
              placeholder="Ex: 500"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              value={filtros.tamanho_max_kb}
              onChange={e => setFiltros({...filtros, tamanho_max_kb: e.target.value})}
            />
          </label>
        </div>

        <div className="bg-red-50 border border-red-100 rounded-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-900">Ação Destrutiva</h3>
              <p className="text-sm text-red-700 mt-1">
                Todas as notas que corresponderem aos filtros acima serão excluídas permanentemente do banco de dados e os arquivos XML serão removidos do disco rígido. Esta ação não pode ser desfeita. Se você deixar os filtros em branco, <strong>TODAS AS NOTAS SERÃO EXCLUÍDAS</strong>.
              </p>
            </div>
          </div>
          
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="shrink-0 bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-5 h-5" />
            {isDeleting ? "Excluindo..." : "Excluir Notas"}
          </button>
        </div>
      </div>
    </div>
  );
}
