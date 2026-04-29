import { useEffect, useState } from "react";
import { formatCurrency } from "../lib/utils";
import { getAuthHeaders } from "../lib/auth";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { Calendar, Building2, TrendingUp, TrendingDown, FileText } from "lucide-react";

export default function Relatorios() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/empresas", { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => setEmpresas(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!empresaId) {
      setReportData(null);
      return;
    }
    setLoading(true);
    
    let url = `/api/relatorios/${empresaId}?`;
    if (dataInicio) url += `start=${dataInicio}&`;
    if (dataFim) url += `end=${dataFim}&`;

    fetch(url, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => setReportData(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [empresaId, dataInicio, dataFim]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header and Filter */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-200 mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Relatórios
        </h1>
        
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            Empresa:
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value)}
              className="w-48 px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Selecione uma empresa...</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nome}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
            <Calendar className="w-4 h-4 text-gray-500 ml-1" />
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="bg-transparent border-none text-sm outline-none w-[110px]"
            />
            <span className="text-gray-400">Até</span>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="bg-transparent border-none text-sm outline-none w-[110px]"
            />
          </div>
        </div>
      </div>

      {!empresaId && (
        <div className="bg-white p-10 rounded-2xl border border-gray-200 text-center shadow-sm">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700">Selecione uma empresa</h2>
          <p className="text-gray-500 mt-2 text-sm">Para visualizar os relatórios e gráficos, escolha uma empresa no filtro acima.</p>
        </div>
      )}

      {loading && empresaId && (
        <div className="p-8 text-center text-gray-500">Gerando relatório...</div>
      )}

      {!loading && reportData && (
        <div className="space-y-6">
          {/* Main Totals Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Faturamento (Saída)</p>
                <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><TrendingUp className="w-5 h-5"/></div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(reportData.totais.total_saida || 0)}</h3>
                <p className="text-xs text-gray-500 mt-1">{reportData.totais.count_saida || 0} notas de saída registradas</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Despesas (Entrada)</p>
                <div className="bg-orange-50 p-2 rounded-lg text-orange-600"><TrendingDown className="w-5 h-5"/></div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(reportData.totais.total_entrada || 0)}</h3>
                <p className="text-xs text-gray-500 mt-1">{reportData.totais.count_entrada || 0} notas de entrada registradas</p>
              </div>
            </div>

            <div className="bg-blue-600 p-6 rounded-2xl shadow-sm border border-blue-700 text-white flex flex-col justify-between lg:col-span-2">
              <div className="flex justify-between items-start">
                <p className="text-sm font-semibold text-blue-100 uppercase tracking-wide">Receita Líquida Bruta</p>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-extrabold">{formatCurrency((reportData.totais.total_saida || 0) - (reportData.totais.total_entrada || 0))}</h3>
                <p className="text-xs text-blue-200 mt-1">Diferença entre notas de Saída e Entrada (Não considera custos fixos)</p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* Evolution Area Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">Evolução Mensal (Entrada vs Saída)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={reportData.mensal} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="mes" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#6b7280', fontSize: 12 }} 
                      tickFormatter={(val) => {
                        const [y, m] = val.split('-');
                        return `${m}/${y.substring(2)}`;
                      }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#6b7280', fontSize: 12 }} 
                      tickFormatter={(value) => {
                        if (value === 0) return '0';
                        return `R$ ${(value / 1000)}k`;
                      }}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Mês: ${label}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="saida" name="Faturamento (Saída)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSaida)" strokeWidth={3} />
                    <Area type="monotone" dataKey="entrada" name="Despesas (Entrada)" stroke="#f97316" fillOpacity={1} fill="url(#colorEntrada)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comparativo Bar Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">Comparativo Mensal (Saída/Entrada)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.mensal} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="mes" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickFormatter={(val) => {
                        const [y, m] = val.split('-');
                        return `${m}/${y.substring(2)}`;
                      }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickFormatter={(value) => {
                        if (value === 0) return '0';
                        return `R$ ${(value / 1000)}k`;
                      }}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Mês: ${label}`}
                      cursor={{fill: '#f3f4f6'}}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="saida" name="Faturamento (Saída)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="entrada" name="Despesas (Entrada)" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top Fornecedores Entrada */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                Top 10 Fornecedores (Por Despesa/Entrada)
              </h3>
              {reportData.topFornecedores.length === 0 ? (
                 <p className="text-gray-500 text-sm py-4">Nenhum dado encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {reportData.topFornecedores.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3 w-3/4">
                        <span className="font-bold text-gray-400 w-4">{idx + 1}º</span>
                        <span className="font-medium text-gray-700 truncate" title={item.nome}>{item.nome}</span>
                      </div>
                      <span className="font-bold text-gray-900 whitespace-nowrap">{formatCurrency(item.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Clientes Saida */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                Top 10 Clientes (Por Faturamento/Saída)
              </h3>
              {reportData.topClientes.length === 0 ? (
                 <p className="text-gray-500 text-sm py-4">Nenhum dado encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {reportData.topClientes.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3 w-3/4">
                        <span className="font-bold text-gray-400 w-4">{idx + 1}º</span>
                        <span className="font-medium text-gray-700 truncate" title={item.nome}>{item.nome}</span>
                      </div>
                      <span className="font-bold text-gray-900 whitespace-nowrap">{formatCurrency(item.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>
          
        </div>
      )}
    </div>
  );
}
