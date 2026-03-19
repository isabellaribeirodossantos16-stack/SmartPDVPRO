
// ... existing imports
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { FinancialRecord, Sale, PaymentMethod, Customer } from '../types';
import { ArrowUpCircle, ArrowDownCircle, Check, Clock, MessageCircle, X, History, QrCode, Copy, Download, Filter, Search, Calendar, ShoppingBag, DollarSign, FileText, ChevronRight, ChevronDown, Wallet, Receipt, Layers, Pencil, Printer, Eye, Zap, User, Info } from 'lucide-react';
import { PaymentModal } from '../components/PaymentModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { CustomerInfoModal } from '../components/CustomerInfoModal';

type ViewMode = 'overview' | 'revenues' | 'plans' | 'expenses';
type FilterType = 'all' | 'client' | 'product' | 'date_single' | 'date_range';

// ... (Interfaces remain same)
interface UnifiedRevenueItem {
  id: string;
  type: 'sale' | 'receivable';
  date: string;
  customerName: string;
  description: string;
  total: number;
  remaining: number; 
  status: 'paid' | 'pending' | 'partial';
  originalObject: Sale | FinancialRecord;
  saleId?: string; 
  isPlan: boolean; 
  planExpirationDate?: string; 
}

// ... (Keep Helper functions getUrgencyStatus and getPlanStatus same as before)
const getUrgencyStatus = (dueDateStr: string) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const dueDate = new Date(dueDateStr); dueDate.setHours(0,0,0,0);
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { style: "bg-red-50 border-l-4 border-l-red-500 border-red-200 animate-pulse", text: "Vencido", textColor: "text-red-600" };
  if (diffDays === 0) return { style: "rainbow-blink border-2", text: "Vence hoje", textColor: "text-red-600 font-bold" };
  if (diffDays === 1) return { style: "bg-orange-50 border-l-4 border-l-orange-500 border-orange-200", text: "Amanhã", textColor: "text-orange-600" };
  if (diffDays <= 3) return { style: "bg-yellow-50 border-l-4 border-l-yellow-400 border-yellow-200", text: `${diffDays} dias`, textColor: "text-yellow-700" };
  return { style: "hover:bg-slate-50 border-b border-slate-100", text: `em ${diffDays} dias`, textColor: "text-slate-500" };
};

const getPlanStatus = (expirationDateStr: string) => {
  if (!expirationDateStr) return { text: "Sem Validade", color: "text-slate-400 bg-slate-100 border-slate-200" };
  const today = new Date(); today.setHours(0,0,0,0);
  const dueDate = new Date(expirationDateStr); dueDate.setHours(0,0,0,0);
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: "Plano Vencido", color: "text-slate-500 bg-slate-100 border-slate-200" }; 
  if (diffDays === 0) return { text: "Vence Hoje", color: "text-red-600 bg-red-50 border-red-200 font-bold" };
  if (diffDays === 1) return { text: "Amanhã", color: "text-orange-600 bg-orange-100 border-orange-200" };
  return { text: `Faltam ${diffDays} dias`, color: "text-blue-600 bg-blue-50 border-blue-100" };
};

