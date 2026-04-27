import { useEffect, useState } from "react";
import { formatCurrency } from "../lib/utils";
import { Building2, FileText, TrendingUp, Upload } from "lucide-react";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then(setData)
      .catch((err) => console.error(err));
  }, []);

  if (!data) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Visão geral do volume de notas fiscais processadas.</p>
        </div>
      </header>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard 
          title="Total de Notas" 
          value={data.total_notas} 
          icon={FileText} 
          trend="+ novos hoje" 
        />
        <MetricCard 
          title="Valor Total" 
          value={formatCurrency(data.total_valor || 0)} 
          icon={TrendingUp} 
          trend="acumulado" 
        />
        <MetricCard 
          title="Empresas (Destinatários)" 
          value={data.total_empresas} 
          icon={Building2} 
          trend="cadastros" 
        />
      </div>

      {/* Competências Table */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Resumo por Competência</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-medium">Competência (Mês/Ano)</th>
                <th className="px-6 py-4 font-medium text-right">Qtd. Notas</th>
                <th className="px-6 py-4 font-medium text-right">Soma dos Valores</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.competencias.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    Nenhum dado encontrado para exibir.
                  </td>
                </tr>
              )}
              {data.competencias.map((comp: any) => (
                <tr key={comp.mes} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{comp.mes || "S/ Data"}</td>
                  <td className="px-6 py-4 text-right text-gray-600">{comp.qtd}</td>
                  <td className="px-6 py-4 text-right text-gray-900 font-medium">
                    {formatCurrency(comp.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, trend }: any) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-3xl font-bold text-gray-900 mt-2">{value}</h3>
        <p className="text-xs text-green-600 mt-2">{trend}</p>
      </div>
      <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}
