
import React, { useState, useMemo } from 'react';
import { Customer, MessageTemplate } from '../types';
import { useStore } from '../context/StoreContext';
import { X, Search, Send, MessageSquare, List, MessageSquareText } from 'lucide-react';

interface MessageSelectorModalProps {
  customer: Customer;
  onClose: () => void;
}

export const MessageSelectorModal: React.FC<MessageSelectorModalProps> = ({ customer, onClose }) => {
  const { messageTemplates } = useStore();
  const [view, setView] = useState<'initial' | 'templates'>('initial');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Get unique categories for filter
  const categories = useMemo(() => Array.from(new Set(messageTemplates.map(m => m.category))), [messageTemplates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return messageTemplates.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                            t.content.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter ? t.category === categoryFilter : true;
      return matchesSearch && matchesCategory;
    });
  }, [messageTemplates, search, categoryFilter]);

  const handleDirectMessage = () => {
    if (!customer.phone) {
        alert("Cliente sem telefone cadastrado.");
        return;
    }
    const phone = customer.phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}`, '_blank');
    onClose();
  };

  const handleTemplateMessage = (template: MessageTemplate) => {
    if (!customer.phone) {
        alert("Cliente sem telefone cadastrado.");
        return;
    }
    const phone = customer.phone.replace(/\D/g, '');
    const text = template.content.replace('{cliente}', customer.name); // Simple replacement logic if desired
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <MessageSquareText size={20} className="text-blue-600"/> Enviar Mensagem
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
            </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
            
            {/* INITIAL VIEW: CHOICE */}
            {view === 'initial' && (
                <div className="flex flex-col gap-4">
                    <p className="text-slate-600 text-center mb-2">
                        Como deseja enviar a mensagem para <b>{customer.name}</b>?
                    </p>
                    
                    <button 
                        onClick={() => setView('templates')}
                        className="w-full p-4 bg-white border-2 border-blue-100 hover:border-blue-500 rounded-xl flex items-center gap-4 group transition-all"
                    >
                        <div className="bg-blue-100 p-3 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <List size={24} />
                        </div>
                        <div className="text-left">
                            <span className="block font-bold text-slate-800 text-lg">Mensagens Prontas</span>
                            <span className="text-sm text-slate-500">Escolher de modelos salvos</span>
                        </div>
                    </button>

                    <button 
                        onClick={handleDirectMessage}
                        className="w-full p-4 bg-white border-2 border-green-100 hover:border-green-500 rounded-xl flex items-center gap-4 group transition-all"
                    >
                        <div className="bg-green-100 p-3 rounded-full text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                            <MessageSquare size={24} />
                        </div>
                        <div className="text-left">
                            <span className="block font-bold text-slate-800 text-lg">Mensagem Direta</span>
                            <span className="text-sm text-slate-500">Abrir WhatsApp em branco</span>
                        </div>
                    </button>
                </div>
            )}

            {/* TEMPLATES VIEW */}
            {view === 'templates' && (
                <div className="flex flex-col h-full">
                    {/* Filters */}
                    <div className="mb-4 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Buscar modelo..." 
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <select 
                            className="w-full border rounded-lg p-2 text-sm bg-slate-50 focus:outline-none"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="">Todas as Categorias</option>
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
                        {filteredTemplates.length === 0 ? (
                            <div className="text-center text-slate-400 py-8">
                                Nenhum modelo encontrado.
                            </div>
                        ) : (
                            filteredTemplates.map(template => (
                                <div 
                                    key={template.id} 
                                    onClick={() => handleTemplateMessage(template)}
                                    className="p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-colors group"
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="font-bold text-slate-700">{template.title}</h4>
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 uppercase">{template.category}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-2">{template.content}</p>
                                    <div className="mt-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-xs text-blue-600 font-bold flex items-center justify-end gap-1">
                                            Enviar <Send size={12} />
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    
                    <button onClick={() => setView('initial')} className="mt-4 text-sm text-slate-500 hover:text-slate-700 underline text-center w-full">
                        Voltar
                    </button>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};