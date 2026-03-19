
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, DollarSign, Wallet, AlertCircle, ArrowRight, Filter } from 'lucide-react';

export const Reports = () => {
  const { sales, financialRecords } = useStore();
  
  // Default to current month start and today
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format matches input type="date"
  });
  
  const [endDate, setEndDate] = useState(() => {
    const date = new Date(); // Today
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  });

  // --- CALCULATIONS ENGINE ---
  const reportData = useMemo(() => {
    // 1. Filter Sales in Range (Using String Comparison for Accurate Local Day Filtering)
    const filteredSales = sales.filter(s => {
      // Convert Sale ISO Date to Local YYYY-MM-DD string to compare with Inputs accurately
      const saleDateLocal = new Date(s.date).toLocaleDateString('en-CA');
      return saleDateLocal >= startDate && saleDateLocal <= endDate;
    });

    // 2. Filter Expenses (Payables) in Range (Using String Comparison)
    const filteredExpenses = financialRecords.filter(r => {
      if (r.type !== 'payable') return false;
      const expenseDateLocal = new Date(r.dueDate).toLocaleDateString('en-CA');
      return expenseDateLocal >= startDate && expenseDateLocal <= endDate;
    });

    // 3. Metrics Calculation
    let totalRevenue = 0;
    let totalCost = 0;
    
    filteredSales.forEach(sale => {
      totalRevenue += sale.total;
      sale.items.forEach(item => {
        // Enforce number type for cost to ensure calculation works even if data is malformed
        const itemCost = Number(item.cost) || 0; 
        const itemQty = Number(item.quantity) || 0;
        totalCost += (itemCost * itemQty);
      });
    });

    const grossProfit = totalRevenue - totalCost;
    
    // Expenses Calculation (Using originalAmount to reflect the bill value)
    const totalExpenses = filteredExpenses.reduce((acc, r) => acc + r.originalAmount, 0);
    
    const netResult = grossProfit - totalExpenses;
    const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      salesCount: filteredSales.length,
      totalRevenue,
      totalCost,
      grossProfit,
      totalExpenses,
      netResult,
      margin,
      filteredSales,
      filteredExpenses
    };
  }, [sales, financialRecords, startDate, endDate]);

  // --- CHART DATA PREPARATION ---
  const chartData = useMemo(() => {
    const dataMap: Record<string, { date: string, revenue: number, expense: number, profit: number }> = {};

    // Helper to normalize date key for Chart Display (DD/MM/YYYY)
    const toKey = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR');

    // Add Sales to Chart
    reportData.filteredSales.forEach(s => {
        const key = toKey(s.date);
        if (!dataMap[key]) dataMap[key] = { date: key, revenue: 0, expense: 0, profit: 0 };
        dataMap[key].revenue += s.total;
        
        // Calculate profit per sale for chart accuracy
        const saleCost = s.items.reduce((acc, i) => acc + ((Number(i.cost) || 0) * i.quantity), 0);
        dataMap[key].profit += (s.total - saleCost);
    });

    // Add Expenses to Chart
    reportData.filteredExpenses.forEach(e => {
        const key = toKey(e.dueDate);
        if (!dataMap[key]) dataMap[key] = { date: key, revenue: 0, expense: 0, profit: 0 };
        dataMap[key].expense += e.originalAmount;
        // Subtract expense from profit for that day (Cash flow view)
        dataMap[key].profit -= e.originalAmount;
    });

    // Sort by Date
    return Object.values(dataMap).sort((a, b) => {
        const [da, ma, ya] = a.date.split('/').map(Number);
        const [db, mb, yb] = b.date.split('/').map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });
  }, [reportData]);

  const StatCard = ({ title, value, subValue, icon: Icon, colorClass, type = 'neutral' }: any) => (
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full relative overflow-hidden">
          <div className={`absolute top-0 right-0 p-3 opacity-10 ${colorClass.replace('text-', 'bg-')}`}>
              <Icon size={64} />
          </div>
          <div>
              <p className="text-sm font-medium text-slate-500 flex items-center gap-2 mb-1">
                  <Icon size={16} className={colorClass} /> {title}
              </p>
              <h3 className={`text-2xl font-bold ${colorClass}`}>{value}</h3>
          </div>
          {subValue && (
              <div className="mt-2 text-xs text-slate-400 border-t border-slate-100 pt-2">
                  {subValue}
              </div>
          )}
      </div>
  );

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h2 className="text-3xl font-bold text-slate-800">Relatórios Financeiros</h2>
            <p className="text-slate-500 text-sm">Análise detalhada de lucros e perdas</p>
        </div>
        
        {/* Date Filter */}
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center gap-2 px-2">
                <Filter size={16} className="text-slate-400"/>
                <span className="text-xs font-bold text-slate-600 uppercase">Período:</span>
            </div>
            <div className="flex items-center gap-2">
                <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2 py-1 text-sm text-slate-600 focus:outline-none focus:border-blue-500"
                />
                <span className="text-slate-400"><ArrowRight size={14}/></span>
                <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2 py-1 text-sm text-slate-600 focus:outline-none focus:border-blue-500"
                />
            </div>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
              title="Total de Vendas" 
              value={`R$ ${reportData.totalRevenue.toFixed(2)}`} 
              subValue={`${reportData.salesCount} vendas realizadas`}
              icon={DollarSign} 
              colorClass="text-blue-600"
          />
          <StatCard 
              title="Custo dos Produtos" 
              value={`R$ ${reportData.totalCost.toFixed(2)}`} 
              subValue="Custo de mercadoria vendida (CMV)"
              icon={Wallet} 
              colorClass="text-orange-600"
          />
          <StatCard 
              title="Lucro Bruto" 
              value={`R$ ${reportData.grossProfit.toFixed(2)}`} 
              subValue={`Margem Bruta: ${reportData.margin.toFixed(1)}%`}
              icon={TrendingUp} 
              colorClass="text-green-600"
          />
          <StatCard 
              title="Despesas Operacionais" 
              value={`R$ ${reportData.totalExpenses.toFixed(2)}`} 
              subValue="Contas a Pagar no período"
              icon={TrendingDown} 
              colorClass="text-red-500"
          />
      </div>

      {/* MAIN RESULT CARD */}
      <div className={`mb-8 p-6 rounded-xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-colors ${reportData.netResult >= 0 ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'}`}>
          <div className="flex items-center gap-4">
              <div className={`p-4 rounded-full ${reportData.netResult >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {reportData.netResult >= 0 ? <TrendingUp size={32} /> : <AlertCircle size={32} />}
              </div>
              <div>
                  <h3 className="text-lg font-medium text-slate-600">Resultado Líquido do Período</h3>
                  <p className="text-sm opacity-70">(Lucro Bruto - Despesas)</p>
              </div>
          </div>
          <div className="text-right">
              <div className={`text-4xl font-bold ${reportData.netResult >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  R$ {reportData.netResult.toFixed(2)}
              </div>
              <div className={`text-sm font-medium ${reportData.netResult >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {reportData.netResult >= 0 ? 'LUCRO' : 'PREJUÍZO'}
              </div>
          </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* CHART 1: Sales vs Expenses */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-96 flex flex-col">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><Calendar size={20}/> Fluxo Diário (Vendas x Despesas)</h3>
              <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{fontSize: 12}} stroke="#94a3b8" />
                          <YAxis tick={{fontSize: 12}} stroke="#94a3b8" tickFormatter={(value) => `R$${value}`} />
                          <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: number) => [`R$ ${value.toFixed(2)}`, '']}
                          />
                          <Legend wrapperStyle={{paddingTop: '10px'}} />
                          <Bar dataKey="revenue" name="Vendas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* CHART 2: Net Profit Trend */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-96 flex flex-col">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><TrendingUp size={20}/> Evolução do Lucro (Caixa)</h3>
              <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <defs>
                              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{fontSize: 12}} stroke="#94a3b8" />
                          <YAxis tick={{fontSize: 12}} stroke="#94a3b8" />
                          <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Resultado Dia']}
                          />
                          <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" />
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>
    </div>
  );
};
