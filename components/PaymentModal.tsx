
// ... existing imports
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { FinancialRecord, Sale, SalePayment } from '../types';
import { Check, Clock, MessageCircle, X, History, QrCode, Copy, Receipt, ChevronDown, ChevronUp, Printer, Calendar, AlertCircle, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';

// ... (Keep existing helpers crc16, formatField, removeAccents, generatePixPayload same as before)
const crc16 = (buffer: string) => {
  let crc = 0xFFFF;
  const length = buffer.length;
  for (let i = 0; i < length; i++) {
    crc ^= buffer.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
};

const formatField = (id: string, value: string) => {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
};

const removeAccents = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase();
};

const generatePixPayload = (key: string, name: string, city: string, amount: string, txid: string = '***') => {
  const cleanKey = key.replace(/[^a-zA-Z0-9@.+]/g, ""); 
  const cleanAmount = parseFloat(amount).toFixed(2);
  const cleanName = removeAccents(name || 'Recebedor').substring(0, 25);
  const cleanCity = removeAccents(city || 'BRASIL').substring(0, 15);
  let cleanTxid = txid === '***' ? '***' : txid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!cleanTxid) cleanTxid = '***';

  const payload = 
    formatField('00', '01') + 
    formatField('01', '12') + 
    formatField('26', 
      formatField('00', 'BR.GOV.BCB.PIX') +
      formatField('01', cleanKey)
    ) +
    formatField('52', '0000') + 
    formatField('53', '986') + 
    formatField('54', cleanAmount) + 
    formatField('58', 'BR') + 
    formatField('59', cleanName) + 
    formatField('60', cleanCity) + 
    formatField('62', 
       formatField('05', cleanTxid)
    ) + 
    '6304'; 

  return payload + crc16(payload);
};

