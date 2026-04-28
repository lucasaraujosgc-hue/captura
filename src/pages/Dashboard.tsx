import { useEffect, useState } from "react";
import { formatCurrency } from "../lib/utils";
import { ArrowDown, PieChart, BarChart3, FileText } from "lucide-react";
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { getAuthHeaders } from "../lib/auth";

const COLORS = ['#3b82f6', '#4f46e5', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef'];

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/dashboard", { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Não autorizado");
        return res.json();
      })
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
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#eaf4ff] p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#dcecfc] relative flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Baixados no mês</p>
            <div className="flex items-end gap-3 mt-4">
              <h3 className="text-4xl font-extrabold text-gray-900">{data.total_notas.toLocaleString('pt-BR')}</h3>
            </div>
            <p className="text-[11px] text-gray-500 mt-5 flex items-center gap-1 font-medium">
               Atualizado em {nowStr}
            </p>
          </div>
          <div className="bg-[#7aaefd] text-white p-2 rounded-xl shadow-sm">
            <ArrowDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#eaf4ff] p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#dcecfc] flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">CNPJS</p>
            <h3 className="text-4xl font-extrabold text-gray-900 mt-4">{data.total_empresas}</h3>
            <p className="text-[11px] text-gray-500 mt-5 flex items-center gap-1 font-medium">
               Atualizado em {nowStr}
            </p>
          </div>
        </div>

        <div className="bg-[#eaf4ff] p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#dcecfc] flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Usuários</p>
            <h3 className="text-4xl font-extrabold text-gray-900 mt-4">1</h3>
            <p className="text-[11px] text-gray-500 mt-5 flex items-center gap-1 font-medium">
               Atualizado em {nowStr}
            </p>
          </div>
        </div>
      </div>

      {/* ReportS Banner */}
      <div className="bg-gradient-to-r from-[#5f84ff] to-[#7acbfd] text-white font-semibold text-lg px-6 py-4 flex items-center gap-3 rounded-full shadow-md">
        <BarChart3 className="w-5 h-5 opacity-90" /> ReportS
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Charts) */}
        <div className="bg-white rounded-3xl p-8 shadow-[0_4px_30px_rgba(0,0,0,0.03)] lg:col-span-2 space-y-10">
          
          {/* Top Faturamento */}
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-gray-700" /> Top Empresas Faturamento
              </h2>
            </div>

            {data.topFaturamento.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">Nenhum dado encontrado.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
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
                        <span className="font-medium text-gray-700 truncate w-32 md:w-40">{item.nome}</span>
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
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gray-700" /> Top Empresas Volume de Arquivos
              </h2>
            </div>

            {data.topVolume.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">Nenhum dado encontrado.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                <div>
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {data.topVolume.map((item: any, idx: number) => (
                        <tr key={item.cnpj}>
                          <td className="py-3 font-bold text-gray-900 w-8">{idx + 1}º</td>
                          <td className="py-3 font-medium text-gray-700 truncate max-w-[120px] pr-2">{item.nome}</td>
                          <td className="py-3 text-right font-bold text-gray-900">{item.totalArquivos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="h-48 pl-2 border-l border-gray-100">
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

        {/* Right Column (CNPJs List) */}
        <div className="bg-white rounded-3xl p-8 shadow-[0_4px_30px_rgba(0,0,0,0.03)] lg:col-span-1">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-700" /> CNPJS
            </h2>
          </div>
          <div className="flex justify-center items-center h-48">
            <span className="text-gray-500 font-medium">No data found.</span>
          </div>
          <div className="flex justify-center items-center h-20">
            <span className="text-gray-500 font-medium">No data found.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
