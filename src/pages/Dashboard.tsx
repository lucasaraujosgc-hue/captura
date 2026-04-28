import { useEffect, useState } from "react";
import { formatCurrency } from "../lib/utils";
import { ArrowDown, PieChart, BarChart3 } from "lucide-react";
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const COLORS = ['#3b82f6', '#4f46e5', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef'];

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then(setData)
      .catch((err) => console.error(err));
  }, []);

  if (!data) {
    return <div className="p-8 text-center text-gray-500">Carregando dashboard...</div>;
  }

  // Formatting for Recharts
  const pieData = data.topFaturamento.map((item: any, idx: number) => ({
    name: item.nome,
    value: item.totalFaturamento,
    fill: COLORS[idx % COLORS.length]
  }));

  const barData = data.topVolume.map((item: any, idx: number) => ({
    name: item.nome.substring(0, 15) + "...",
    fullName: item.nome,
    arquivos: item.totalArquivos,
    fill: COLORS[idx % COLORS.length]
  }));

  const nowStr = new Date().toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 shadow-sm border border-gray-200 relative flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Baixados no mês</p>
            <div className="flex items-end gap-3 mt-2">
              <h3 className="text-4xl font-black text-gray-900">{data.total_notas.toLocaleString('pt-BR')}</h3>
            </div>
            <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
               Atualizado em {nowStr}
            </p>
          </div>
          <div className="bg-blue-600 text-white p-2 rounded">
            <ArrowDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-6 shadow-sm border border-gray-200 flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">CNPJs</p>
            <h3 className="text-4xl font-black text-gray-900 mt-2">{data.total_empresas}</h3>
            <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
               Atualizado em {nowStr}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 shadow-sm border border-gray-200 flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Usuários</p>
            <h3 className="text-4xl font-black text-gray-900 mt-2">1</h3>
            <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
               Atualizado em {nowStr}
            </p>
          </div>
        </div>
      </div>

      {/* ReportS Banner */}
      <div className="bg-blue-700 text-white font-bold text-lg px-6 py-3 flex items-center gap-2 rounded-sm">
        <BarChart3 className="w-5 h-5" /> ReportS
      </div>

      <div className="bg-white p-6 shadow-sm border border-gray-200">
        
        {/* Top Faturamento */}
        <div className="mb-12">
          <div className="flex items-center justify-between border-b pb-4 mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <PieChart className="w-5 h-5" /> Top Empresas Faturamento
            </h2>
          </div>

          {data.topFaturamento.length === 0 ? (
            <p className="text-gray-500">Nenhum dado encontrado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={0}
                    >
                      {pieData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {data.topFaturamento.map((item: any, idx: number) => (
                  <div key={item.cnpj} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="font-medium text-gray-700">{item.nome} / {item.cnpj}</span>
                    </div>
                    <span className="font-bold text-gray-900">{formatCurrency(item.totalFaturamento)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top Volume */}
        <div>
          <div className="flex items-center justify-between border-b pb-4 mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Top Empresas Volume de Arquivos
            </h2>
          </div>

          {data.topVolume.length === 0 ? (
            <p className="text-gray-500">Nenhum dado encontrado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
              <div>
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {data.topVolume.map((item: any, idx: number) => (
                      <tr key={item.cnpj}>
                        <td className="py-3 font-bold text-gray-900 w-8">{idx + 1}º</td>
                        <td className="py-3 font-medium text-gray-700">{item.nome} / {item.cnpj}</td>
                        <td className="py-3 text-right font-bold text-gray-900">{item.totalArquivos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="h-64 pl-4 border-l border-gray-100">
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="arquivos" radius={[2, 2, 0, 0]}>
                      {barData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
