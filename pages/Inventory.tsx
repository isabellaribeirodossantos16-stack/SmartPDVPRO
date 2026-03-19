
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Product, Customer, Supplier, Brand } from '../types';
import { generateProductDescription } from '../services/geminiService';
import { Sparkles, Save, UserPlus, PackagePlus, Factory, Truck, Search, Upload, Filter, Pencil, Trash2, X, MapPin, Calendar, Gift, Cake, MessageCircle, Lock, Crown, Zap, Clock, Info, Plus, User } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { CustomerInfoModal } from '../components/CustomerInfoModal';
import { MessageSelectorModal } from '../components/MessageSelectorModal';

interface IBGEState {
  id: number;
  sigla: string;
  nome: string;
}

interface IBGECity {
  id: number;
  nome: string;
}

export const Inventory = () => {
  const { 
    products, customers, suppliers, brands, sales,
    addProduct, updateProduct, removeProduct, 
    addCustomer, updateCustomer, removeCustomer, 
    addSupplier, updateSupplier, removeSupplier,
    addBrand, updateBrand, removeBrand,
    isFreeVersion
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<'products' | 'plans' | 'customers' | 'suppliers' | 'brands'>('products');
  
  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  // New Info Modal State
  const [infoCustomer, setInfoCustomer] = useState<Customer | null>(null);
  
  // Message Modal State
  const [msgModalCustomer, setMsgModalCustomer] = useState<Customer | null>(null);

  // Product Search & Filter State
  const [prodSearch, setProdSearch] = useState('');
  const [prodBrandFilter, setProdBrandFilter] = useState('');
  const [prodCatFilter, setProdCatFilter] = useState('');

  // Customer Search
  const [custSearch, setCustSearch] = useState('');
  const [showBirthdays, setShowBirthdays] = useState(false);

  // Location Data State (IBGE)
  const [statesList, setStatesList] = useState<IBGEState[]>([]);
  const [citiesList, setCitiesList] = useState<IBGECity[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  // Product Form State
  const [isEditingProd, setIsEditingProd] = useState(false);
  const [productForm, setProductForm] = useState<Partial<Product>>({
    name: '', price: 0, cost: 0, stock: 0, category: '', brand: '', code: '', supplierId: '', image: ''
  });
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  // INLINE CREATION STATE (For Product Form)
  const [isAddingNewBrand, setIsAddingNewBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [isAddingNewSupplier, setIsAddingNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  // Plan Form State
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [planForm, setPlanForm] = useState<{id?: string, name: string, price: number, cost: number, description: string, validityDays: number}>({
    name: '', price: 0, cost: 0, description: '', validityDays: 30
  });

  // Customer Form State
  const [isEditingCust, setIsEditingCust] = useState(false);
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({
    name: '', cpf: '', phone: '', email: '', debt: 0, birthDate: '',
    street: '', number: '', apartment: '', city: '', state: ''
  });

  // Supplier Form State
  const [isEditingSupplier, setIsEditingSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({ name: '', contact: '' });

  // Brand Form State
  const [isEditingBrand, setIsEditingBrand] = useState(false);
  const [brandForm, setBrandForm] = useState<Partial<Brand>>({ name: '' });

  // --- IBGE API EFFECTS ---
  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(res => res.json())
      .then(data => setStatesList(data))
      .catch(err => console.error("Erro ao carregar estados", err));
  }, []);

  useEffect(() => {
    if (customerForm.state) {
      setLoadingCities(true);
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${customerForm.state}/municipios`)
        .then(res => res.json())
        .then(data => {
            setCitiesList(data);
            setLoadingCities(false);
        })
        .catch(err => {
            console.error("Erro ao carregar cidades", err);
            setLoadingCities(false);
        });
    } else {
      setCitiesList([]);
    }
  }, [customerForm.state]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (p.category === 'Planos') return false; 
      const matchesSearch = p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.code.includes(prodSearch);
      const matchesBrand = prodBrandFilter ? p.brand === prodBrandFilter : true;
      const matchesCat = prodCatFilter ? p.category === prodCatFilter : true;
      return matchesSearch && matchesBrand && matchesCat;
    });
  }, [products, prodSearch, prodBrandFilter, prodCatFilter]);

  // Filtered Plans
  const filteredPlans = useMemo(() => {
      return products.filter(p => p.category === 'Planos');
  }, [products]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.id !== 'def' && 
      (c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch))
    );
  }, [customers, custSearch]);

  // Birthday Logic
  const upcomingBirthdays = useMemo(() => {
     const today = new Date();
     today.setHours(0,0,0,0);
     return customers
        .filter(c => c.birthDate && c.id !== 'def')
        .map(c => {
            const [year, month, day] = c.birthDate!.split('-').map(Number);
            const birthMonth = month - 1; const birthDay = day;
            let nextBirthday = new Date(today.getFullYear(), birthMonth, birthDay);
            nextBirthday.setHours(0,0,0,0);
            if (nextBirthday < today) { nextBirthday.setFullYear(today.getFullYear() + 1); }
            const diffTime = nextBirthday.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return { ...c, diffDays, nextBirthday };
        })
        .filter(c => c.diffDays <= 30) 
        .sort((a, b) => a.diffDays - b.diffDays);
  }, [customers]);

  const uniqueCategories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))), [products]);

  // ACTION HANDLERS
  const handleAniversariantesClick = () => {
      if (isFreeVersion) { alert("Recurso bloqueado na versão gratuita."); return; }
      setShowBirthdays(true);
  };

  // PLAN ACTIONS (Omitted for brevity, kept same)
  const handleSubmitPlan = () => { /* ... existing code ... */ 
      if (!planForm.name || !planForm.price) { alert("Preencha o nome e o valor."); return; }
      const payload: Product = { id: planForm.id || Date.now().toString(), name: planForm.name, price: Number(planForm.price), cost: Number(planForm.cost) || 0, brand: planForm.description, category: 'Planos', stock: 999999, code: 'PLANO-' + Date.now().toString().slice(-4), image: 'https://placehold.co/200x200/3b82f6/ffffff?text=PLANO', validityDays: Number(planForm.validityDays) || 30 };
      if (isEditingPlan && planForm.id) { updateProduct(payload); alert("Plano atualizado!"); } else { addProduct(payload); alert("Plano criado!"); }
      setPlanForm({ name: '', price: 0, cost: 0, description: '', validityDays: 30 }); setIsEditingPlan(false);
  };
  const handleEditPlan = (p: Product) => { setPlanForm({ id: p.id, name: p.name, price: p.price, cost: p.cost || 0, description: p.brand, validityDays: p.validityDays || 30 }); setIsEditingPlan(true); };

  // PRODUCT ACTIONS
  const handleSmartDesc = async () => {
    if (!productForm.name) return;
    setIsGeneratingDesc(true);
    const desc = await generateProductDescription(productForm.name);
    alert(`Sugestão Gemini: ${desc}`);
    setIsGeneratingDesc(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setProductForm({ ...productForm, image: reader.result as string }); };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitProduct = () => {
    if (!productForm.name || !productForm.price) {
      alert("Preencha nome e preço.");
      return;
    }

    let finalBrand = productForm.brand;
    let finalSupplierId = productForm.supplierId;

    // HANDLE NEW BRAND CREATION ON THE FLY
    if (isAddingNewBrand && newBrandName.trim()) {
        const existingBrand = brands.find(b => b.name.toLowerCase() === newBrandName.toLowerCase());
        if (!existingBrand) {
            addBrand({ id: Date.now().toString(), name: newBrandName });
            finalBrand = newBrandName;
        } else {
            finalBrand = existingBrand.name;
        }
    }

    // HANDLE NEW SUPPLIER CREATION ON THE FLY
    if (isAddingNewSupplier && newSupplierName.trim()) {
        const newId = Date.now().toString();
        addSupplier({ id: newId, name: newSupplierName, contact: '' });
        finalSupplierId = newId;
    }

    const payload = {
      ...productForm as Product,
      brand: finalBrand || 'Geral',
      supplierId: finalSupplierId,
      image: productForm.image || `https://picsum.photos/200/200?random=${Date.now()}`
    };

    if (isEditingProd && productForm.id) {
      if (isFreeVersion) { alert("Bloqueado no plano grátis."); return; }
      updateProduct(payload);
      alert("Produto atualizado!");
    } else {
      addProduct({ ...payload, id: Date.now().toString() });
      alert("Produto cadastrado!");
    }
    
    // Reset Main Form
    setProductForm({ name: '', price: 0, cost: 0, stock: 0, category: '', brand: '', code: '', supplierId: '', image: '' });
    setIsEditingProd(false);
    
    // Reset Inline Forms
    setIsAddingNewBrand(false);
    setNewBrandName('');
    setIsAddingNewSupplier(false);
    setNewSupplierName('');
  };

  const handleEditProduct = (p: Product) => { if (isFreeVersion) return; setProductForm(p); setIsEditingProd(true); setIsAddingNewBrand(false); setIsAddingNewSupplier(false); };
  const handleDeleteProduct = (id: string) => { if (isFreeVersion) return; setConfirmConfig({ isOpen: true, title: "Excluir", message: "Confirma exclusão?", onConfirm: () => removeProduct(id) }); };

  // CUSTOMER ACTIONS (Omitted for brevity, kept same)
  const handleSubmitCustomer = () => { /* ... existing logic ... */ 
      if (!customerForm.name) return;
      if (isEditingCust && customerForm.id) { if(isFreeVersion) return; updateCustomer(customerForm as Customer); alert("Atualizado!"); }
      else { addCustomer({ id: Date.now().toString(), name: customerForm.name, cpf: customerForm.cpf||'', phone: customerForm.phone||'', email: customerForm.email||'', debt: 0, birthDate: customerForm.birthDate||'', registrationDate: new Date().toISOString(), street: customerForm.street||'', number: customerForm.number||'', apartment: customerForm.apartment||'', city: customerForm.city||'', state: customerForm.state||'' }); alert("Cadastrado!"); }
      setCustomerForm({ name: '', cpf: '', phone: '', email: '', debt: 0, birthDate: '', street: '', number: '', apartment: '', city: '', state: '' }); setIsEditingCust(false);
  };
  const handleEditCustomer = (c: Customer) => { if (isFreeVersion) return; setCustomerForm(c); setIsEditingCust(true); };
  const handleDeleteCustomer = (id: string) => { if (isFreeVersion) return; setConfirmConfig({ isOpen: true, title: "Excluir", message: "Confirma?", onConfirm: () => removeCustomer(id) }); };

  // SUPPLIER ACTIONS
  const handleSubmitSupplier = () => {
    if (isFreeVersion) return;
    if (!supplierForm.name) { alert("Nome obrigatório"); return; }

    if (isEditingSupplier && supplierForm.id) {
        updateSupplier(supplierForm as Supplier);
        alert("Fornecedor atualizado!");
    } else {
        addSupplier({
          id: Date.now().toString(),
          name: supplierForm.name!,
          contact: supplierForm.contact || ''
        });
        alert("Fornecedor cadastrado!");
    }
    setSupplierForm({ name: '', contact: '' });
    setIsEditingSupplier(false);
  };

  const handleEditSupplier = (s: Supplier) => { if (isFreeVersion) return; setSupplierForm(s); setIsEditingSupplier(true); };
  const handleDeleteSupplier = (id: string) => { if (isFreeVersion) return; setConfirmConfig({ isOpen: true, title: "Excluir", message: "Confirma?", onConfirm: () => removeSupplier(id) }); };

  // BRAND ACTIONS
  const handleSubmitBrand = () => {
    if (isFreeVersion) return;
    if (!brandForm.name) { alert("Nome obrigatório"); return; }

    if (isEditingBrand && brandForm.id) {
        updateBrand(brandForm as Brand);
        alert("Marca atualizada!");
    } else {
        addBrand({
          id: Date.now().toString(),
          name: brandForm.name!
        });
        alert("Marca cadastrada!");
    }
    setBrandForm({ name: '' });
    setIsEditingBrand(false);
  };

  const handleEditBrand = (b: Brand) => { if (isFreeVersion) return; setBrandForm(b); setIsEditingBrand(true); };
  const handleDeleteBrand = (id: string) => { if (isFreeVersion) return; setConfirmConfig({ isOpen: true, title: "Excluir", message: "Confirma?", onConfirm: () => removeBrand(id) }); };

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

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Gestão</h2>
        {isFreeVersion && (
            <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold border border-orange-200 flex items-center gap-2">
                <Lock size={12} /> Versão Gratuita (Limitada)
            </div>
        )}
      </div>
      
      {/* TABS */}
      <div className="flex gap-2 md:gap-4 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <button onClick={() => setActiveTab('products')} className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'products' ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>Produtos</button>
        <button onClick={() => setActiveTab('plans')} className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'plans' ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}><Zap size={16}/> Planos</button>
        <button onClick={() => setActiveTab('customers')} className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'customers' ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>Clientes</button>
        <button onClick={() => setActiveTab('brands')} className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'brands' ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
            {isFreeVersion && <Lock size={12} className="text-slate-400" />} <Factory size={16} /> Marcas
        </button>
        <button onClick={() => setActiveTab('suppliers')} className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'suppliers' ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
            {isFreeVersion && <Lock size={12} className="text-slate-400" />} <Truck size={16} /> Fornecedores
        </button>
      </div>

      {/* --- PRODUCTS TAB --- */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* List Section */}
          <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
             {/* Filter Header */}
             <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input type="text" placeholder="Pesquisar produto..." className="w-full pl-10 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:border-accent text-sm" value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} />
                </div>
                <div className="flex gap-2">
                   <select className="border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:outline-none" value={prodBrandFilter} onChange={(e) => setProdBrandFilter(e.target.value)}>
                     <option value="">Todas Marcas</option>
                     {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                   </select>
                   <select className="border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:outline-none" value={prodCatFilter} onChange={(e) => setProdCatFilter(e.target.value)}>
                     <option value="">Todas Categorias</option>
                     {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                </div>
             </div>
             {/* Table */}
             <div className="overflow-x-auto">
               <table className="w-full text-left min-w-[700px]">
                 <thead className="bg-slate-50 text-slate-500 text-sm"><tr><th className="p-4">Produto</th><th className="p-4">Marca / Categoria</th><th className="p-4">Preço</th><th className="p-4">Estoque</th><th className="p-4 text-right">Ações</th></tr></thead>
                 <tbody className="divide-y divide-slate-100">
                   {filteredProducts.map(p => (
                     <tr key={p.id} className="hover:bg-slate-50 group">
                       <td className="p-4 flex items-center gap-3"><img src={p.image} className="w-10 h-10 rounded bg-slate-200 object-cover" alt="" /><div><div className="font-medium text-slate-800">{p.name}</div><div className="text-xs text-slate-400">{p.code}</div></div></td>
                       <td className="p-4"><div className="text-slate-800 text-sm">{p.brand}</div><div className="text-xs text-slate-500">{p.category}</div></td>
                       <td className="p-4 font-bold text-slate-800">R$ {p.price.toFixed(2)}</td>
                       <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${p.stock < 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{p.stock} un</span></td>
                       <td className="p-4 text-right">
                         {!isFreeVersion ? ( <><button onClick={() => handleEditProduct(p)} className="text-blue-500 hover:text-blue-700 p-2"><Pencil size={18} /></button><button onClick={() => handleDeleteProduct(p.id)} className="text-red-500 hover:text-red-700 p-2"><Trash2 size={18} /></button></> ) : ( <Lock size={16} className="text-slate-300 inline-block" /> )}
                       </td>
                     </tr>
                   ))}
                   {filteredProducts.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum produto encontrado.</td></tr>}
                 </tbody>
               </table>
             </div>
          </div>

          {/* Product Form */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><PackagePlus size={20}/> {isEditingProd ? 'Editar Produto' : 'Novo Produto'}</h3>{isEditingProd && !isFreeVersion && (<button onClick={() => { setIsEditingProd(false); setProductForm({name:'', price:0, cost:0, stock:0, category:'', brand:'', code:'', supplierId:''}); }} className="text-sm text-slate-400 hover:text-slate-600">Cancelar</button>)}</div>
            {isFreeVersion && products.length >= 5 ? ( <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 text-center"><Lock className="mx-auto text-orange-400 mb-2" size={32} /><h4 className="font-bold text-orange-800 text-sm mb-1">Limite Atingido</h4></div> ) : (
                <div className="space-y-4">
                  {/* ... (Image and Basic Inputs) ... */}
                  <div className="flex items-center gap-4"><div className="w-16 h-16 bg-slate-100 rounded border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">{productForm.image ? <img src={productForm.image} className="w-full h-full object-cover" /> : <Upload size={20} className="text-slate-400" />}</div><div className="flex-1"><label className="block text-xs font-medium text-slate-500 mb-1">Foto do Produto</label><div className="flex gap-2"><input type="text" placeholder="URL da imagem..." className="flex-1 border rounded p-2 text-sm outline-none" value={productForm.image || ''} onChange={(e) => setProductForm({...productForm, image: e.target.value})} /><label className="bg-slate-100 hover:bg-slate-200 cursor-pointer p-2 rounded border border-slate-300"><Upload size={16} /><input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label></div></div></div>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Nome do Produto</label><input className="w-full border rounded p-2 outline-none" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} placeholder="Ex: Coca Cola 2L"/></div>
                  <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-slate-500 mb-1">Preço Venda</label><input type="number" className="w-full border rounded p-2 outline-none" value={productForm.price} onChange={e => setProductForm({...productForm, price: parseFloat(e.target.value)})} /></div><div><label className="block text-xs font-medium text-slate-500 mb-1">Custo</label><input type="number" className="w-full border rounded p-2 outline-none" value={productForm.cost} onChange={e => setProductForm({...productForm, cost: parseFloat(e.target.value)})} /></div></div>
                  <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-slate-500 mb-1">Estoque</label><input type="number" className="w-full border rounded p-2 outline-none" value={productForm.stock} onChange={e => setProductForm({...productForm, stock: parseFloat(e.target.value)})} /></div><div><label className="block text-xs font-medium text-slate-500 mb-1">Código</label><input type="text" className="w-full border rounded p-2 outline-none" value={productForm.code} onChange={e => setProductForm({...productForm, code: e.target.value})} /></div></div>

                  {/* BRAND & CATEGORY (WITH INLINE ADD) */}
                  <div className="grid grid-cols-2 gap-4">
                     <div className="relative">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Marca</label>
                        {isAddingNewBrand ? (
                            <div className="flex items-center gap-1">
                                <input 
                                    className="w-full border border-blue-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50"
                                    placeholder="Nova Marca"
                                    value={newBrandName}
                                    onChange={(e) => setNewBrandName(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={() => { setIsAddingNewBrand(false); setNewBrandName(''); }} className="p-2 bg-red-100 text-red-500 rounded hover:bg-red-200"><X size={16}/></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1">
                                <select className="w-full border rounded p-2 text-sm outline-none" value={productForm.brand} onChange={e => setProductForm({...productForm, brand: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                </select>
                                <button onClick={() => setIsAddingNewBrand(true)} className="p-2 bg-slate-100 text-blue-600 rounded hover:bg-blue-50 border border-slate-200" title="Criar nova marca"><Plus size={16}/></button>
                            </div>
                        )}
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
                        <input type="text" className="w-full border rounded p-2 outline-none" value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} placeholder="Ex: Bebidas" />
                     </div>
                  </div>

                  {/* SUPPLIER (WITH INLINE ADD) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Fornecedor</label>
                    {isAddingNewSupplier ? (
                        <div className="flex items-center gap-1">
                            <input 
                                className="w-full border border-blue-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50"
                                placeholder="Nome do Novo Fornecedor"
                                value={newSupplierName}
                                onChange={(e) => setNewSupplierName(e.target.value)}
                                autoFocus
                            />
                            <button onClick={() => { setIsAddingNewSupplier(false); setNewSupplierName(''); }} className="p-2 bg-red-100 text-red-500 rounded hover:bg-red-200"><X size={16}/></button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <select className="w-full border rounded p-2 text-sm outline-none" value={productForm.supplierId} onChange={e => setProductForm({...productForm, supplierId: e.target.value})}>
                                <option value="">Selecione...</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <button onClick={() => setIsAddingNewSupplier(true)} className="p-2 bg-slate-100 text-blue-600 rounded hover:bg-blue-50 border border-slate-200" title="Criar novo fornecedor"><Plus size={16}/></button>
                        </div>
                    )}
                  </div>
                  
                  <button onClick={handleSmartDesc} disabled={isGeneratingDesc} className="w-full py-2 bg-purple-50 text-purple-600 rounded border border-purple-200 hover:bg-purple-100 flex items-center justify-center gap-2 text-sm transition-colors"><Sparkles size={16} /> {isGeneratingDesc ? 'Pensando...' : 'Gerar Descrição IA'}</button>
                  <button onClick={handleSubmitProduct} className="w-full bg-primary text-white py-2 rounded hover:bg-slate-800 flex items-center justify-center gap-2 shadow-lg active:scale-95"><Save size={16} /> {isEditingProd ? 'Atualizar Produto' : 'Salvar Produto'}</button>
                </div>
            )}
          </div>
        </div>
      )}

      {/* --- PLANS TAB (Kept as is) --- */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
             <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-700">Planos Registrados</h3></div>
             <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-sm text-slate-500 border-b border-slate-100"><tr><th className="p-4">Nome do Plano</th><th className="p-4">Descrição</th><th className="p-4">Validade</th><th className="p-4">Custo</th><th className="p-4">Valor</th><th className="p-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredPlans.map(p => (<tr key={p.id} className="hover:bg-slate-50"><td className="p-4 font-medium text-slate-800">{p.name}</td><td className="p-4 text-slate-500 text-sm">{p.brand}</td><td className="p-4 text-slate-500 text-sm"><span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100 w-fit"><Clock size={12} /> {p.validityDays || 30} dias</span></td><td className="p-4 text-slate-500 text-sm">R$ {p.cost?.toFixed(2) || '0.00'}</td><td className="p-4 font-bold text-green-600">R$ {p.price.toFixed(2)}</td><td className="p-4 text-right"><button onClick={() => handleEditPlan(p)} className="text-blue-500 hover:text-blue-700 p-2"><Pencil size={18} /></button><button onClick={() => handleDeleteProduct(p.id)} className="text-red-500 hover:text-red-700 p-2"><Trash2 size={18} /></button></td></tr>))}</tbody></table>{filteredPlans.length === 0 && <div className="p-8 text-center text-slate-400">Nenhum plano cadastrado.</div>}</div>
           </div>
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><Zap size={20}/> {isEditingPlan ? 'Editar Plano' : 'Novo Plano'}</h3>{isEditingPlan && (<button onClick={() => { setIsEditingPlan(false); setPlanForm({name:'', price:0, cost: 0, description:'', validityDays: 30}); }} className="text-sm text-slate-400 hover:text-slate-600">Cancelar</button>)}</div><div className="space-y-4"><div><label className="block text-xs font-medium text-slate-500 mb-1">Nome do Plano</label><input className="w-full border rounded p-2 outline-none" value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} placeholder="Ex: Plano Mensal"/></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-slate-500 mb-1">Valor Venda (R$)</label><div className="relative"><span className="absolute left-3 top-2 text-slate-400 font-bold">R$</span><input type="number" className="w-full pl-10 border rounded p-2 outline-none font-bold text-slate-700" value={planForm.price} onChange={e => setPlanForm({...planForm, price: parseFloat(e.target.value)})} /></div></div><div><label className="block text-xs font-medium text-slate-500 mb-1">Custo (R$)</label><div className="relative"><span className="absolute left-3 top-2 text-slate-400 font-bold">R$</span><input type="number" className="w-full pl-10 border rounded p-2 outline-none font-medium text-slate-600" value={planForm.cost} onChange={e => setPlanForm({...planForm, cost: parseFloat(e.target.value)})} /></div></div></div><div><label className="block text-xs font-medium text-slate-500 mb-1">Dias de Validade</label><div className="relative"><Clock size={16} className="absolute left-3 top-2.5 text-slate-400" /><input type="number" min="1" className="w-full pl-9 border rounded p-2 outline-none" value={planForm.validityDays} onChange={e => setPlanForm({...planForm, validityDays: parseInt(e.target.value) || 30})} placeholder="30"/></div></div><div><label className="block text-xs font-medium text-slate-500 mb-1">Descrição do Plano</label><textarea className="w-full border rounded p-2 outline-none h-24 text-sm" value={planForm.description} onChange={e => setPlanForm({...planForm, description: e.target.value})} placeholder="Detalhes do plano..."/></div><button onClick={handleSubmitPlan} className="w-full bg-primary text-white py-2 rounded hover:bg-slate-800 flex items-center justify-center gap-2 shadow-lg active:scale-95"><Save size={16} /> {isEditingPlan ? 'Atualizar Plano' : 'Salvar Plano'}</button></div></div>
        </div>
      )}

      {/* --- CUSTOMERS TAB (Kept as is) --- */}
      {activeTab === 'customers' && (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {/* ... List and Form logic for Customers (Same as before) ... */}
           <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col"><div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4"><h3 className="font-bold text-slate-700 whitespace-nowrap">Clientes</h3><div className="flex gap-2 w-full sm:w-auto"><div className="relative flex-1 sm:w-64"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:border-accent" placeholder="Buscar..." value={custSearch} onChange={(e) => setCustSearch(e.target.value)}/></div><button onClick={handleAniversariantesClick} className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-2 rounded-lg flex items-center gap-2 border border-purple-200">{isFreeVersion ? <Lock size={18} /> : <Cake size={18} />} <span className="hidden sm:inline">Aniversariantes</span></button></div></div><div className="overflow-x-auto"><table className="w-full text-left min-w-[500px]"><thead className="bg-white text-slate-500 text-sm border-b border-slate-100"><tr><th className="p-4">Nome</th><th className="p-4">Contato / Endereço</th><th className="p-4">Débito</th><th className="p-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredCustomers.map(c => (<tr key={c.id} className="hover:bg-slate-50"><td className="p-4 font-medium text-slate-800">{c.name}{c.cpf && (<div className="text-[10px] text-slate-400 mt-0.5">CPF: {c.cpf}</div>)}{c.birthDate && (<div className="text-[10px] text-purple-600 flex items-center gap-1 mt-1 font-normal"><Gift size={10} /> {new Date(c.birthDate + 'T12:00:00').toLocaleDateString('pt-BR')}</div>)}</td><td className="p-4 text-slate-500"><div className="text-sm">{c.email}</div><div className="text-xs">{c.phone}</div>{c.city && <div className="text-xs mt-1 text-slate-400 flex items-center gap-1"><MapPin size={10} /> {c.city}/{c.state}</div>}</td><td className="p-4">{c.debt > 0 ? (<span className="text-red-500 font-bold">R$ {c.debt.toFixed(2)}</span>) : (<span className="text-green-500 text-sm">Em dia</span>)}</td><td className="p-4 text-right">{!isFreeVersion ? ( <><button onClick={() => setInfoCustomer(c)} className="text-purple-500 hover:text-purple-700 p-2" title="Info"><Info size={18} /></button>{c.phone && (<button onClick={() => setMsgModalCustomer(c)} className="text-green-500 hover:text-green-700 p-2" title="Msg"><MessageCircle size={18} /></button>)}<button onClick={() => handleEditCustomer(c)} className="text-blue-500 hover:text-blue-700 p-2"><Pencil size={18} /></button><button onClick={() => handleDeleteCustomer(c.id)} className="text-red-500 hover:text-red-700 p-2"><Trash2 size={18} /></button></> ) : ( <Lock size={16} className="text-slate-300 inline-block" /> )}</td></tr>))}</tbody></table></div></div>
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><UserPlus size={20}/> {isEditingCust ? 'Editar Cliente' : 'Novo Cliente'}</h3>{isEditingCust && !isFreeVersion && (<button onClick={() => { setIsEditingCust(false); setCustomerForm({name:'', cpf:'', phone:'', email:'', debt:0, birthDate: '', street: '', number: '', apartment: '', city: '', state: ''}); }} className="text-sm text-slate-400">Cancelar</button>)}</div>{isFreeVersion && customers.length >= 6 ? ( <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 text-center"><Lock className="mx-auto text-orange-400 mb-2" size={32} /><h4 className="font-bold text-orange-800 text-sm mb-1">Limite Atingido</h4></div> ) : (<div className="space-y-4"><div><label className="block text-xs font-medium text-slate-500 mb-1">Nome Completo</label><input className="w-full border rounded p-2 outline-none" value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} placeholder="Nome do cliente"/></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-slate-500 mb-1">CPF (Opcional)</label><input className="w-full border rounded p-2 text-sm outline-none" value={customerForm.cpf} onChange={e => setCustomerForm({...customerForm, cpf: e.target.value})} placeholder="000.000.000-00"/></div><div><label className="block text-xs font-medium text-slate-500 mb-1">Nascimento</label><div className="relative"><Calendar size={16} className="absolute left-2.5 top-2.5 text-slate-400"/><input type="date" className="w-full pl-8 border rounded p-2 text-sm text-slate-600 outline-none" value={customerForm.birthDate} onChange={e => setCustomerForm({...customerForm, birthDate: e.target.value})}/></div></div></div><div><label className="block text-xs font-medium text-slate-500 mb-1">Telefone / WhatsApp</label><input className="w-full border rounded p-2 outline-none" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} placeholder="11999999999"/></div><div><label className="block text-xs font-medium text-slate-500 mb-1">Email (Opcional)</label><input className="w-full border rounded p-2 outline-none" value={customerForm.email} onChange={e => setCustomerForm({...customerForm, email: e.target.value})} placeholder="email@exemplo.com"/></div><div className="border-t border-slate-100 pt-3"><p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wide">Endereço (Opcional)</p><div className="flex gap-2 mb-3"><div className="flex-1"><label className="block text-[10px] font-medium text-slate-500 mb-1">Rua / Logradouro</label><input className="w-full border rounded p-2 text-sm outline-none" value={customerForm.street} onChange={e => setCustomerForm({...customerForm, street: e.target.value})}/></div><div className="w-20"><label className="block text-[10px] font-medium text-slate-500 mb-1">Número</label><input className="w-full border rounded p-2 text-sm outline-none" value={customerForm.number} onChange={e => setCustomerForm({...customerForm, number: e.target.value})}/></div></div><div className="mb-3"><label className="block text-[10px] font-medium text-slate-500 mb-1">Apartamento / Complemento</label><input className="w-full border rounded p-2 text-sm outline-none" value={customerForm.apartment} onChange={e => setCustomerForm({...customerForm, apartment: e.target.value})}/></div><div className="flex gap-2"><div className="w-24"><label className="block text-[10px] font-medium text-slate-500 mb-1">Estado (UF)</label><select className="w-full border rounded p-2 text-sm outline-none bg-white" value={customerForm.state} onChange={e => { setCustomerForm({...customerForm, state: e.target.value, city: ''}); }}><option value="">UF</option>{statesList.map(uf => (<option key={uf.id} value={uf.sigla}>{uf.sigla}</option>))}</select></div><div className="flex-1"><label className="block text-[10px] font-medium text-slate-500 mb-1">Cidade</label>{loadingCities ? (<div className="w-full border rounded p-2 text-sm bg-slate-50 text-slate-400">Carregando...</div>) : (<select className="w-full border rounded p-2 text-sm outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400" value={customerForm.city} onChange={e => setCustomerForm({...customerForm, city: e.target.value})} disabled={!customerForm.state}><option value="">{customerForm.state ? 'Selecione a cidade' : 'Selecione o estado primeiro'}</option>{citiesList.map(city => (<option key={city.id} value={city.nome}>{city.nome}</option>))}</select>)}</div></div></div><button onClick={handleSubmitCustomer} className="w-full bg-primary text-white py-2 rounded hover:bg-slate-800 transition-colors">{isEditingCust ? 'Salvar Alterações' : 'Cadastrar Cliente'}</button></div>)}
           </div>
         </div>
      )}

      {/* --- BRANDS TAB --- */}
      {activeTab === 'brands' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Brands List */}
              <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2"><Factory size={20}/> Marcas Cadastradas</h3>
                      <span className="text-xs text-slate-500 font-medium bg-slate-200 px-2 py-1 rounded-full">{brands.length}</span>
                  </div>
                  <div className="overflow-y-auto max-h-[600px] p-2">
                      {brands.length === 0 ? (
                          <div className="p-10 text-center text-slate-400">Nenhuma marca cadastrada.</div>
                      ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {brands.map(b => (
                                  <div key={b.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                                      <span className="font-medium text-slate-700">{b.name}</span>
                                      <div className="flex gap-2">
                                          {!isFreeVersion ? (
                                              <>
                                                  <button onClick={() => handleEditBrand(b)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16}/></button>
                                                  <button onClick={() => handleDeleteBrand(b.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                              </>
                                          ) : <Lock size={14} className="text-slate-300"/>}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>

              {/* Brand Form */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-800">{isEditingBrand ? 'Editar Marca' : 'Nova Marca'}</h3>
                      {isEditingBrand && <button onClick={() => {setIsEditingBrand(false); setBrandForm({name: ''})}} className="text-xs text-slate-400">Cancelar</button>}
                  </div>
                  
                  {isFreeVersion ? (
                      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 text-center">
                          <Lock className="mx-auto text-orange-400 mb-2" size={32} />
                          <p className="text-xs text-orange-600">Gestão de marcas disponível na versão PRO.</p>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Nome da Marca</label>
                              <input 
                                  className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                                  value={brandForm.name} 
                                  onChange={e => setBrandForm({...brandForm, name: e.target.value})} 
                                  placeholder="Ex: Samsung, Nike..."
                              />
                          </div>
                          <button onClick={handleSubmitBrand} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium transition-colors shadow-sm">
                              {isEditingBrand ? 'Salvar Alterações' : 'Cadastrar Marca'}
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* --- SUPPLIERS TAB --- */}
      {activeTab === 'suppliers' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Suppliers List */}
              <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2"><Truck size={20}/> Fornecedores Cadastrados</h3>
                      <span className="text-xs text-slate-500 font-medium bg-slate-200 px-2 py-1 rounded-full">{suppliers.length}</span>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="text-sm text-slate-500 border-b border-slate-100 bg-slate-50">
                              <tr>
                                  <th className="p-3">Nome</th>
                                  <th className="p-3">Contato</th>
                                  <th className="p-3 text-right">Ações</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {suppliers.map(s => (
                                  <tr key={s.id} className="hover:bg-slate-50">
                                      <td className="p-3 font-medium text-slate-800">{s.name}</td>
                                      <td className="p-3 text-slate-500 text-sm">{s.contact || '-'}</td>
                                      <td className="p-3 text-right">
                                          <div className="flex justify-end gap-2">
                                              {!isFreeVersion ? (
                                                  <>
                                                      <button onClick={() => handleEditSupplier(s)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16}/></button>
                                                      <button onClick={() => handleDeleteSupplier(s.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                                  </>
                                              ) : <Lock size={14} className="text-slate-300"/>}
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                              {suppliers.length === 0 && (
                                  <tr><td colSpan={3} className="p-8 text-center text-slate-400">Nenhum fornecedor cadastrado.</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* Supplier Form */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-800">{isEditingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
                      {isEditingSupplier && <button onClick={() => {setIsEditingSupplier(false); setSupplierForm({name: '', contact: ''})}} className="text-xs text-slate-400">Cancelar</button>}
                  </div>
                  
                  {isFreeVersion ? (
                      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 text-center">
                          <Lock className="mx-auto text-orange-400 mb-2" size={32} />
                          <p className="text-xs text-orange-600">Gestão de fornecedores disponível na versão PRO.</p>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Nome da Empresa</label>
                              <input 
                                  className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                                  value={supplierForm.name} 
                                  onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} 
                                  placeholder="Ex: Distribuidora XYZ"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Contato (Tel/Email)</label>
                              <input 
                                  className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500" 
                                  value={supplierForm.contact} 
                                  onChange={e => setSupplierForm({...supplierForm, contact: e.target.value})} 
                                  placeholder="(00) 0000-0000"
                              />
                          </div>
                          <button onClick={handleSubmitSupplier} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium transition-colors shadow-sm">
                              {isEditingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Confirmation Modal Render */}
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

      {/* NEW CUSTOMER INFO MODAL */}
      {infoCustomer && (
           <CustomerInfoModal 
               customer={infoCustomer}
               sales={sales}
               onClose={() => setInfoCustomer(null)}
           />
      )}

      {/* MESSAGE SELECTOR MODAL */}
      {msgModalCustomer && (
          <MessageSelectorModal 
              customer={msgModalCustomer} 
              onClose={() => setMsgModalCustomer(null)} 
          />
      )}
      
      {/* BIRTHDAY MODAL */}
      {showBirthdays && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-purple-50 shrink-0">
                      <div><h3 className="font-bold text-xl text-purple-900 flex items-center gap-2"><Cake size={24} /> Aniversariantes do Mês</h3><p className="text-sm text-purple-600">Próximos 30 dias</p></div>
                      <button onClick={() => setShowBirthdays(false)} className="p-2 bg-white rounded-full hover:bg-slate-100 text-slate-500 transition-colors shadow-sm"><X size={20} /></button>
                  </div>
                  <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                      {upcomingBirthdays.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-48 text-slate-400"><Gift size={48} className="mb-4 opacity-30" /><p>Nenhum aniversariante nos próximos 30 dias.</p></div>
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {upcomingBirthdays.map(c => {
                                  const isToday = c.diffDays === 0;
                                  const isTomorrow = c.diffDays === 1;
                                  let cardClass = "bg-white border border-slate-200";
                                  let titleText = `Faltam ${c.diffDays} dias`;
                                  let titleColor = "text-slate-500";
                                  let icon = <Calendar size={14} />;
                                  if (isToday) { cardClass = "rainbow-blink border-2 shadow-lg"; titleText = "Fazendo aniversário hoje!"; titleColor = "text-purple-600 font-bold"; icon = <Cake size={14} className="animate-bounce" />; } else if (isTomorrow) { cardClass = "bg-blue-50 border border-blue-200 shadow-md"; titleText = "Faz aniversário amanhã"; titleColor = "text-blue-600 font-bold"; icon = <Gift size={14} />; }
                                  return (
                                      <div key={c.id} className={`rounded-xl p-5 relative transition-transform hover:scale-[1.02] ${cardClass}`}>
                                          <div className={`text-xs uppercase tracking-wide mb-2 flex items-center gap-1 ${titleColor}`}>{icon} {titleText}</div>
                                          <h4 className="font-bold text-lg text-slate-800 mb-1">{c.name}</h4>
                                          <div className="text-sm text-slate-500 mb-4 flex items-center gap-2"><span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{new Date(c.nextBirthday).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span>{c.phone && <span className="text-xs">• {c.phone}</span>}</div>
                                          {c.phone && ( isToday ? ( <button onClick={() => setMsgModalCustomer(c)} className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-bold text-sm transition-colors shadow-sm"><MessageCircle size={16} /> Parabenizar</button> ) : ( <button onClick={() => setMsgModalCustomer(c)} className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-lg font-bold text-sm transition-colors border border-blue-200"><MessageCircle size={16} /> Enviar Msg</button> ) )}
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
