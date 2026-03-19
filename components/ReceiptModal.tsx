
import React, { useMemo } from 'react';
import { Sale, CompanySettings, Customer } from '../types';
import { X, Printer, MessageCircle, Share2, ArrowLeft } from 'lucide-react';
import { generateReceiptContent, printHtml } from '../services/printerService';
import { useStore } from '../context/StoreContext';

interface ReceiptModalProps {
  sale: Sale;
  settings: CompanySettings;
  customer?: Customer;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, settings, customer, onClose }) => {
  const { financialRecords } = useStore();

  // Filter records related to this sale to display accurate status on receipt
  // UPDATED: Checks both documentNumber AND description to ensure all installments are found
  const relatedRecords = useMemo(() => {
      return financialRecords.filter(r => 
          r.documentNumber === sale.id || 
          r.description.includes(`Venda #${sale.id}`)
      );
  }, [financialRecords, sale.id]);
  
  const receiptHtml = useMemo(() => {
      return generateReceiptContent(sale, settings, customer, relatedRecords);
  }, [sale, settings, customer, relatedRecords]);

  const handlePrint = () => {
      printHtml(receiptHtml);
  };

  const handleWhatsApp = () => {
      if (!customer?.phone) {
          alert("Este cliente não possui telefone cadastrado.");
          return;
      }
      
      // Basic text message for WhatsApp
      let msg = settings.whatsappMessageTemplate
        .replace('{cliente}', customer.name)
        .replace('{pedido}', sale.id)
        .replace('{valor}', sale.total.toFixed(2));
      
      // Add summary link or text
      const summary = `Olá ${customer.name}, aqui está o resumo da sua compra #${sale.id}.\nTotal: R$ ${sale.total.toFixed(2)}\nData: ${new Date(sale.date).toLocaleDateString('pt-BR')}`;
      
      window.open(`https://wa.me/55${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(summary)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-100 flex flex-col animate-fade-in">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg flex items-center gap-2">
                <Printer size={20} className="text-blue-400" /> Visualizar Cupom
            </h3>
            <button onClick={onClose} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Content Preview */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center">
            <div className="bg-white shadow-2xl h-fit min-h-[300px]">
                {/* Render HTML safely */}
                <div dangerouslySetInnerHTML={{ __html: receiptHtml }} />
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex flex-col md:flex-row gap-3 shrink-0">
            <button 
                onClick={handlePrint}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
            >
                <Printer size={24} /> Imprimir
            </button>
            
            <button 
                onClick={handleWhatsApp}
                disabled={!customer?.phone}
                className={`flex-1 py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 ${!customer?.phone ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'}`}
            >
                <MessageCircle size={24} /> Enviar Whats
            </button>

            <button 
                onClick={onClose}
                className="md:hidden w-full bg-slate-200 text-slate-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            >
                <ArrowLeft size={20} /> Voltar
            </button>
        </div>
    </div>
  );
};
