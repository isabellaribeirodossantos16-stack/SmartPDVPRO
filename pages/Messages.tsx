
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Search, Plus, Save, Trash2, Edit2, MessageSquareText, Filter, X } from 'lucide-react';
import { MessageTemplate } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

export const Messages = () => {
  const { messageTemplates, addMessageTemplate, updateMessageTemplate, removeMessageTemplate, isFreeVersion } = useStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  const [formData, setFormData] = useState<Partial<MessageTemplate>>({
      title: '',
      category: '',
      content: ''
  });

  const categories = useMemo(() => Array.from(new Set(messageTemplates.map(m => m.category))), [messageTemplates]);

  const filteredMessages = useMemo(() => {
      return messageTemplates.filter(t => {
          const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                t.content.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesCategory = categoryFilter ? t.category === categoryFilter : true;
          return matchesSearch && matchesCategory;
      });
  }, [messageTemplates, searchTerm, categoryFilter]);

  const handleEdit = (template: MessageTemplate) => {
      setFormData(template);
      setIsEditing(true);
      setShowForm(true);
  };

  const handleDelete = (id: string) => {
      setConfirmConfig({
          isOpen: true,
          title: "Excluir Modelo",
          message: "Tem certeza que deseja excluir este modelo de mensagem?",
          onConfirm: () => removeMessageTemplate(id)
      });
  };

  const handleSubmit = () => {
      if (!formData.title || !formData.category || !formData.content) {
          alert("Preencha todos os campos.");
          return;
      }

      const templateData = formData as MessageTemplate;

      if (isEditing && formData.id) {
          updateMessageTemplate(templateData);
          alert("Modelo atualizado!");
      } else {
          addMessageTemplate({
              ...templateData,
              id: Date.now().toString()
          });
          alert("Modelo criado!");
      }

      handleCloseForm();
  };

  const handleCloseForm = () => {
      setShowForm(false);
      setIsEditing(false);
      setFormData({ title: '', category: '', content: '' });
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
            <h2 className="text-3xl font-bold text-slate-800">Mensagens</h2>
            <p className="text-slate-500 text-sm">Gerencie modelos de mensagens para WhatsApp</p>
        </div>
        {!showForm && (
            <button 
                onClick={() => { setIsEditing(false); setFormData({title:'', category:'', content:''}); setShowForm(true); }} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 w-full md:w-auto justify-center"
            >
                <Plus size={20} /> Novo Modelo
            </button>
        )}
      </div>

      {showForm ? (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-2xl mx-auto animate-fade-in">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      {isEditing ? <Edit2 size={20} className="text-blue-500"/> : <MessageSquareText size={20} className="text-green-500"/>}
                      {isEditing ? 'Editar Modelo' : 'Novo Modelo'}
                  </h3>
                  <button onClick={handleCloseForm} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
              </div>
              
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Título do Modelo</label>
                      <input 
                          type="text" 
                          className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Ex: Feliz Aniversário Padrão"
                          value={formData.title}
                          onChange={(e) => setFormData({...formData, title: e.target.value})}
                      />
                  </div>
                  
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                      <div className="flex gap-2">
                          <input 
                              type="text" 
                              className="flex-1 border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="Ex: Aniversário, Cobrança, Promoção"
                              value={formData.category}
                              onChange={(e) => setFormData({...formData, category: e.target.value})}
                              list="category-suggestions"
                          />
                          <datalist id="category-suggestions">
                              {categories.map(c => <option key={c} value={c} />)}
                          </datalist>
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Conteúdo da Mensagem</label>
                      <textarea 
                          className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none h-40 text-sm"
                          placeholder="Digite a mensagem aqui..."
                          value={formData.content}
                          onChange={(e) => setFormData({...formData, content: e.target.value})}
                      />
                      <p className="text-xs text-slate-400 mt-1">Dica: Use <b>{'{cliente}'}</b> para inserir o nome do cliente automaticamente.</p>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                      <button onClick={handleCloseForm} className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium">Cancelar</button>
                      <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex items-center gap-2 shadow-md">
                          <Save size={18} /> Salvar
                      </button>
                  </div>
              </div>
          </div>
      ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* FILTERS COLUMN */}
              <div className="lg:col-span-1 space-y-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Filter size={18}/> Filtros</h4>
                      
                      <div className="space-y-3">
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Pesquisar</label>
                              <div className="relative">
                                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                  <input 
                                      className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                      placeholder="Título ou conteúdo..."
                                      value={searchTerm}
                                      onChange={(e) => setSearchTerm(e.target.value)}
                                  />
                              </div>
                          </div>

                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Categoria</label>
                              <select 
                                  className="w-full border rounded-lg p-2 text-sm bg-white focus:outline-none"
                                  value={categoryFilter}
                                  onChange={(e) => setCategoryFilter(e.target.value)}
                              >
                                  <option value="">Todas</option>
                                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                          </div>
                      </div>
                  </div>
              </div>

              {/* LIST COLUMN */}
              <div className="lg:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredMessages.length === 0 ? (
                          <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                              <MessageSquareText size={48} className="mx-auto text-slate-300 mb-3" />
                              <p className="text-slate-500">Nenhum modelo encontrado.</p>
                          </div>
                      ) : (
                          filteredMessages.map(template => (
                              <div key={template.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => handleEdit(template)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Edit2 size={16}/></button>
                                      <button onClick={() => handleDelete(template.id)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 size={16}/></button>
                                  </div>
                                  
                                  <div className="mb-2">
                                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 mb-2 inline-block">
                                          {template.category}
                                      </span>
                                      <h3 className="font-bold text-slate-800 text-lg">{template.title}</h3>
                                  </div>
                                  
                                  <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600 italic border border-slate-100 line-clamp-3 min-h-[4rem]">
                                      "{template.content}"
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {confirmConfig && (
          <ConfirmModal 
              isOpen={confirmConfig.isOpen}
              onClose={() => setConfirmConfig(null)}
              onConfirm={confirmConfig.onConfirm}
              title={confirmConfig.title}
              message={confirmConfig.message}
              isDangerous={true}
              confirmText="Sim, Excluir"
          />
      )}
    </div>
  );
};