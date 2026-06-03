import { useEffect, useState } from "react";
import { Building2, Plus, Copy, Check, ArrowRight, Search, Pencil, Trash2, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { getAuthHeaders } from "../lib/auth";

export default function Empresas() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [copyingToken, setCopyingToken] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const carregarEmpresas = () => {
    fetch("/api/empresas", { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Não autorizado");
        return res.json();
      })
      .then((data) => setEmpresas(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    carregarEmpresas();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setNome("");
    setCnpj("");
    setShowModal(true);
  };

  const openEditModal = (emp: any) => {
    setEditingId(emp.id);
    setNome(emp.nome);
    setCnpj(emp.cnpj);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEditing = editingId !== null;
      const url = isEditing ? `/api/empresas/${editingId}` : "/api/empresas";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders() 
        },
        body: JSON.stringify({ nome, cnpj })
      });

      if (res.ok) {
        setShowModal(false);
        setNome("");
        setCnpj("");
        setEditingId(null);
        carregarEmpresas();
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao salvar empresa.");
      }
    } catch (e) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Deseja realmente excluir esta empresa e todas as suas notas associadas? Essa ação não pode ser desfeita.")) {
      return;
    }
    try {
      const res = await fetch(`/api/empresas/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        carregarEmpresas();
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao excluir empresa.");
      }
    } catch (e) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopyingToken(token);
    setTimeout(() => setCopyingToken(null), 2000);
  };

  const empresasFiltradas = empresas.filter(emp => 
    emp.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.cnpj.includes(searchTerm)
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Empresas</h1>
          <p className="text-gray-500 mt-1">Gerencie suas empresas e acesse os XMLs de forma isolada.</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar empresa..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={openCreateModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Nova Empresa
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {empresasFiltradas.map((emp) => (
          <div key={emp.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-6 flex-1">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditModal(emp)} className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors" title="Editar Empresa">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-gray-500 hover:text-red-600 transition-colors" title="Excluir Empresa">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h2 className="text-lg font-bold text-gray-900 line-clamp-1" title={emp.nome}>{emp.nome}</h2>
              <p className="text-sm text-gray-500 mt-1">CNPJ: {emp.cnpj}</p>
              
              {emp.token && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Token de Instalação</p>
                  <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                    <code className="text-xs text-gray-600 truncate flex-1">{emp.token}</code>
                    <button 
                      onClick={() => copyToken(emp.token)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 bg-white rounded shadow-sm border border-gray-200"
                      title="Copiar Token"
                    >
                      {copyingToken === emp.token ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {emp.export_token && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><LinkIcon className="w-3.5 h-3.5"/> Token de Exportação (API)</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                      <code className="text-xs text-gray-600 truncate flex-1">{emp.export_token}</code>
                      <button 
                        onClick={() => copyToken(emp.export_token)}
                        className="p-1.5 text-gray-400 hover:text-green-600 bg-white rounded shadow-sm border border-gray-200"
                        title="Copiar Token"
                      >
                        {copyingToken === emp.export_token ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-500 bg-gray-100 p-2 rounded">
                      <span className="font-semibold text-gray-700">Endpoint GET:</span>
                      <br/>
                      <code className="break-all">{window.location.origin}/api/v1/export/notas/{emp.export_token}</code>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <Link 
              to={`/empresas/${emp.id}`} 
              className="bg-gray-50 border-t border-gray-200 p-4 font-medium text-sm text-blue-600 flex items-center justify-between hover:bg-blue-50 transition-colors"
            >
              Acessar Notas Fiscais
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
        
        {empresas.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-300 rounded-xl">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Nenhuma empresa encontrada</h3>
            <p className="text-gray-500 mt-1">Clique no botão Nova Empresa para começar.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">{editingId ? "Editar Empresa" : "Cadastrar Empresa"}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Empresa Exemplo LTDA"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                <input 
                  type="text" 
                  required
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                />
              </div>
              <div className="pt-4 flex gap-3 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
