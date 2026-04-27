import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

export default function Empresas() {
  const [empresas, setEmpresas] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/empresas")
      .then((res) => res.json())
      .then(setEmpresas)
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Empresas</h1>
        <p className="text-gray-500 mt-1">Destinatários coletados automaticamente através dos processamentos de notas.</p>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-medium w-16">ID</th>
                <th className="px-6 py-4 font-medium">Razão Social</th>
                <th className="px-6 py-4 font-medium">CNPJ / CPF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {empresas.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    Nenhuma empresa encontrada. O Agente precisa processar o primeiro XML.
                  </td>
                </tr>
              )}
              {empresas.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-500">#{emp.id}</td>
                  <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <Building2 className="w-4 h-4" />
                    </div>
                    {emp.nome}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{emp.cnpj}</td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}
