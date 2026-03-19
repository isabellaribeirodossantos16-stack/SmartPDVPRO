
import React, { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useNavigate } from 'react-router-dom';
import { DollarSign, AlertCircle, ShoppingBag, Users, ArrowUp, ArrowDown, ChevronDown, ChevronUp, X, Clock, Receipt, CheckCircle, AlertTriangle, Cake, Gift, MessageCircle, RefreshCw } from 'lucide-react';
import { FinancialRecord, Sale, Customer } from '../types';
import { PaymentModal } from '../components/PaymentModal';
import { MessageSelectorModal } from '../components/MessageSelectorModal';

const StatCard = ({ title, value, subtext, icon: Icon, color, onClick, actionIcon, rangeText }: any) => (
  <div 
    onClick={onClick}
    className={`bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-fade-in relative overflow-hidden group transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}`}
  >
    <div className="flex justify-between items-start relative z-10">
      <div>
        <div className="flex items-center gap-2 mb-1">
             <p className="text-sm font-medium text-slate-500">{title}</p>
             {rangeText && <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-400 font-medium border border-slate-200">{rangeText}</span>}
        </div>
        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${color} shadow-sm transition-colors duration-300`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
    {subtext && <p className="text-xs text-slate-400 mt-4 font-medium">{subtext}</p>}
    
    {/* Decor element */}
    <div className={`absolute -right-4 -bottom-4 opacity-10 transform rotate-12 group-hover:scale-110 transition-transform duration-500`}>
        <Icon size={80} className={color.replace('bg-', 'text-')} />
    </div>

    {/* Action Icon (Chevron/Arrow) */}
    {actionIcon}
  </div>
);

// Helper function for Urgency Status
const getUrgencyStatus = (dueDateStr: string) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const dueDate = new Date(dueDateStr);
  dueDate.setHours(0,0,0,0);
  
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
     return { 
       style: "bg-red-50 border-l-4 border-l-red-500 border-red-200 animate-pulse", 
       text: "Pagamento Vencido",
       textColor: "text-red-600",
       icon: AlertCircle
     };
  }
  if (diffDays === 0) {
     return { 
       style: "rainbow-blink border-2", 
       text: "Pgto vence hoje",
       textColor: "text-red-600 font-bold",
       icon: Clock
     };
  }
  if (diffDays === 1) {
     return { 
       style: "bg-orange-50 border-l-4 border-l-orange-500 border-orange-200", 
       text: "Vence Amanhã",
       textColor: "text-orange-600",
       icon: Clock
     };
  }
  if (diffDays <= 3) {
     return { 
       style: "bg-yellow-50 border-l-4 border-l-yellow-400 border-yellow-200", 
       text: `Vence em ${diffDays} dias`,
       textColor: "text-yellow-700",
       icon: Clock
     };
  }
  
  return { 
    style: "hover:bg-slate-50 border-b border-slate-100", 
    text: `Vence em ${diffDays} dias`,
    textColor: "text-slate-500",
    icon: Clock
  };
};

export const Dashboard = () => {
  const { sales, financialRecords, customers, settings } = useStore();
  const navigate = useNavigate();
  const [selectedRecord, setSelectedRecord] = useState<FinancialRecord | null>(null);
  
  // State for toggling the Financial Card
  const [financeCardMode, setFinanceCardMode] = useState<'receivable' | 'payable'>('receivable');

  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showBirthdaysModal, setShowBirthdaysModal] = useState(false);
  const [messageTarget, setMessageTarget] = useState<Customer | null>(null);

  // Default widget configuration
  const defaultWidget = { enabled: true, range: 0 };
  const widgets = {
    sales: settings.dashboardWidgets.sales || defaultWidget,
    receivables: settings.dashboardWidgets.receivables || defaultWidget,
    payables: settings.dashboardWidgets.payables || defaultWidget,
    alerts: settings.dashboardWidgets.alerts || defaultWidget,
    birthdays: settings.dashboardWidgets.birthdays || defaultWidget,
    lists: settings.dashboardWidgets.lists ?? true
  };

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);

    // --- SALES STATS ---
    const salesRangeDate = new Date(today);
    salesRangeDate.setDate(today.getDate() - widgets.sales.range);
    
    const filteredSales = sales.filter(s => {
        const saleDate = new Date(s.date);
        saleDate.setHours(0,0,0,0);
        return saleDate.getTime() >= salesRangeDate.getTime() && saleDate.getTime() <= today.getTime();
    });
    const totalSales = filteredSales.reduce((acc, curr) => acc + curr.total, 0);

    // --- FINANCIAL STATS ---
    const getFinancialStats = (type: 'receivable' | 'payable', range: number) => {
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + range);

        const records = financialRecords.filter(r => {
             if (r.type !== type || r.status === 'paid') return false;
             const dueDate = new Date(r.dueDate);
             dueDate.setHours(0,0,0,0);
             return dueDate.getTime() >= today.getTime() && dueDate.getTime() <= endDate.getTime();
        });
        
        return {
             total: records.reduce((acc, r) => acc + r.amount, 0),
             count: records.length,
             records
        };
    };

    const receivablesStats = getFinancialStats('receivable', widgets.receivables.range);
    const payablesStats = getFinancialStats('payable', widgets.payables.range);

    // --- ALERTS ---
    const alertEndDate = new Date(today);
    alertEndDate.setDate(today.getDate() + widgets.alerts.range);
    const alertRecords = financialRecords.filter(r => {
        if (r.status === 'paid') return false;
        const due = new Date(r.dueDate);
        due.setHours(0,0,0,0);
        return due.getTime() <= alertEndDate.getTime();
    });
    const alertCount = alertRecords.length;

    // --- BIRTHDAYS ---
    const birthdayCustomers = customers.filter(c => {
         if (!c.birthDate || c.id === 'def') return false;
         const [y, m, d] = c.birthDate.split('-').map(Number);
         const bMonth = m - 1; const bDay = d;
         const nextBday = new Date(today.getFullYear(), bMonth, bDay);
         if (nextBday < today) nextBday.setFullYear(today.getFullYear() + 1);
         const diffTime = nextBday.getTime() - today.getTime();
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
         return diffDays <= widgets.birthdays.range;
    }).sort((a,b) => { /* sort logic */ return 0; });

    return { totalSales, filteredSales, receivablesStats, payablesStats, alertCount, alertRecords, birthdayCustomers };
  }, [sales, financialRecords, customers, widgets]);

  // Lists Logic (Show all unpaid for quick access)
  const urgentReceivables = useMemo(() => {
    return financialRecords
      .filter(r => r.type === 'receivable' && r.status !== 'paid')
      .sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [financialRecords]);

  const urgentPayables = useMemo(() => {
    return financialRecords
      .filter(r => r.type === 'payable' && r.status !== 'paid')
      .sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [financialRecords]);

  // Dynamic Card Props
  const financeCardProps = useMemo(() => {
      if (financeCardMode === 'receivable') {
          return {
              title: "A Receber",
              rangeText: widgets.receivables.range === 0 ? 'Hoje' : `${widgets.receivables.range} dias`,
              value: `R$ ${stats.receivablesStats.total.toFixed(2)}`,
              subtext: `${stats.receivablesStats.count} contas pendentes`,
              icon: ArrowDown,
              color: "bg-emerald-500",
              route: "/finance",
              toggleIcon: <ArrowDown className="text-emerald-500 transform -rotate-45" size={18} />
          };
      } else {
          return {
              title: "A Pagar",
              rangeText: widgets.payables.range === 0 ? 'Hoje' : `${widgets.payables.range} dias`,
              value: `R$ ${stats.payablesStats.total.toFixed(2)}`,
              subtext: `${stats.payablesStats.count} contas a pagar`,
              icon: ArrowUp,
              color: "bg-red-500",
              route: "/payables",
              toggleIcon: <ArrowUp className="text-red-500 transform rotate-45" size={18} />
          };
      }
  }, [financeCardMode, stats, widgets]);

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <style>{`
        @keyframes rainbow { 
          0% { border-color: #f97316; background-color: #fff7ed; box-shadow: 0 0 10px rgba(249, 115, 22, 0.2); } 
          20% { border-color: #ef4444; background-color: #fef2f2; box-shadow: 0 0 10px rgba(239, 68, 68, 0.2); } 
          40% { border-color: #eab308; background-color: #fefce8; box-shadow: 0 0 10px rgba(234, 179, 8, 0.2); } 
          60% { border-color: #3b82f6; background-color: #eff6ff; box-shadow: 0 0 10px rgba(59, 130, 246, 0.2); } 
          80% { border-color: #22c55e; background-color: #f0fdf4; box-shadow: 0 0 10px rgba(34, 197, 94, 0.2); } 
          100% { border-color: #f97316; background-color: #fff7ed; box-shadow: 0 0 10px rgba(249, 115, 22, 0.2); } 
        }
        .rainbow-blink {
          animation: rainbow 1.5s infinite;
        }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
            <h2 className="text-3xl font-bold text-slate-800">Visão Geral</h2>
            <p className="text-slate-500 text-sm mt-1 bg-white px-2 py-1 rounded inline-block border border-slate-200">
               Hoje: {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {widgets.sales.enabled && (
            <StatCard 
                title="Vendas" 
                rangeText={widgets.sales.range === 0 ? 'Hoje' : `${widgets.sales.range} dias`}
                value={`R$ ${stats.totalSales.toFixed(2)}`} 
                subtext={`${stats.filteredSales.length} vendas no período`}
                icon={ShoppingBag} 
                color="bg-blue-600"
                onClick={() => setShowSalesModal(true)}
                actionIcon={<div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronDown size={20} className="text-slate-400"/></div>}
            />
        )}
        
        {/* DYNAMIC FINANCIAL CARD (Toggleable) */}
        <StatCard 
            title={financeCardProps.title} 
            rangeText={financeCardProps.rangeText}
            value={financeCardProps.value} 
            subtext={financeCardProps.subtext}
            icon={financeCardProps.icon} 
            color={financeCardProps.color} 
            onClick={() => navigate(financeCardProps.route)}
            actionIcon={
                <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        setFinanceCardMode(prev => prev === 'receivable' ? 'payable' : 'receivable');
                    }}
                    className="absolute top-4 right-4 cursor-pointer hover:bg-slate-100 p-1.5 rounded-full transition-colors z-20 bg-white/80 shadow-sm border border-slate-100"
                    title="Alternar Visualização"
                >
                    {financeCardProps.toggleIcon}
                </div>
            }
        />

        {/* ALERTS CARD */}
        {widgets.alerts.enabled && (
            <StatCard 
                title="Alertas" 
                rangeText={widgets.alerts.range === 0 ? 'Hoje' : `${widgets.alerts.range} dias`}
                value={stats.alertCount > 0 ? "Atenção" : "Tudo em dia"} 
                subtext={stats.alertCount > 0 ? `${stats.alertCount} itens vencidos/próximos` : "Nenhuma pendência"}
                icon={AlertTriangle} 
                color={stats.alertCount > 0 ? "bg-amber-500" : "bg-green-500"}
                onClick={() => setShowAlertsModal(true)}
                actionIcon={<div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"><AlertCircle size={20} className="text-slate-400"/></div>}
            />
        )}

        {/* BIRTHDAYS CARD */}
        {widgets.birthdays.enabled && (
            <StatCard 
                title="Aniversariantes" 
                rangeText={widgets.birthdays.range === 0 ? 'Hoje' : `${widgets.birthdays.range} dias`}
                value={stats.birthdayCustomers.length > 0 ? stats.birthdayCustomers.length : "Nenhum"} 
                subtext={stats.birthdayCustomers.length > 0 ? "Ver lista completa" : "Ninguém festejando"}
                icon={Cake} 
                color="bg-purple-500"
                onClick={() => setShowBirthdaysModal(true)}
                actionIcon={<div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"><Gift size={20} className="text-slate-400"/></div>}
            />
        )}
      </div>

      {/* Financial Lists Section - RESTORED SIDE BY SIDE */}
      {widgets.lists && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Receivables List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-fade-in">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><ArrowDown size={18} className="text-emerald-500" /> Próximos Recebimentos</h3>
              </div>
              <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-96 p-2">
                {urgentReceivables.map(r => {
                   const status = getUrgencyStatus(r.dueDate);
                   return (
                    <div key={r.id} onClick={() => setSelectedRecord(r)} className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer flex justify-between items-center group rounded-lg mb-1 border-b border-transparent ${status.style}`}>
                      <div>
                        <p className="font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">{r.entityName}</p>
                        <p className="text-xs text-slate-400">{r.description}</p>
                        <p className={`text-[10px] font-bold uppercase mt-1 ${status.textColor}`}>{status.text}</p>
                      </div>
                      <div className="text-right">
                        <span className="block font-bold text-slate-800">R$ {r.amount.toFixed(2)}</span>
                      </div>
                    </div>
                   );
                })}
                {urgentReceivables.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-sm bg-slate-50 m-2 rounded-lg border border-dashed border-slate-200">
                    Nenhuma conta a receber próxima.
                  </div>
                )}
              </div>
            </div>

            {/* Payables List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-fade-in">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-red-50/50">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><ArrowUp size={18} className="text-red-500" /> Contas a Pagar</h3>
              </div>
              <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-96 p-2">
                {urgentPayables.map(r => {
                   const status = getUrgencyStatus(r.dueDate);
                   return (
                    <div key={r.id} onClick={() => setSelectedRecord(r)} className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer flex justify-between items-center group rounded-lg mb-1 border-b border-transparent ${status.style}`}>
                      <div>
                        <p className="font-bold text-slate-700 group-hover:text-red-600 transition-colors">{r.entityName}</p>
                        <p className="text-xs text-slate-400">{r.description}</p>
                        <p className={`text-[10px] font-bold uppercase mt-1 ${status.textColor}`}>{status.text}</p>
                      </div>
                      <div className="text-right">
                        <span className="block font-bold text-slate-800">R$ {r.amount.toFixed(2)}</span>
                      </div>
                    </div>
                   );
                })}
                {urgentPayables.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-sm bg-slate-50 m-2 rounded-lg border border-dashed border-slate-200">
                    Nenhuma conta a pagar pendente.
                  </div>
                )}
              </div>
            </div>
          </div>
      )}

      {/* MODALS */}
      {showSalesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-blue-50">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><ShoppingBag size={20} className="text-blue-600"/> Vendas Recentes</h3>
                <button onClick={() => setShowSalesModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-2 overflow-y-auto bg-slate-50 flex-1 space-y-2">
                {stats.filteredSales.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(sale => (
                    <div key={sale.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center">
                        <div>
                            <p className="font-bold text-slate-700 text-sm">Venda #{sale.id}</p>
                            <p className="text-xs text-slate-400">{new Date(sale.date).toLocaleString('pt-BR')}</p>
                            <p className="text-xs text-slate-500 mt-1">{sale.paymentMethod}</p>
                        </div>
                        <div className="text-right">
                            <span className="block font-bold text-green-600">R$ {sale.total.toFixed(2)}</span>
                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 border border-slate-200">{sale.items.length} itens</span>
                        </div>
                    </div>
                ))}
                {stats.filteredSales.length === 0 && <p className="text-center text-slate-400 p-8">Nenhuma venda no período.</p>}
            </div>
          </div>
        </div>
      )}

      {showAlertsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-amber-50">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><AlertTriangle size={20} className="text-amber-600"/> Alertas de Vencimento</h3>
                <button onClick={() => setShowAlertsModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-2 overflow-y-auto bg-slate-50 flex-1 space-y-2">
                {stats.alertRecords.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(r => {
                    const status = getUrgencyStatus(r.dueDate);
                    return (
                        <div key={r.id} onClick={() => setSelectedRecord(r)} className={`bg-white p-4 rounded-lg border shadow-sm flex justify-between items-center cursor-pointer hover:bg-slate-50 ${status.style}`}>
                            <div>
                                <p className="font-bold text-slate-700 text-sm">{r.description}</p>
                                <p className="text-xs text-slate-500">{r.entityName}</p>
                                <p className={`text-[10px] font-bold uppercase mt-1 ${status.textColor}`}>{status.text}</p>
                            </div>
                            <div className="text-right">
                                <span className={`block font-bold ${r.type === 'receivable' ? 'text-green-600' : 'text-red-600'}`}>R$ {r.amount.toFixed(2)}</span>
                                <span className="text-[10px] text-slate-400 uppercase">{r.type === 'receivable' ? 'Receber' : 'Pagar'}</span>
                            </div>
                        </div>
                    );
                })}
                {stats.alertRecords.length === 0 && <p className="text-center text-slate-400 p-8">Tudo em dia!</p>}
            </div>
          </div>
        </div>
      )}

      {showBirthdaysModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-purple-50">
                      <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Cake size={20} className="text-purple-600"/> Aniversariantes</h3>
                      <button onClick={() => setShowBirthdaysModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                  </div>
                  <div className="p-2 overflow-y-auto bg-slate-50 flex-1 space-y-2">
                      {stats.birthdayCustomers.length === 0 ? (
                          <div className="text-center text-slate-400 p-8">Nenhum aniversariante próximo.</div>
                      ) : (
                          stats.birthdayCustomers.map(c => {
                              const [y, m, d] = c.birthDate!.split('-').map(Number);
                              const today = new Date(); today.setHours(0,0,0,0);
                              const bday = new Date(today.getFullYear(), m - 1, d);
                              if (bday < today) bday.setFullYear(today.getFullYear() + 1);
                              const isToday = bday.getTime() === today.getTime();

                              return (
                                  <div key={c.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                                      <div>
                                          <p className="font-bold text-slate-800">{c.name}</p>
                                          <p className="text-xs text-slate-500 flex items-center gap-1">
                                              <Gift size={12} className="text-purple-500"/> 
                                              {d}/{m} {isToday && <span className="font-bold text-purple-600 animate-pulse ml-1">- Hoje!</span>}
                                          </p>
                                      </div>
                                      {isToday && c.phone && (
                                          <button 
                                              onClick={() => setMessageTarget(c)}
                                              className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full shadow-sm transition-colors"
                                              title="Enviar Mensagem"
                                          >
                                              <MessageCircle size={18} />
                                          </button>
                                      )}
                                  </div>
                              );
                          })
                      )}
                  </div>
              </div>
          </div>
      )}

      {selectedRecord && (
        <PaymentModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}

      {messageTarget && (
          <MessageSelectorModal 
              customer={messageTarget} 
              onClose={() => setMessageTarget(null)} 
          />
      )}
    </div>
  );
};