export const Finance = () => {
  const { financialRecords, customers, sales, updateFinancialRecord, settings } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchText, setSearchText] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<FinancialRecord | null>(null);
  
  // Plan Detail State
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<UnifiedRevenueItem | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Edit Date States
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [tempDateValue, setTempDateValue] = useState<string>('');

  // History Modal State
  const [viewHistoryGroup, setViewHistoryGroup] = useState<any | null>(null);

  // Receipt Modal State
  const [receiptToPrint, setReceiptToPrint] = useState<{sale: Sale, customer: Customer} | null>(null);

  // NEW: Customer Info Modal State
  const [infoCustomer, setInfoCustomer] = useState<Customer | null>(null);

  // State for expanded groups in Overview
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());
  const [expandedPayables, setExpandedPayables] = useState<Set<string>>(new Set());

  // ... (toggle functions, openRecord, handleRevenueClick, DateEditor... remain same)
  const toggleSaleExpansion = (saleId: string) => { const newSet = new Set(expandedSales); if (newSet.has(saleId)) newSet.delete(saleId); else newSet.add(saleId); setExpandedSales(newSet); };
  const togglePayableExpansion = (groupId: string) => { const newSet = new Set(expandedPayables); if (newSet.has(groupId)) newSet.delete(groupId); else newSet.add(groupId); setExpandedPayables(newSet); };
  const openRecord = (r: FinancialRecord) => { if (editingDateId) return; setSelectedRecord(r); };
  const handleRevenueClick = (item: UnifiedRevenueItem) => { if (editingDateId) return; if (viewMode === 'plans' && item.isPlan) { setSelectedPlanDetails(item); return; } openRecord(item.originalObject as FinancialRecord); };
  const handleStartEditDate = (e: React.MouseEvent, id: string, currentDate: string) => { e.stopPropagation(); setEditingDateId(id); setTempDateValue(currentDate.split('T')[0]); };
  const handleSaveDate = (e: React.MouseEvent, id: string) => { e.stopPropagation(); if (tempDateValue) { const [y, m, d] = tempDateValue.split('-').map(Number); const newDate = new Date(y, m - 1, d, 12, 0, 0, 0); updateFinancialRecord(id, { dueDate: newDate.toISOString() }); } setEditingDateId(null); };
  const handleCancelEditDate = (e: React.MouseEvent) => { e.stopPropagation(); setEditingDateId(null); };
  const checkIsPlan = (saleId: string) => { const sale = sales.find(s => s.id === saleId); return sale?.items.some(i => i.category === 'Planos') || false; };
  const DateEditor = ({ id, currentDate, alwaysVisible = false }: { id: string, currentDate: string, alwaysVisible?: boolean }) => { if (editingDateId === id) { return ( <div className="flex items-center gap-1 z-10 relative"> <input type="date" value={tempDateValue} onChange={(e) => setTempDateValue(e.target.value)} onClick={(e) => e.stopPropagation()} className="p-1 border rounded bg-white text-xs w-32 shadow-lg" /> <button onClick={(e) => handleSaveDate(e, id)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><Check size={14} /></button> <button onClick={handleCancelEditDate} className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200"><X size={14} /></button> </div> ); } return ( <div className="flex items-center gap-2 group/date"> <span>{new Date(currentDate).toLocaleDateString('pt-BR')}</span> <button onClick={(e) => handleStartEditDate(e, id, currentDate)} className={`p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-500 transition-opacity ${alwaysVisible ? 'opacity-100' : 'opacity-0 group-hover/date:opacity-100'}`} title="Editar data de vencimento"> <Pencil size={12} /> </button> </div> ); };

  // --- GROUPING LOGIC FOR OVERVIEW (RECEIVABLES) ---
  const groupedReceivables = useMemo(() => {
     const allReceivables = financialRecords.filter(r => r.type === 'receivable');
     const groups: Record<string, { saleId: string; customerName: string; totalDebt: number; records: FinancialRecord[]; earliestDate: string; hasPending: boolean; isPlan: boolean; }> = {};
     const looseRecords: FinancialRecord[] = [];

     allReceivables.forEach(record => {
         const match = record.description.match(/Venda #(\d+)/);
         if (match) {
             const saleId = match[1];
             if (!groups[saleId]) {
                 groups[saleId] = { saleId, customerName: record.entityName === 'Cliente Balcão' ? 'Venda Balcão' : record.entityName, totalDebt: 0, records: [], earliestDate: record.dueDate, hasPending: false, isPlan: checkIsPlan(saleId) };
             }
             groups[saleId].records.push(record);
             if (record.status !== 'paid') {
                 groups[saleId].totalDebt += record.amount;
                 groups[saleId].hasPending = true;
                 if (new Date(record.dueDate) < new Date(groups[saleId].earliestDate)) groups[saleId].earliestDate = record.dueDate;
             }
         } else {
             if (record.status !== 'paid' && record.amount > 0.01) looseRecords.push(record);
         }
     });

     const activeGroups = Object.values(groups).filter(g => g.hasPending);
     const sortedGroups = activeGroups.sort((a,b) => new Date(b.earliestDate).getTime() - new Date(a.earliestDate).getTime());
     const sortedLoose = looseRecords.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

     return { groups: sortedGroups, loose: sortedLoose };
  }, [financialRecords, sales]);

  const groupedPayables = useMemo(() => {
      const allPayables = financialRecords.filter(r => r.type === 'payable');
      const groups: Record<string, { groupId: string; entityName: string; baseDescription: string; totalDebt: number; records: FinancialRecord[]; earliestDate: string; hasPending: boolean; }> = {};
      const looseRecords: FinancialRecord[] = [];

      allPayables.forEach(record => {
          let groupId = ''; let baseDesc = '';
          if (record.documentNumber) { groupId = record.documentNumber; baseDesc = record.description.replace(/\s\(\d+\/\d+\)$/, ''); } else { const match = record.description.match(/(.*)\s\(\d+\/\d+\)$/); if (match) { baseDesc = match[1]; groupId = `${record.entityName}::${baseDesc}`; } }
          
          if (groupId) {
              if (!groups[groupId]) groups[groupId] = { groupId, entityName: record.entityName, baseDescription: baseDesc, totalDebt: 0, records: [], earliestDate: record.dueDate, hasPending: false };
              groups[groupId].records.push(record);
              if (record.status !== 'paid') {
                  groups[groupId].totalDebt += record.amount;
                  groups[groupId].hasPending = true;
                  if (new Date(record.dueDate) < new Date(groups[groupId].earliestDate)) groups[groupId].earliestDate = record.dueDate;
              }
          } else {
              if (record.status !== 'paid') looseRecords.push(record);
          }
      });

      const activeGroups = Object.values(groups).filter(g => g.hasPending);
      const sortedGroups = activeGroups.sort((a,b) => new Date(a.earliestDate).getTime() - new Date(b.earliestDate).getTime());
      const sortedLoose = looseRecords.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      return { groups: sortedGroups, loose: sortedLoose };
  }, [financialRecords]);

  const unifiedRevenues = useMemo(() => {
    return financialRecords
      .filter(r => r.type === 'receivable')
      .map(r => {
        const match = r.description.match(/Venda #(\d+)/);
        const saleId = match ? match[1] : undefined;
        let isPlan = false; let planExpiration = undefined;
        if (saleId) { const sale = sales.find(s => s.id === saleId); if (sale) { isPlan = sale.items.some(i => i.category === 'Planos'); planExpiration = sale.planExpirationDate; } }
        let displayCustomer = r.entityName === 'Cliente Balcão' ? 'Venda Balcão' : r.entityName;
        return { id: r.id, type: r.status === 'paid' ? 'sale' : 'receivable', date: r.dueDate, customerName: displayCustomer, description: r.description, total: r.originalAmount, remaining: r.amount, status: r.status, originalObject: r, saleId: saleId, isPlan: isPlan, planExpirationDate: planExpiration } as UnifiedRevenueItem;
      })
      .filter(item => {
        const itemDate = item.date.split('T')[0];
        if (filterType === 'date_single' && dateStart && itemDate !== dateStart) return false;
        if (filterType === 'date_range' && dateStart && dateEnd && (itemDate < dateStart || itemDate > dateEnd)) return false;
        if (searchText) { const lower = searchText.toLowerCase(); if (filterType === 'client' && !item.customerName.toLowerCase().includes(lower)) return false; if (filterType === 'product') return item.description.toLowerCase().includes(lower); if (filterType === 'all' && !item.customerName.toLowerCase().includes(lower) && !item.description.toLowerCase().includes(lower)) return false; }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [financialRecords, filterType, searchText, dateStart, dateEnd, sales]);

  const filteredExpenses = useMemo(() => {
    return financialRecords.filter(record => {
      if (record.type !== 'payable') return false;
      const recordDate = record.dueDate.split('T')[0];
      if (filterType === 'date_single' && dateStart && recordDate !== dateStart) return false;
      if (filterType === 'date_range' && dateStart && dateEnd && (recordDate < dateStart || recordDate > dateEnd)) return false;
      if (searchText) { const lower = searchText.toLowerCase(); if (!record.entityName.toLowerCase().includes(lower) && !record.description.toLowerCase().includes(lower)) return false; }
      return true;
    }).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()); 
  }, [financialRecords, filterType, searchText, dateStart, dateEnd]);

  const currentList = useMemo(() => {
      if (viewMode === 'revenues') return unifiedRevenues;
      if (viewMode === 'plans') return unifiedRevenues.filter(i => i.isPlan);
      return [];
  }, [viewMode, unifiedRevenues]);

  const clientPlanHistory = useMemo(() => {
      if (!selectedPlanDetails) return [];
      return unifiedRevenues.filter(item => item.isPlan && item.customerName === selectedPlanDetails.customerName && item.id !== selectedPlanDetails.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedPlanDetails, unifiedRevenues]);

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      {/* ... (Header and Tabs code remains same) ... */}
       <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
         <h2 className="text-3xl font-bold text-slate-800">Financeiro</h2>
         <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-full md:w-auto overflow-x-auto">
            <button onClick={() => setViewMode('overview')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${viewMode === 'overview' ? 'bg-slate-800 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}>Visão Geral</button>
            <button onClick={() => setViewMode('revenues')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${viewMode === 'revenues' ? 'bg-green-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}><ArrowDownCircle size={16} /> Receitas</button>
            <button onClick={() => setViewMode('plans')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${viewMode === 'plans' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}><Zap size={16} /> Planos</button>
            <button onClick={() => setViewMode('expenses')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${viewMode === 'expenses' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}><ArrowUpCircle size={16} /> Despesas</button>
         </div>
       </div>

       {viewMode === 'overview' && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
           {/* RECEIVABLES */}
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-fit">
              <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-green-50"><ArrowDownCircle className="text-green-600" /><h3 className="font-bold text-green-900">Contas a Receber (Agrupadas)</h3></div>
              <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto p-2">
                {groupedReceivables.groups.map(group => {
                   const isExpanded = expandedSales.has(group.saleId);
                   const status = getUrgencyStatus(group.earliestDate); 
                   return (
                     <div key={group.saleId} className="mb-2 bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
                        <div onClick={() => toggleSaleExpansion(group.saleId)} className={`p-4 cursor-pointer flex justify-between items-center transition-all ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                           <div className="flex items-start gap-3"><div className="bg-green-100 p-2 rounded-full text-green-600 mt-1">{isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div><div><div className="font-bold text-slate-800 text-lg flex items-center gap-2">{group.customerName}{group.isPlan && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-200"><Zap size={10} fill="currentColor" /> PLANO</span>}</div><div className="text-sm text-slate-500 flex items-center gap-1"><Layers size={12} /> Venda #{group.saleId} • {group.records.filter(r => r.status !== 'paid').length} pendentes</div>{group.hasPending ? (<div className={`text-xs font-bold uppercase mt-1 ${status.textColor}`}>{status.text}</div>) : (<div className="text-xs font-bold uppercase mt-1 text-green-600 flex items-center gap-1"><Check size={12} /> Venda Concluída Hoje</div>)}</div></div>
                           <div className="text-right"><div className="text-sm text-slate-400 mb-1">Total Pendente</div><div className="flex items-center justify-end gap-2"><button onClick={(e) => { e.stopPropagation(); setViewHistoryGroup({ description: `Venda #${group.saleId}`, entityName: group.customerName, records: group.records }); }} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-500 transition-colors" title="Ver histórico de pagamentos"><Eye size={18} /></button><div className={`text-xl font-bold ${group.totalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>R$ {group.totalDebt.toFixed(2)}</div></div></div>
                        </div>
                        {isExpanded && (<div className="bg-slate-50 border-t border-slate-200 divide-y divide-slate-200">{group.records.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(r => { const isPaid = r.status === 'paid'; const dateObj = new Date(r.dueDate); dateObj.setHours(0,0,0,0); const today = new Date(); today.setHours(0,0,0,0); let statusText = ""; let statusColor = "text-blue-600"; if (isPaid) { statusText = "PAGO"; statusColor = "text-green-600"; } else { if (dateObj.getTime() < today.getTime()) { statusText = "VENCIDO"; statusColor = "text-red-600"; } else if (dateObj.getTime() === today.getTime()) { statusText = "HOJE"; statusColor = "text-orange-600"; } else if (dateObj.getTime() === today.getTime() + 86400000) { statusText = "AMANHÃ"; statusColor = "text-yellow-600"; } else { const diffTime = dateObj.getTime() - today.getTime(); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); statusText = `${diffDays} DIAS`; statusColor = "text-slate-500"; } } return (<div key={r.id} onClick={(e) => { e.stopPropagation(); openRecord(r); }} className={`p-3 pl-12 flex justify-between items-center transition-colors cursor-pointer ${isPaid ? 'opacity-60 bg-green-50/50 hover:bg-green-100' : 'hover:bg-slate-100'}`}><div><div className="font-medium text-slate-700 text-sm">{r.description.replace(`Venda #${group.saleId}`, '').replace('()', '').trim() || 'Parcela'}</div><div className={`text-[10px] font-bold flex items-center gap-2 ${statusColor}`}>{isPaid ? (<span className="flex items-center gap-1"><Check size={10} /> PAGO</span>) : (<><span className="opacity-75 text-slate-400">Vence:</span><DateEditor id={r.id} currentDate={r.dueDate} alwaysVisible={group.isPlan} /><span className="uppercase">({statusText})</span></>)}</div></div><div className="font-bold text-slate-600 text-sm">R$ {r.amount.toFixed(2)}</div></div>); })}</div>)}
                     </div>
                   );
                })}
                {groupedReceivables.loose.length > 0 && (
                   <div className="mt-4">
                      <div className="text-xs font-bold text-slate-400 px-2 mb-2 uppercase tracking-wide">Outros Lançamentos</div>
                      {groupedReceivables.loose.map(r => { const status = getUrgencyStatus(r.dueDate); return (<div key={r.id} onClick={() => openRecord(r)} className={`flex justify-between items-center p-4 cursor-pointer transition-colors group mb-2 rounded-lg bg-white border border-slate-100 ${status.style}`}><div className="flex-1"><div className="font-medium text-slate-800 group-hover:text-green-700">{r.entityName}</div><div className="text-xs text-slate-500">{r.description}</div><div className={`text-[10px] font-bold mt-1 uppercase ${status.textColor} flex items-center gap-2`}><DateEditor id={r.id} currentDate={r.dueDate} /><span>({status.text})</span></div></div><div className="text-right"><div className="flex items-center justify-end gap-2"><button onClick={(e) => { e.stopPropagation(); setViewHistoryGroup({ description: r.description, entityName: r.entityName, records: [r] }); }} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-500 transition-colors"><Eye size={16} /></button><div className="font-bold text-green-600">R$ {r.amount.toFixed(2)}</div></div></div></div>); })}
                   </div>
                )}
                {groupedReceivables.groups.length === 0 && groupedReceivables.loose.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">Nenhuma conta a receber pendente.</div>}
              </div>
           </div>
           {/* PAYABLES ... */}
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-fit">
              <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-red-50"><ArrowUpCircle className="text-red-600" /><h3 className="font-bold text-red-900">Contas a Pagar (Agrupadas)</h3></div>
              <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto p-2">
                {groupedPayables.groups.map(group => {
                    const isExpanded = expandedPayables.has(group.groupId);
                    const status = getUrgencyStatus(group.earliestDate);
                    return (
                        <div key={group.groupId} className="mb-2 bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
                            <div onClick={() => togglePayableExpansion(group.groupId)} className={`p-4 cursor-pointer flex justify-between items-center transition-all ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                                <div className="flex items-start gap-3"><div className="bg-red-100 p-2 rounded-full text-red-600 mt-1">{isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div><div><div className="font-bold text-slate-800 text-lg">{group.baseDescription}</div><div className="text-sm text-slate-500 flex items-center gap-1"><Wallet size={12} /> {group.entityName} • {group.records.filter(r => r.status !== 'paid').length} pendentes</div><div className={`text-xs font-bold uppercase mt-1 ${status.textColor}`}>{status.text}</div></div></div>
                                <div className="text-right"><div className="text-sm text-slate-400 mb-1">Total a Pagar</div><div className="flex items-center justify-end gap-2"><button onClick={(e) => { e.stopPropagation(); setViewHistoryGroup({ description: group.baseDescription, entityName: group.entityName, records: group.records }); }} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-500 transition-colors" title="Ver histórico de pagamentos"><Eye size={18} /></button><div className="text-xl font-bold text-red-600">R$ {group.totalDebt.toFixed(2)}</div></div></div>
                            </div>
                            {isExpanded && (<div className="bg-slate-50 border-t border-slate-200 divide-y divide-slate-200">{group.records.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(r => { const isPaid = r.status === 'paid'; const dateObj = new Date(r.dueDate); dateObj.setHours(0,0,0,0); const today = new Date(); today.setHours(0,0,0,0); let statusText = ""; let statusColor = "text-blue-600"; if (isPaid) { statusText = "PAGO"; statusColor = "text-green-600"; } else { if (dateObj.getTime() < today.getTime()) { statusText = "VENCIDO"; statusColor = "text-red-600"; } else if (dateObj.getTime() === today.getTime()) { statusText = "HOJE"; statusColor = "text-orange-600"; } else if (dateObj.getTime() === today.getTime() + 86400000) { statusText = "AMANHÃ"; statusColor = "text-yellow-600"; } else { const diffTime = dateObj.getTime() - today.getTime(); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); statusText = `${diffDays} DIAS`; statusColor = "text-slate-500"; } } const installmentMatch = r.description.match(/\((\d+\/\d+)\)$/); const installmentText = installmentMatch ? `Parcela ${installmentMatch[1]}` : r.description; return (<div key={r.id} onClick={(e) => { e.stopPropagation(); openRecord(r); }} className={`p-3 pl-12 flex justify-between items-center transition-colors cursor-pointer ${isPaid ? 'opacity-60 bg-green-50/50 hover:bg-green-100' : 'hover:bg-slate-100'}`}><div><div className="font-medium text-slate-700 text-sm">{installmentText}</div><div className={`text-[10px] font-bold flex items-center gap-2 ${statusColor}`}>{isPaid ? (<span className="flex items-center gap-1"><Check size={10} /> PAGO</span>) : (<><span className="opacity-75 text-slate-400">Vence:</span><DateEditor id={r.id} currentDate={r.dueDate} /><span className="uppercase">({statusText})</span></>)}</div></div><div className="font-bold text-slate-600 text-sm">R$ {r.amount.toFixed(2)}</div></div>); })}</div>)}
                        </div>
                    );
                })}
                {groupedPayables.loose.length > 0 && (
                    <div className="mt-4">
                        <div className="text-xs font-bold text-slate-400 px-2 mb-2 uppercase tracking-wide">Outras Despesas</div>
                        {groupedPayables.loose.map(r => { const status = getUrgencyStatus(r.dueDate); return (<div key={r.id} onClick={() => openRecord(r)} className={`flex justify-between items-center p-4 cursor-pointer transition-colors group mb-2 rounded-lg bg-white border border-slate-100 ${status.style}`}><div className="flex-1"><div className="font-medium text-slate-800 group-hover:text-red-700">{r.entityName}</div><div className="text-xs text-slate-500">{r.description}</div><div className={`text-[10px] font-bold mt-1 uppercase ${status.textColor} flex items-center gap-2`}><DateEditor id={r.id} currentDate={r.dueDate} /><span>({status.text})</span></div></div><div className="text-right"><div className="flex items-center justify-end gap-2"><button onClick={(e) => { e.stopPropagation(); setViewHistoryGroup({ description: r.description, entityName: r.entityName, records: [r] }); }} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-500 transition-colors"><Eye size={16} /></button><div className="font-bold text-red-600">R$ {r.amount.toFixed(2)}</div></div></div></div>); })}
                    </div>
                )}
                {groupedPayables.groups.length === 0 && groupedPayables.loose.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">Nenhuma conta pendente.</div>}
              </div>
           </div>
         </div>
       )}

       {/* ... (Revenues / Plans / Expenses Tables logic remains same) ... */}
       {(viewMode === 'revenues' || viewMode === 'plans' || viewMode === 'expenses') && (
         <div className="animate-fade-in space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end md:items-center">
               <div className="flex flex-col gap-1 w-full md:w-auto"><label className="text-xs font-medium text-slate-500 flex items-center gap-1"><Filter size={12}/> Filtrar Por</label><select className="border border-slate-300 rounded-lg p-2 text-sm bg-slate-50 focus:outline-none focus:border-accent" value={filterType} onChange={(e) => { setFilterType(e.target.value as FilterType); setSearchText(''); }}><option value="all">Todos os Registros</option><option value="client">{viewMode === 'expenses' ? 'Fornecedor' : 'Cliente'}</option><option value="date_single">Data Específica</option><option value="date_range">Período</option></select></div>
               {(filterType === 'all' || filterType === 'client') && (<div className="flex-1 w-full relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input type="text" className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-accent" placeholder="Pesquisar..." value={searchText} onChange={(e) => setSearchText(e.target.value)} /></div>)}
               {(filterType === 'date_single' || filterType === 'date_range') && (<div className="flex flex-col gap-1"><label className="text-xs font-medium text-slate-500">Início</label><input type="date" className="border border-slate-300 rounded-lg p-2 text-sm" value={dateStart} onChange={e => setDateStart(e.target.value)} /></div>)}
               {filterType === 'date_range' && (<div className="flex flex-col gap-1"><label className="text-xs font-medium text-slate-500">Fim</label><input type="date" className="border border-slate-300 rounded-lg p-2 text-sm" value={dateEnd} onChange={e => setDateEnd(e.target.value)} /></div>)}
            </div>

            {(viewMode === 'revenues' || viewMode === 'plans') && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                     <thead className="bg-slate-50 text-slate-500 text-sm"><tr>{viewMode === 'plans' ? <th className="p-4 font-medium">Vencimento do Plano</th> : <th className="p-4 font-medium">Data</th>}<th className="p-4 font-medium">Tipo</th><th className="p-4 font-medium">Cliente</th><th className="p-4 font-medium">Descrição</th><th className="p-4 font-medium">{viewMode === 'plans' ? 'Valor a Pagar' : 'Valor'}</th><th className="p-4 font-medium">Status</th><th className="p-4 font-medium text-right">Detalhes</th></tr></thead>
                     <tbody className="divide-y divide-slate-100 text-sm">
                       {currentList.map(item => { const planStatus = viewMode === 'plans' ? getPlanStatus(item.planExpirationDate || item.date) : null; const isPlanPaid = viewMode === 'plans' && (item.status === 'paid' || item.remaining <= 0.01); return (<tr key={item.id} onClick={() => handleRevenueClick(item)} className="hover:bg-blue-50 cursor-pointer transition-colors group"><td className="p-4 text-slate-600">{viewMode === 'plans' ? (<span className="font-bold text-slate-700">{item.planExpirationDate ? new Date(item.planExpirationDate).toLocaleDateString('pt-BR') : new Date(item.date).toLocaleDateString('pt-BR')}</span>) : (item.type === 'receivable' ? (<DateEditor id={item.id} currentDate={item.date} alwaysVisible={false} />) : (<span>{new Date(item.date).toLocaleDateString('pt-BR')}</span>))}</td><td className="p-4">{item.type === 'sale' ? (item.isPlan ? <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-100 px-2 py-1 rounded text-xs font-medium"><Zap size={12}/> Plano</span> : <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded text-xs font-medium"><ShoppingBag size={12}/> Venda</span>) : (<span className="inline-flex items-center gap-1 text-orange-700 bg-orange-100 px-2 py-1 rounded text-xs font-medium"><Wallet size={12}/> Conta</span>)}</td><td className="p-4 font-medium text-slate-800"><div className="flex items-center gap-2"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${item.type === 'sale' ? 'bg-slate-200 text-slate-600' : 'bg-orange-200 text-orange-700'}`}>{item.customerName.charAt(0)}</div>{item.customerName}</div></td><td className="p-4 text-slate-500 max-w-xs truncate"><div>{item.description}</div>{viewMode === 'plans' && (<div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><Calendar size={10} /> Venc. Parc: {new Date(item.date).toLocaleDateString('pt-BR')}</div>)}</td><td className="p-4 font-bold text-green-600">{viewMode === 'plans' ? (isPlanPaid ? (<span className="text-xs px-2 py-1 rounded border bg-green-100 text-green-700 border-green-200 font-bold uppercase">PAGO</span>) : (<div className="flex items-center gap-2"><span>R$ {item.remaining.toFixed(2)}</span><span className="text-[10px] px-1.5 py-0.5 rounded border bg-red-100 text-red-700 border-red-200 font-bold uppercase">Devendo</span></div>)) : (`R$ ${item.remaining.toFixed(2)}`)}</td><td className="p-4">{viewMode === 'plans' ? (planStatus && (<span className={`text-xs px-2 py-1 rounded border ${planStatus.color}`}>{planStatus.text}</span>)) : (item.status === 'paid' ? <span className="text-xs font-bold text-green-600">Recebido</span> : item.status === 'partial' ? <span className="text-xs font-bold text-blue-600">Parcial</span> : <span className="text-xs font-bold text-orange-500">Pendente</span>)}</td><td className="p-4 text-right text-slate-400 group-hover:text-accent"><ChevronRight size={18} className="inline-block"/></td></tr>); })}
                       {currentList.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">Nenhum registro.</td></tr>}
                     </tbody>
                   </table>
                 </div>
              </div>
            )}

            {viewMode === 'expenses' && (
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead className="bg-slate-50 text-slate-500 text-sm"><tr><th className="p-4 font-medium">Vencimento</th><th className="p-4 font-medium">Registro</th><th className="p-4 font-medium">Fornecedor</th><th className="p-4 font-medium">Descrição</th><th className="p-4 font-medium">Valor</th><th className="p-4 font-medium">Status</th><th className="p-4 text-right">Ação</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{filteredExpenses.map(record => (<tr key={record.id} onClick={() => openRecord(record)} className="hover:bg-red-50 cursor-pointer transition-colors group"><td className="p-4 text-slate-600"><DateEditor id={record.id} currentDate={record.dueDate} /></td><td className="p-4 text-slate-500 font-mono text-xs">{record.documentNumber ? `#${record.documentNumber}` : '-'}</td><td className="p-4 font-medium text-slate-800">{record.entityName}</td><td className="p-4 text-slate-500">{record.description}</td><td className="p-4 font-bold text-red-600">R$ {record.amount.toFixed(2)}</td><td className="p-4">{record.status === 'paid' ? <span className="text-green-600 text-xs border border-green-200 bg-green-50 px-2 py-1 rounded">Pago</span> : record.status === 'pending' ? <span className="text-orange-600 text-xs border border-orange-200 bg-orange-50 px-2 py-1 rounded">Pendente</span> : <span className="text-blue-600 text-xs border border-blue-200 bg-blue-50 px-2 py-1 rounded">Parcial</span>}</td><td className="p-4 text-right text-slate-400 group-hover:text-accent"><ChevronRight size={18} className="inline-block"/></td></tr>))} {filteredExpenses.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">Nenhuma despesa.</td></tr>}</tbody></table></div>
               </div>
            )}
         </div>
       )}

       {selectedPlanDetails && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
               {/* ... (Existing Plan Details Modal logic) ... */}
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
                   <div className="p-5 border-b border-slate-100 bg-blue-50 flex justify-between items-center shrink-0"><div><h3 className="font-bold text-xl text-blue-900 flex items-center gap-2"><Zap size={20} className="text-blue-600"/> Detalhes do Plano</h3><p className="text-sm text-blue-700">{selectedPlanDetails.description}</p></div><button onClick={() => setSelectedPlanDetails(null)} className="p-2 bg-white/50 hover:bg-white rounded-full text-blue-900 transition-colors"><X size={20} /></button></div>
                   <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                       <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6"><div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3"><div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">{selectedPlanDetails.customerName.charAt(0)}</div><div><p className="text-xs text-slate-400 font-bold uppercase">Cliente</p><p className="font-bold text-slate-800 text-lg">{selectedPlanDetails.customerName}</p></div><button onClick={() => { const c = customers.find(cust => cust.name === selectedPlanDetails.customerName); if (c) setInfoCustomer(c); }} className="ml-auto flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-200" title="Informações do Cliente"><Info size={16} /> <span className="hidden sm:inline">Informações</span></button></div>{(() => { const originSale = sales.find(s => s.id === selectedPlanDetails.saleId); const acquisitionDate = originSale ? originSale.date : selectedPlanDetails.date; const rec = selectedPlanDetails.originalObject as FinancialRecord; const displayValue = rec.status === 'paid' ? rec.originalAmount : rec.amount; const planExpiry = selectedPlanDetails.planExpirationDate || selectedPlanDetails.date; return (<div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-slate-400 mb-1">Data de Aquisição</p><p className="font-medium text-slate-700 flex items-center gap-1"><Calendar size={14}/> {new Date(acquisitionDate).toLocaleDateString('pt-BR')}</p></div><div><p className="text-xs text-slate-400 mb-1">Vencimento do Plano</p><p className="font-bold text-slate-800 flex items-center gap-1"><Clock size={14} className="text-orange-500"/>{new Date(planExpiry).toLocaleDateString('pt-BR')}</p></div><div><p className="text-xs text-slate-400 mb-1">Valor do Plano</p><div className="flex items-center gap-2"><p className="font-bold text-slate-800 text-lg">R$ {displayValue.toFixed(2)}</p>{selectedPlanDetails.status === 'paid' ? (<span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded border border-green-200 font-bold uppercase">Pago</span>) : (<span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded border border-red-200 font-bold uppercase">Devendo</span>)}</div>{rec.status === 'partial' && (<p className="text-[10px] text-slate-400 mt-1">(Original: R$ {rec.originalAmount.toFixed(2)})</p>)}</div><div><p className="text-xs text-slate-400 mb-1">Status</p>{(() => { const status = getPlanStatus(planExpiry); return <span className={`text-xs px-2 py-1 rounded border ${status.color}`}>{status.text}</span> })()}</div></div>); })()}</div>
                       <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><History size={18} /> Histórico de Renovações</h4>
                       <div className="space-y-2">{clientPlanHistory.length === 0 ? (<div className="text-center p-4 text-slate-400 text-sm bg-white rounded-lg border border-dashed border-slate-200">Nenhum histórico anterior encontrado para este cliente.</div>) : (clientPlanHistory.map(historyItem => { const isExpanded = expandedHistoryId === historyItem.id; let saleDetails = null; if (historyItem.saleId) { saleDetails = sales.find(s => s.id === historyItem.saleId); } return (<div key={historyItem.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden"><div onClick={() => setExpandedHistoryId(isExpanded ? null : historyItem.id)} className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"><div className="flex items-center gap-3"><div className="bg-blue-50 text-blue-600 p-1.5 rounded">{isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</div><div><p className="font-medium text-slate-700 text-sm">{historyItem.description}</p><p className="text-xs text-slate-400">{new Date(historyItem.date).toLocaleDateString('pt-BR')}</p></div></div><div className="font-bold text-green-600 text-sm">R$ {historyItem.total.toFixed(2)}</div></div>{isExpanded && (<div className="bg-slate-50 p-3 border-t border-slate-100 text-xs space-y-2 animate-fade-in">{saleDetails ? (<><div className="flex justify-between"><span className="text-slate-500">Método de Pagamento:</span><span className="font-medium text-slate-700">{saleDetails.paymentMethod}</span></div><div><span className="text-slate-500 block mb-1">Itens:</span><ul className="pl-2 space-y-1">{saleDetails.items.map((it, idx) => (<li key={idx} className="text-slate-700 flex justify-between"><span>{it.quantity}x {it.name}</span><span>R$ {(it.price * it.quantity).toFixed(2)}</span></li>))}</ul></div><div className="pt-2 flex justify-end"><button onClick={(e) => { e.stopPropagation(); setReceiptToPrint({sale: saleDetails!, customer: customers.find(c => c.id === saleDetails!.customerId)!}); }} className="text-blue-600 flex items-center gap-1 hover:underline"><Printer size={12}/> Reimprimir Cupom</button></div></>) : (<p className="text-slate-400 italic">Detalhes da venda não encontrados.</p>)}</div>)}</div>); }))}</div>
                   </div>
               </div>
           </div>
       )}

       {selectedRecord && (
         <PaymentModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
       )}

       {/* HISTORY MODAL (UPDATED WITH PARTIAL PAYMENT DETAILS) */}
       {viewHistoryGroup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                      <div>
                          <h3 className="font-bold text-lg text-slate-800">Histórico Detalhado</h3>
                          <p className="text-xs text-slate-500">{viewHistoryGroup.description} • {viewHistoryGroup.entityName}</p>
                      </div>
                      <button onClick={() => setViewHistoryGroup(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 bg-slate-50">
                      {/* Calculate total original vs total paid */}
                      {(() => {
                          const totalOriginal = viewHistoryGroup.records.reduce((acc: number, r: FinancialRecord) => acc + r.originalAmount, 0);
                          const totalPaid = viewHistoryGroup.records.flatMap((r: FinancialRecord) => (r.history || [])).reduce((acc: number, h: any) => acc + h.amount, 0);
                          const remaining = totalOriginal - totalPaid;

                          // FLATTEN ALL HISTORY
                          const allPayments = viewHistoryGroup.records.flatMap((r: FinancialRecord) => 
                              (r.history || []).map((h: any) => ({
                                  ...h, 
                                  origin: r.description,
                                  originalTotal: r.originalAmount
                              }))
                          ).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                          return (
                              <>
                                  <div className="bg-white p-4 rounded-lg border border-slate-200 mb-4 shadow-sm">
                                      <div className="flex justify-between items-center mb-2">
                                          <span className="text-sm text-slate-500">Valor Total Original</span>
                                          <span className="font-bold text-slate-800">R$ {totalOriginal.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between items-center mb-2">
                                          <span className="text-sm text-slate-500">Total Pago</span>
                                          <span className="font-bold text-green-600">R$ {totalPaid.toFixed(2)}</span>
                                      </div>
                                      <div className="border-t pt-2 flex justify-between items-center">
                                          <span className="text-sm font-bold text-slate-600">Restante</span>
                                          <span className={`font-bold ${remaining > 0.01 ? 'text-red-600' : 'text-green-600'}`}>R$ {Math.max(0, remaining).toFixed(2)}</span>
                                      </div>
                                  </div>

                                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 pl-1">Extrato de Baixas (Pagamentos)</h4>
                                  
                                  {allPayments.length === 0 ? (
                                      <div className="p-8 text-center text-slate-400 text-sm bg-white rounded-lg border border-dashed border-slate-200">
                                          Nenhum pagamento realizado nesta conta.
                                      </div>
                                  ) : (
                                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                          {allPayments.map((h: any, idx: number) => (
                                              <div key={idx} className="p-3 border-b border-slate-100 last:border-0 flex justify-between items-center hover:bg-slate-50">
                                                  <div>
                                                      <div className="text-xs text-slate-400 mb-0.5">
                                                          {new Date(h.date).toLocaleDateString('pt-BR')} às {new Date(h.date).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                                                      </div>
                                                      <div className="text-sm font-medium text-slate-700">
                                                          Pagamento Realizado
                                                      </div>
                                                      {/* Show partial context: "Abateu R$ 50 de R$ 250" */}
                                                      <div className="text-[10px] text-slate-500 mt-0.5">
                                                          Ref: {h.origin}
                                                      </div>
                                                  </div>
                                                  <div className="text-right">
                                                      <div className="font-bold text-green-600 text-sm">+ R$ {h.amount.toFixed(2)}</div>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </>
                          );
                      })()}
                  </div>
              </div>
          </div>
       )}

       {/* Render Receipt Modal if requested via History */}
       {receiptToPrint && (
           <ReceiptModal 
               sale={receiptToPrint.sale} 
               customer={receiptToPrint.customer} 
               settings={settings} 
               onClose={() => setReceiptToPrint(null)} 
           />
       )}

       {/* NEW CUSTOMER INFO MODAL */}
       {infoCustomer && (
           <CustomerInfoModal 
               customer={infoCustomer}
               sales={sales}
               onClose={() => setInfoCustomer(null)}
           />
       )}
    </div>
  );
};
