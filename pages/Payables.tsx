
// ... existing imports
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Plus, DollarSign, Calendar, AlertCircle, X, ChevronRight, Check, Trash2, Edit2, Layers, Wallet, Filter, Search, ArrowUpRight, Eye } from 'lucide-react';
import { FinancialRecord } from '../types';
import { PaymentModal } from '../components/PaymentModal';
import { ConfirmModal } from '../components/ConfirmModal';

// ... (Interfaces InstallmentFlow and PayableGroup remain same)
interface InstallmentFlow {
    active: boolean;
    currentStep: number;
    totalSteps: number;
    dates: string[];
    baseData: {
        description: string;
        totalValue: number;
        status: 'pending' | 'paid';
        alertEnabled: boolean;
    } | null;
}

interface PayableGroup {
    groupId: string;
    description: string;
    entityName: string;
    totalRemaining: number;
    nextDueDate: string;
    installmentsCount: number;
    installmentsPaid: number;
    records: FinancialRecord[];
}

export const Payables = () => {
  const { financialRecords, addFinancialRecord, updateFinancialRecord, removeFinancialRecord, removeFinancialGroup } = useStore();
  
  // UI States
  const [showNewBillModal, setShowNewBillModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<PayableGroup | null>(null);
  const [installmentToPay, setInstallmentToPay] = useState<FinancialRecord | null>(null);
  
  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  // History Modal State
  const [viewHistoryGroup, setViewHistoryGroup] = useState<PayableGroup | null>(null);

  // Filter States
  const [filterType, setFilterType] = useState<'all' | 'name' | 'description' | 'date' | 'value'>('all');
  const [filterValue, setFilterValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // New Bill Form State
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'pending' | 'paid'>('pending');
  const [installments, setInstallments] = useState(1);
  const [alertEnabled, setAlertEnabled] = useState(true);

  // Installment Wizard State
  const [wizFlow, setWizFlow] = useState<InstallmentFlow>({
      active: false, currentStep: 1, totalSteps: 1, dates: [], baseData: null
  });

  // Editing Date State inside Detail Modal
  const [isEditingDate, setIsEditingDate] = useState<string | null>(null); // ID of record being edited
  const [newDateVal, setNewDateVal] = useState('');

  // ... (useMemos rawPayables and groupedPayables remain same)
  // --- 1. PREPARE DATA & FILTER ---
  const rawPayables = useMemo(() => {
      return financialRecords.filter(r => {
          if (r.type !== 'payable') return false;
          if (filterType === 'name' && !r.entityName.toLowerCase().includes(filterValue.toLowerCase())) return false;
          if (filterType === 'description' && !r.description.toLowerCase().includes(filterValue.toLowerCase())) return false;
          if (filterType === 'value' && filterValue && r.originalAmount !== parseFloat(filterValue)) return false;
          if (filterType === 'date') {
              if (startDate && r.dueDate < startDate) return false;
              if (endDate && r.dueDate > endDate) return false;
          }
          return true;
      });
  }, [financialRecords, filterType, filterValue, startDate, endDate]);

  const groupedPayables = useMemo(() => {
      const groups: Record<string, PayableGroup> = {};
      rawPayables.forEach(record => {
          let groupId = record.documentNumber;
          if (!groupId) groupId = record.id;

          if (!groups[groupId]) {
              const cleanDesc = record.description.replace(/\s\(\d+\/\d+\)$/, '').trim();
              groups[groupId] = {
                  groupId,
                  description: cleanDesc,
                  entityName: record.entityName,
                  totalRemaining: 0,
                  nextDueDate: record.dueDate,
                  installmentsCount: 0,
                  installmentsPaid: 0,
                  records: []
              };
          }
          const g = groups[groupId];
          g.records.push(record);
          g.installmentsCount++;
          if (record.status === 'paid') {
              g.installmentsPaid++;
          } else {
              g.totalRemaining += record.amount;
              if (new Date(record.dueDate) < new Date(g.nextDueDate) || g.totalRemaining === record.amount) {
                  g.nextDueDate = record.dueDate;
              }
          }
      });
      return Object.values(groups).sort((a, b) => {
          if (a.totalRemaining === 0 && b.totalRemaining === 0) return new Date(b.nextDueDate).getTime() - new Date(a.nextDueDate).getTime();
          if (a.totalRemaining === 0) return 1;
          if (b.totalRemaining === 0) return -1;
          return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
      });
  }, [rawPayables]);

  useEffect(() => {
      if (selectedGroup) {
          const updatedGroup = groupedPayables.find(g => g.groupId === selectedGroup.groupId);
          if (updatedGroup) setSelectedGroup(updatedGroup);
      }
      if (viewHistoryGroup) {
          const updatedGroup = groupedPayables.find(g => g.groupId === viewHistoryGroup.groupId);
          if (updatedGroup) setViewHistoryGroup(updatedGroup);
      }
  }, [groupedPayables]);

  // --- ACTIONS ---

  const handleOpenNewBill = () => {
      setDescription('');
      setValue('');
      setDueDate(new Date().toISOString().split('T')[0]);
      setStatus('pending');
      setInstallments(1);
      setAlertEnabled(true);
      setWizFlow({ active: false, currentStep: 1, totalSteps: 1, dates: [], baseData: null });
      setShowNewBillModal(true);
  };

  const handleInitialSubmit = () => {
      if (!description || !value) { alert("Preencha descrição e valor."); return; }
      const numVal = parseFloat(value);
      if (isNaN(numVal) || numVal <= 0) { alert("Valor inválido."); return; }

      if (installments === 1) {
          const docId = Math.floor(100000 + Math.random() * 900000).toString();
          const record: FinancialRecord = {
              id: Date.now().toString(),
              documentNumber: docId,
              description: description,
              amount: numVal,
              originalAmount: numVal,
              type: 'payable',
              // FIX: Delegate normalization to context (don't force T12:00:00)
              dueDate: dueDate, 
              status: status,
              entityName: 'Despesa Avulsa',
              history: []
          };
          addFinancialRecord(record);
          setShowNewBillModal(false);
      } else {
          setWizFlow({
              active: true, currentStep: 1, totalSteps: installments, dates: [],
              baseData: { description, totalValue: numVal, status, alertEnabled }
          });
          // Move to next month for wizard flow start
          const today = new Date();
          today.setMonth(today.getMonth() + 1);
          setDueDate(today.toISOString().split('T')[0]);
      }
  };

  const handleWizardStep = () => {
      if (!dueDate) return;
      // Store raw date string, let context normalize later
      const newDates = [...wizFlow.dates, dueDate];
      
      const nextDate = new Date(dueDate + 'T00:00:00'); // Local time construction helper
      nextDate.setMonth(nextDate.getMonth() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];

      if (wizFlow.currentStep < wizFlow.totalSteps) {
          setWizFlow(prev => ({ ...prev, currentStep: prev.currentStep + 1, dates: newDates }));
          setDueDate(nextDateStr);
      } else {
          const { baseData } = wizFlow;
          if (!baseData) return;
          const installmentValue = baseData.totalValue / wizFlow.totalSteps;
          const docId = Math.floor(100000 + Math.random() * 900000).toString();
          
          newDates.forEach((dateStr, index) => {
              addFinancialRecord({
                  id: Date.now().toString() + index,
                  documentNumber: docId,
                  description: `${baseData.description} (${index + 1}/${wizFlow.totalSteps})`,
                  amount: installmentValue,
                  originalAmount: installmentValue,
                  type: 'payable',
                  dueDate: dateStr, // Pass raw string
                  status: baseData.status,
                  entityName: 'Despesa Parcelada',
                  history: []
              });
          });
          setShowNewBillModal(false);
      }
  };

  // ... (Rest of Payables.tsx: handleUpdateDate, handleDeleteRecord, Render logic... No changes)
  const handleUpdateDate = (id: string) => {
      if (!newDateVal) return;
      // Just pass the date string, context will normalize
      updateFinancialRecord(id, { dueDate: newDateVal }); 
      setIsEditingDate(null);
      
      // Optimistic Update for UI smoothness (optional but good)
      if (selectedGroup) {
          // Manually construct local midnight iso for immediate feedback if needed, 
          // but relying on context update is safer.
          // We'll let the effect/memo handle the re-render from context.
      }
  };

  const handleDeleteRecord = (id: string) => {
      setConfirmConfig({
          isOpen: true,
          title: "Excluir Parcela",
          message: "Tem certeza que deseja excluir esta parcela?",
          onConfirm: () => {
              removeFinancialRecord(id);
              if (selectedGroup) {
                  const updatedRecords = selectedGroup.records.filter(r => r.id !== id);
                  if (updatedRecords.length === 0) setSelectedGroup(null);
                  else setSelectedGroup({ ...selectedGroup, records: updatedRecords });
              }
          }
      });
  };

  const handleDeleteGroup = (docId: string) => {
      setConfirmConfig({
          isOpen: true,
          title: "Excluir Conta Completa",
          message: "ATENÇÃO: Deseja excluir TODAS as parcelas desta conta?",
          onConfirm: () => {
              removeFinancialGroup(docId);
              setSelectedGroup(null);
          }
      });
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      
      {/* HEADER & NEW BUTTON */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
            <h2 className="text-3xl font-bold text-slate-800">Contas a Pagar</h2>
            <p className="text-slate-500 text-sm">Gerencie despesas agrupadas e pagamentos</p>
        </div>
        <button onClick={handleOpenNewBill} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-95 w-full md:w-auto justify-center"><Plus size={20} /> Nova Conta</button>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex flex-col gap-1 w-full md:w-auto"><label className="text-xs font-bold text-slate-500 flex items-center gap-1"><Filter size={12}/> Filtrar por</label><select className="p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 outline-none focus:border-blue-500" value={filterType} onChange={(e) => setFilterType(e.target.value as any)}><option value="all">Todas as Contas</option><option value="name">Nome (Fornecedor)</option><option value="description">Descrição (Conta)</option><option value="date">Data de Vencimento</option><option value="value">Valor Exato</option></select></div>
          {filterType === 'date' ? (<div className="flex gap-2 w-full md:w-auto flex-1"><div className="flex-1"><label className="text-xs font-bold text-slate-500 block mb-1">De</label><input type="date" className="w-full p-2 border border-slate-300 rounded-lg text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} /></div><div className="flex-1"><label className="text-xs font-bold text-slate-500 block mb-1">Até</label><input type="date" className="w-full p-2 border border-slate-300 rounded-lg text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} /></div></div>) : filterType !== 'all' ? (<div className="flex-1 w-full"><label className="text-xs font-bold text-slate-500 block mb-1">Buscar</label><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input type="text" placeholder={filterType === 'value' ? '0.00' : 'Digite para buscar...'} className="w-full pl-9 p-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none" value={filterValue} onChange={e => setFilterValue(e.target.value)} /></div></div>) : (<div className="flex-1 text-sm text-slate-400 italic self-center">Mostrando todas as contas pendentes e pagas.</div>)}
      </div>

      {/* CARDS GRID */}
      {groupedPayables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[40vh] text-slate-400"><DollarSign size={48} className="mb-2 opacity-20" /><p>Nenhuma conta encontrada.</p></div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedPayables.map(group => {
                  const isFullyPaid = group.totalRemaining <= 0;
                  const dateObj = new Date(group.nextDueDate);
                  const isLate = !isFullyPaid && dateObj < new Date();
                  
                  return (
                      <div key={group.groupId} onClick={() => setSelectedGroup(group)} className={`bg-white p-5 rounded-xl border shadow-sm relative overflow-hidden transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer ${isFullyPaid ? 'border-green-100' : isLate ? 'border-red-200' : 'border-slate-200'}`}>
                          {isLate && !isFullyPaid && <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">VENCIDO</div>}
                          {isFullyPaid && <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">CONCLUÍDO</div>}
                          <div className="flex justify-between items-start mb-2 pr-6"><div><h4 className="font-bold text-slate-800 text-lg line-clamp-1">{group.description}</h4><span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{group.entityName}</span></div></div>
                          <div className="flex justify-between items-end mt-4"><div><div className="flex items-center gap-1 text-slate-500 text-xs mb-1"><Layers size={12} /><span>{group.installmentsPaid}/{group.installmentsCount} pagas</span></div>{!isFullyPaid && (<div className="flex items-center gap-2 text-slate-500 text-sm font-medium"><Calendar size={16} className={isLate ? 'text-red-500' : 'text-slate-400'} /><span className={isLate ? 'text-red-600' : ''}>{dateObj.toLocaleDateString('pt-BR')}</span></div>)}</div><div className="text-right"><span className="text-xs text-slate-400 block">Restante</span><div className="flex items-center justify-end gap-2"><button onClick={(e) => { e.stopPropagation(); setViewHistoryGroup(group); }} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-500 transition-colors" title="Ver histórico de pagamentos"><Eye size={18} /></button><div className={`text-xl font-bold ${isFullyPaid ? 'text-green-600' : 'text-red-600'}`}>R$ {group.totalRemaining.toFixed(2)}</div></div></div></div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden"><div className={`h-full rounded-full ${isFullyPaid ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${(group.installmentsPaid / group.installmentsCount) * 100}%` }}/></div>
                      </div>
                  );
              })}
          </div>
      )}

      {/* NEW ACCOUNT WIZARD MODAL */}
      {showNewBillModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                  <div className="p-6 pb-0">
                      <div className="flex justify-between items-center mb-1"><h3 className="text-xl font-bold text-slate-800">{wizFlow.active ? `Parcela ${wizFlow.currentStep} de ${wizFlow.totalSteps}` : 'Nova Conta a Pagar'}</h3>{!wizFlow.active && <button onClick={() => setShowNewBillModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>}</div>
                      {wizFlow.active && <p className="text-sm text-slate-500">Defina a data de vencimento desta parcela.</p>}
                  </div>
                  <div className="p-6 pt-4 space-y-4">
                      {!wizFlow.active ? (
                          <>
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Descrição</label><input className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700" placeholder="Ex: Aluguel" value={description} onChange={e => setDescription(e.target.value)} autoFocus /></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-slate-700 mb-1">Valor Total (R$)</label><input type="number" className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700" placeholder="0.00" value={value} onChange={e => setValue(e.target.value)} /></div><div><label className="block text-sm font-bold text-slate-700 mb-1">Parcelas</label><input type="number" min="1" max="60" className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700" value={installments} onChange={e => setInstallments(parseInt(e.target.value) || 1)} /></div></div>
                            {installments === 1 && (<div><label className="block text-sm font-bold text-slate-700 mb-1">Vencimento</label><input type="date" className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>)}
                            <div><label className="block text-sm font-bold text-slate-700 mb-1">Status Inicial</label><select className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-white" value={status} onChange={(e) => setStatus(e.target.value as 'pending' | 'paid')}><option value="pending">A PAGAR</option><option value="paid">PAGO</option></select></div>
                            <div className="flex gap-3 pt-4"><button onClick={() => setShowNewBillModal(false)} className="flex-1 text-slate-500 font-medium hover:bg-slate-50 py-3 rounded-lg transition-colors">Cancelar</button><button onClick={handleInitialSubmit} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md">{installments > 1 ? 'Continuar' : 'Salvar Conta'}</button></div>
                          </>
                      ) : (
                          <div className="animate-fade-in">
                              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6 text-center"><span className="block text-xs uppercase tracking-wide text-blue-500 font-bold mb-1">Valor da Parcela</span><span className="text-2xl font-bold text-blue-800">R$ {(wizFlow.baseData!.totalValue / wizFlow.totalSteps).toFixed(2)}</span></div>
                              <div><label className="block text-sm font-bold text-slate-700 mb-2">Data de Vencimento</label><div className="relative"><Calendar className="absolute left-3 top-3 text-slate-400" size={20} /><input type="date" className="w-full pl-10 border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 text-lg" value={dueDate} onChange={e => setDueDate(e.target.value)} autoFocus /></div></div>
                              <div className="pt-8"><button onClick={handleWizardStep} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center gap-2">{wizFlow.currentStep === wizFlow.totalSteps ? (<><Check size={20} /> Finalizar e Salvar</>) : (<><ChevronRight size={20} /> Próxima Parcela</>)}</button></div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* GROUP DETAILS MODAL (EXPANDED LIST) */}
      {selectedGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0"><div><h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><Wallet size={20} /> {selectedGroup.description}</h3><p className="text-sm text-slate-500">{selectedGroup.entityName} • {selectedGroup.records.length} parcelas</p></div><button onClick={() => setSelectedGroup(null)} className="p-2 bg-white hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={20} /></button></div>
                  <div className="p-0 overflow-y-auto flex-1 bg-slate-50"><div className="divide-y divide-slate-200">{selectedGroup.records.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(record => { const isPaid = record.status === 'paid'; const dateObj = new Date(record.dueDate); dateObj.setHours(0,0,0,0); const today = new Date(); today.setHours(0,0,0,0); let statusText = ""; let statusClass = "bg-blue-100 text-blue-700"; if (isPaid) { statusText = "PAGO"; statusClass = "bg-green-100 text-green-700"; } else { if (dateObj.getTime() < today.getTime()) { statusText = "VENCIDO"; statusClass = "bg-red-100 text-red-700"; } else if (dateObj.getTime() === today.getTime()) { statusText = "VENCE HOJE"; statusClass = "bg-orange-100 text-orange-700"; } else if (dateObj.getTime() === today.getTime() + 86400000) { statusText = "VENCE AMANHÃ"; statusClass = "bg-yellow-100 text-yellow-700"; } else { statusText = "ABERTO"; } } const isEditing = isEditingDate === record.id; return (<div key={record.id} className={`p-4 flex items-center justify-between transition-colors ${isPaid ? 'bg-slate-50 opacity-100' : 'bg-white hover:bg-blue-50'}`}><div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-bold text-slate-700 text-sm">{record.description}</span><span className={`${statusClass} text-[10px] px-2 py-0.5 rounded font-bold`}>{statusText}</span></div>{isEditing ? (<div className="flex items-center gap-2"><input type="date" className="border rounded p-1 text-sm" value={newDateVal} onChange={e => setNewDateVal(e.target.value)} /><button onClick={() => handleUpdateDate(record.id)} className="bg-green-500 text-white p-1 rounded hover:bg-green-600"><Check size={14}/></button><button onClick={() => setIsEditingDate(null)} className="bg-red-500 text-white p-1 rounded hover:bg-red-600"><X size={14}/></button></div>) : (<div className="flex items-center gap-2 text-sm text-slate-500 group"><Calendar size={14} /><span>{new Date(record.dueDate).toLocaleDateString('pt-BR')}</span>{!isPaid && (<button onClick={() => { setIsEditingDate(record.id); setNewDateVal(record.dueDate.split('T')[0]); }} className="text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12} /></button>)}</div>)}</div><div className="text-right flex items-center gap-4"><div><span className={`block font-bold ${isPaid ? 'text-green-600' : 'text-slate-800'}`}>R$ {record.amount.toFixed(2)}</span></div><div className="flex gap-2">{!isPaid ? (<button onClick={() => setInstallmentToPay(record)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded flex items-center gap-1 shadow-sm transition-transform active:scale-95" title="Pagar esta parcela"><DollarSign size={14} /> Pagar</button>) : (<div className="text-green-500 p-2 rounded-full border border-green-100 bg-green-50"><Check size={16} /></div>)}<button onClick={() => handleDeleteRecord(record.id)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Excluir parcela"><Trash2 size={16} /></button></div></div></div>); })}</div></div>
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center"><div className="text-xs text-slate-400">ID Grupo: {selectedGroup.groupId}</div><button onClick={() => handleDeleteGroup(selectedGroup.groupId)} className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-bold transition-colors"><Trash2 size={16} /> Excluir Conta Inteira</button></div>
              </div>
          </div>
      )}

      {/* HISTORY MODAL */}
      {viewHistoryGroup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0"><div><h3 className="font-bold text-lg text-slate-800">Histórico de Pagamentos</h3><p className="text-xs text-slate-500">{viewHistoryGroup.description} • {viewHistoryGroup.entityName}</p></div><button onClick={() => setViewHistoryGroup(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button></div>
                  <div className="p-0 overflow-y-auto flex-1">{(() => { const allHistory = viewHistoryGroup.records.flatMap(r => (r.history || []).map(h => ({...h, origin: r.description}))).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); const totalPaid = allHistory.reduce((acc, h) => acc + h.amount, 0); if (allHistory.length === 0) { return <div className="p-8 text-center text-slate-400 text-sm">Nenhum pagamento realizado nesta conta.</div>; } return (<><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100"><tr><th className="p-3">Data</th><th className="p-3">Referência</th><th className="p-3 text-right">Valor Pago</th></tr></thead><tbody className="divide-y divide-slate-100">{allHistory.map((h, idx) => (<tr key={idx} className="hover:bg-slate-50"><td className="p-3 text-slate-600">{new Date(h.date).toLocaleDateString('pt-BR')} <span className="text-[10px] text-slate-400 block">{new Date(h.date).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span></td><td className="p-3 text-slate-500 text-xs">{h.origin}</td><td className="p-3 text-right font-bold text-green-600">R$ {h.amount.toFixed(2)}</td></tr>))}</tbody></table><div className="p-4 bg-green-50 border-t border-green-100 flex justify-between items-center mt-auto"><span className="text-green-800 font-medium">Total Pago</span><span className="text-xl font-bold text-green-700">R$ {totalPaid.toFixed(2)}</span></div></>); })()}</div>
              </div>
          </div>
      )}

      {/* PAYMENT CONFIRMATION MODAL */}
      {installmentToPay && (
          <PaymentModal record={installmentToPay} onClose={() => { setInstallmentToPay(null); }} />
      )}

      {/* Confirmation Modal Render */}
      {confirmConfig && <ConfirmModal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig(null)} onConfirm={confirmConfig.onConfirm} title={confirmConfig.title} message={confirmConfig.message} isDangerous={true} confirmText="Sim, Excluir" />}
    </div>
  );
};