interface PaymentModalProps {
  record: FinancialRecord;
  onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ record, onClose }) => {
  const { registerPayment, settings, customers, sales, financialRecords } = useStore();
  const [paymentAmount, setPaymentAmount] = useState<string>(record.amount.toString());
  const [showHistory, setShowHistory] = useState(false);
  const [showPix, setShowPix] = useState(false);
  const [pixPayload, setPixPayload] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  // State for Receipt Modal
  const [showReceipt, setShowReceipt] = useState(false);
  
  // State to toggle Linked Sale Details (defaulting to false to save space)
  const [expandSaleDetails, setExpandSaleDetails] = useState(false);

  // Check if fully paid
  const isFullyPaid = record.status === 'paid' || record.amount <= 0.01;

  const handlePayment = () => {
    if (!paymentAmount) return;
    const value = parseFloat(paymentAmount);
    if (isNaN(value) || value <= 0) return;
    if (value > record.amount) { alert("Valor maior que o saldo."); return; }
    
    registerPayment(record.id, value);
    onClose();
    alert("Pagamento registrado!");
  };

  const generatePix = () => {
    if (!settings.pixKey) { alert("Configure a chave Pix."); return; }
    try {
        const payload = generatePixPayload(settings.pixKey, settings.name || 'Minha Loja', 'BRASIL', paymentAmount);
        setPixPayload(payload);
        setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(payload)}`);
        setShowPix(true);
    } catch (error) { alert("Erro ao gerar Pix."); }
  };

  const copyPix = () => { navigator.clipboard.writeText(pixPayload); alert("Copiado!"); };

  const getWhatsAppLink = (rec: FinancialRecord, withPix: boolean = false) => {
    const customer = customers.find(c => c.name === rec.entityName);
    const phone = customer?.phone;
    if (!phone) { return null; }
    let msg = settings.whatsappMessageTemplate.replace('{cliente}', rec.entityName).replace('{pedido}', rec.description).replace('{valor}', parseFloat(paymentAmount).toFixed(2));
    if (withPix && pixPayload) msg += `\n\n💰 Pix Copia e Cola:\n${pixPayload}`;
    return `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
  };

  // Find linked sale for the selected record
  const linkedSaleForRecord = useMemo(() => {
    // Extract Sale ID from description "Venda #123 ..."
    const match = record.description.match(/Venda #(\d+)/);
    if (match && match[1]) {
        return sales.find(s => s.id === match[1]);
    }
    return null;
  }, [record, sales]);

  // Find all financial records related to the linked sale to check status of installments
  const linkedSaleRecords = useMemo(() => {
      if (!linkedSaleForRecord) return [];
      return financialRecords.filter(r => 
          r.documentNumber === linkedSaleForRecord.id || 
          r.description.includes(`Venda #${linkedSaleForRecord.id}`)
      ).sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [linkedSaleForRecord, financialRecords]);

  // ... (Keep getInstallmentDetails logic same as before)
  const getInstallmentDetails = (payment: SalePayment) => {
      let label = payment.method as string;
      if (payment.method === 'A Prazo') {
          if (payment.installmentNumber && payment.totalInstallments) { label = `A Prazo (${payment.installmentNumber}/${payment.totalInstallments})`; } else { label = `A Prazo`; }
      }
      if (payment.method !== 'A Prazo') { const paidDate = linkedSaleForRecord ? new Date(linkedSaleForRecord.date).toLocaleDateString('pt-BR') : ''; return { text: `${label} - Pago - ${paidDate}`, statusColor: 'text-green-700 font-medium' }; }
      const pDate = payment.dueDate ? new Date(payment.dueDate).toISOString().split('T')[0] : null;
      const match = linkedSaleRecords.find(r => { const rDate = new Date(r.dueDate).toISOString().split('T')[0]; const amtMatch = Math.abs(r.originalAmount - payment.amount) < 0.05; if (pDate) { return amtMatch && rDate === pDate; } return amtMatch; });
      if (match) {
          if (match.status === 'paid') { let payDate = ''; if (match.history && match.history.length > 0) { payDate = new Date(match.history[match.history.length - 1].date).toLocaleDateString('pt-BR'); } return { text: `${label} - Pago - ${payDate}`, statusColor: 'text-green-700 font-medium' }; } else { const today = new Date(); today.setHours(0,0,0,0); const due = new Date(match.dueDate); due.setHours(0,0,0,0); const dueDateStr = due.toLocaleDateString('pt-BR'); const diffTime = due.getTime() - today.getTime(); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); if (diffDays < 0) { return { text: `${label} - Vencido - ${dueDateStr}`, statusColor: 'text-red-600 font-bold' }; } else if (diffDays === 0) { return { text: `${label} - Vencendo Hoje`, statusColor: 'text-orange-600 font-bold' }; } else if (diffDays === 1) { return { text: `${label} - Vence Amanhã`, statusColor: 'text-orange-600 font-bold' }; } else { return { text: `${label} - Vence - ${dueDateStr}`, statusColor: 'text-slate-600' }; } }
      } else { return { text: `${label} - N/A`, statusColor: 'text-slate-400' }; }
  };

  const handleReprint = () => { if (linkedSaleForRecord) setShowReceipt(true); };

  if (showReceipt && linkedSaleForRecord) {
      const customer = customers.find(c => c.id === linkedSaleForRecord.customerId);
      return ( <ReceiptModal sale={linkedSaleForRecord} settings={settings} customer={customer} onClose={() => setShowReceipt(false)} /> );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-hidden">
            <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <h3 className="font-bold text-lg text-slate-800">{record.type === 'receivable' ? 'Pagamentos' : 'Pagar Conta'}</h3>
                <button onClick={onClose} className="p-2 bg-slate-200 rounded-full hover:bg-slate-300 text-slate-600 transition-colors"><X size={20} /></button>
            </div>

            <div className="p-4 md:p-6 space-y-4 overflow-y-auto">
                {!showHistory && (
                    <>
                        <div className="flex justify-between items-start">
                            <div><p className="text-sm text-slate-500">{record.entityName}</p><p className="text-xs text-slate-400">{record.description}</p></div>
                            <div className="text-right"><p className="text-sm text-slate-500">Valor Desta Parcela</p><p className="font-bold text-slate-600">R$ {record.originalAmount?.toFixed(2) || record.amount.toFixed(2)}</p></div>
                        </div>

                        {/* PARTIAL PAYMENTS HISTORY BLOCK (NEW) */}
                        {record.history && record.history.length > 0 && (
                            <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-xs space-y-2">
                                <div className="flex justify-between font-bold text-green-800 border-b border-green-200 pb-1">
                                    <span>Baixas Realizadas</span>
                                    <span>Total Pago: R$ {record.history.reduce((a,h) => a + h.amount, 0).toFixed(2)}</span>
                                </div>
                                {record.history.map((h, i) => (
                                    <div key={i} className="flex justify-between text-green-700">
                                        <span>{new Date(h.date).toLocaleDateString()}</span>
                                        <span>+ R$ {h.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {linkedSaleForRecord && (
                            <div className="bg-blue-50 rounded-lg border border-blue-100 text-sm overflow-hidden transition-all">
                                <button onClick={() => setExpandSaleDetails(!expandSaleDetails)} className="w-full flex items-center justify-between p-3 bg-blue-100/50 hover:bg-blue-100 transition-colors"><div className="flex items-center gap-2 font-bold text-blue-800"><Receipt size={14} /> Resumo da Venda Original (#{linkedSaleForRecord.id})</div><div className="text-blue-600">{expandSaleDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div></button>
                                {expandSaleDetails && ( <div className="p-3 border-t border-blue-100 animate-fade-in"><div className="space-y-1 mb-2"><div className="flex justify-between"><span className="text-blue-700">Total da Venda:</span><span className="font-bold text-blue-900">R$ {linkedSaleForRecord.total.toFixed(2)}</span></div><div className="flex justify-between text-xs text-slate-500"><span>Itens:</span><span>{linkedSaleForRecord.items.length} produtos</span></div></div><div className="bg-white rounded p-2 text-xs space-y-1 border border-blue-100 max-h-40 overflow-y-auto"><p className="font-medium text-slate-600 mb-1">Formas de Pagamento:</p>{linkedSaleForRecord.payments.map((p, i) => { const { text, statusColor } = getInstallmentDetails(p); return (<div key={i} className="flex justify-between items-center border-b border-slate-50 last:border-0 py-1.5"><div className={statusColor}>{text}</div><span className="text-slate-700 font-medium">R$ {p.amount.toFixed(2)}</span></div>); })}</div></div> )}
                            </div>
                        )}

                        {!isFullyPaid && ( <div className="bg-slate-100 p-4 rounded-lg flex justify-between items-center"><span className="text-slate-600 font-medium">Restante a Pagar:</span><span className="text-xl font-bold text-primary">R$ {record.amount.toFixed(2)}</span></div> )}
                        
                        <div className="space-y-4">
                            {!isFullyPaid && ( <div><label className="block text-sm font-medium text-slate-600 mb-1">Valor do Pagamento</label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">R$</span><input type="number" className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-accent outline-none font-bold text-slate-800" value={paymentAmount} onChange={(e) => { setPaymentAmount(e.target.value); setShowPix(false); }} /></div></div> )}
                            <div className="grid grid-cols-2 gap-3 pb-2">
                                {!isFullyPaid && ( <><button onClick={handlePayment} className="col-span-2 bg-success hover:bg-emerald-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2"><Check size={20} /> Confirmar Baixa</button>{record.type === 'receivable' && ( <><button onClick={generatePix} className="col-span-2 bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg font-medium flex justify-center items-center gap-2"><QrCode size={18} /> {showPix ? 'Atualizar Pix' : 'Gerar Pix'}</button>{showPix && (<div className="col-span-2 bg-slate-50 rounded-lg p-4 border border-slate-200 flex flex-col items-center"><img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 mb-3 bg-white p-2 rounded shadow-sm" /><div className="w-full flex flex-col gap-2"><button onClick={copyPix} className="btn-secondary flex justify-center gap-2 border bg-white p-2 rounded"><Copy size={16} /> Copiar</button><a href={getWhatsAppLink(record, true) || '#'} target="_blank" rel="noopener noreferrer" className="flex justify-center gap-2 bg-green-500 text-white p-2 rounded"><MessageCircle size={16} /> WhatsApp</a></div></div>)}{!showPix && (<a href={getWhatsAppLink(record, false) || '#'} target="_blank" rel="noopener noreferrer" className={`col-span-2 flex justify-center gap-2 py-2 rounded-lg border border-green-500 text-green-600 hover:bg-green-50 ${!getWhatsAppLink(record) ? 'opacity-50 pointer-events-none' : ''}`}><MessageCircle size={18} /> Cobrar WhatsApp</a>)}</> )}</> )}
                                {linkedSaleForRecord && ( <button onClick={handleReprint} className="col-span-2 flex justify-center gap-2 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"><Printer size={18} /> Reimprimir Cupom da Venda</button> )}
                                <button onClick={() => setShowHistory(true)} className="col-span-2 flex justify-center gap-2 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"><History size={18} /> Ver Histórico Completo</button>
                            </div>
                        </div>
                    </>
                )}

                {showHistory && (
                    <div className="animate-fade-in h-full flex flex-col">
                        <div className="flex items-center gap-2 mb-4 text-slate-700 font-bold border-b border-slate-100 pb-2"><History size={20} className="text-blue-600" /> Histórico Financeiro da Venda</div>
                        <div className="flex-1 overflow-y-auto pr-1">
                            {linkedSaleRecords.length > 0 ? (
                                <div className="space-y-3">
                                    {linkedSaleRecords.map((r, idx) => {
                                        const isPaid = r.status === 'paid'; const today = new Date(); today.setHours(0,0,0,0); const due = new Date(r.dueDate); due.setHours(0,0,0,0); const diffTime = due.getTime() - today.getTime(); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        let cardBorder = "border-slate-200"; let icon = <Clock size={16} className="text-slate-400" />; let statusLabel = "";
                                        if (isPaid) { cardBorder = "border-green-200 bg-green-50"; icon = <CheckCircle size={16} className="text-green-600" />; statusLabel = "PAGO"; } else if (diffDays < 0) { cardBorder = "border-red-200 bg-red-50"; icon = <AlertCircle size={16} className="text-red-500" />; statusLabel = "VENCIDO"; } else if (diffDays === 0) { cardBorder = "border-orange-200 bg-orange-50"; icon = <AlertTriangle size={16} className="text-orange-500" />; statusLabel = "VENCE HOJE"; } else if (diffDays === 1) { cardBorder = "border-orange-200 bg-orange-50"; icon = <AlertTriangle size={16} className="text-orange-500" />; statusLabel = "VENCE AMANHÃ"; } else { statusLabel = "A VENCER"; }
                                        return (
                                            <div key={r.id} className={`p-3 rounded-lg border ${cardBorder} relative overflow-hidden`}>
                                                <div className="flex justify-between items-start mb-1"><div className="font-bold text-slate-700 text-sm">{r.description.replace(/Venda #\d+\s?/, '') || 'Parcela'}</div><div className="font-bold text-slate-800">R$ {r.originalAmount.toFixed(2)}</div></div>
                                                {/* LISTA DETALHADA DE PAGAMENTOS/BAIXAS */}
                                                {r.history && r.history.length > 0 && (
                                                    <div className="my-2 bg-white/50 rounded border border-slate-100 p-2">
                                                        <p className="text-[10px] font-bold text-slate-500 mb-1 uppercase">Baixas Realizadas:</p>
                                                        {r.history.map((h, hIdx) => (
                                                            <div key={hIdx} className="flex justify-between items-center text-[10px] border-b border-slate-100 last:border-0 py-0.5">
                                                                <span className="text-slate-600">{new Date(h.date).toLocaleDateString('pt-BR')} <span className="text-[9px] text-slate-400 ml-1">{new Date(h.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span></span>
                                                                <span className="font-bold text-green-600">R$ {h.amount.toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-end mt-2 text-xs"><div><div className="flex items-center gap-1 text-slate-500 mb-1"><Calendar size={12} /> Vencimento: <span className="font-medium text-slate-700">{new Date(r.dueDate).toLocaleDateString('pt-BR')}</span></div>{!isPaid && diffDays < 0 && (<div className="text-red-600 font-bold">Atrasado há {Math.abs(diffDays)} dias</div>)}{!isPaid && diffDays >= 0 && (<div className="text-blue-600">Faltam {diffDays} dias</div>)}</div><div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border bg-white ${isPaid ? 'text-green-600 border-green-200' : 'text-slate-500 border-slate-200'}`}>{icon} {statusLabel}</div></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (<div className="text-center py-10 text-slate-400">Histórico não disponível para registro avulso.</div>)}
                        </div>
                        <button onClick={() => setShowHistory(false)} className="w-full mt-4 bg-white border border-slate-300 text-slate-700 py-3 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors">Voltar para Pagamento</button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
