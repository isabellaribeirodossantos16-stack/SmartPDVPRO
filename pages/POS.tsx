
// ... existing imports
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Product, CartItem, PaymentMethod, Customer, SalePayment } from '../types';
import { Search, Plus, Trash2, CreditCard, Banknote, QrCode, CalendarClock, User, Check, Printer, ShoppingBag, X, Copy, FileDown, Zap, Package, AlertTriangle, Calendar } from 'lucide-react';
import { printReceipt, saveReceiptAsImage } from '../services/printerService';
import { ConfirmModal } from '../components/ConfirmModal';

// ... (Helpers generatePixPayload, etc. remain same)
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

export const POS = () => {
  const { products, customers, addSale, settings, financialRecords } = useStore();
  
  // Default customer "Cliente Balcão"
  const defaultCustomer: Customer = { 
      id: 'def', 
      name: 'Cliente Balcão', 
      phone: '', 
      email: '', 
      debt: 0 
  };

  const [currentSaleId] = useState(Date.now().toString().slice(-6));
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // FIXED: Always initialize with defaultCustomer (Cliente Balcão)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(defaultCustomer); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  
  // Mobile Tab State (Added 'plans')
  const [activeMobileTab, setActiveMobileTab] = useState<'cart' | 'catalog' | 'plans'>('catalog');
  
  // Payment Modal States
  const [showPayment, setShowPayment] = useState(false);
  const [currentPayments, setCurrentPayments] = useState<SalePayment[]>([]);
  const [amountToPay, setAmountToPay] = useState<string>(''); // For the input field

  // Print Modal State
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<{sale: any, customer: Customer} | null>(null);

  // Confirmation Modal State (for WhatsApp)
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  // Term Payment Logic & Flow
  const [isTermSelection, setIsTermSelection] = useState(false);
  const [termDate, setTermDate] = useState<string>('');
  const [termInstallments, setTermInstallments] = useState<number>(1);
  const [termFlow, setTermFlow] = useState({
     active: false,
     currentStep: 1,
     totalSteps: 1,
     originalAmount: 0
  });

  // Plan Expiration State
  const [planDueDate, setPlanDueDate] = useState<string>('');

  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  // Sync selectedCustomer ONLY if the selected specific customer was updated in the database.
  useEffect(() => {
      if (selectedCustomer.id !== 'def') {
          const updated = customers.find(c => c.id === selectedCustomer.id);
          if (updated) {
              setSelectedCustomer(updated);
          } else {
              setSelectedCustomer(defaultCustomer);
          }
      }
  }, [customers, selectedCustomer.id]);

  // Check if there is a plan in the cart
  const hasPlanInCart = useMemo(() => {
      return cart.some(item => item.category === 'Planos');
  }, [cart]);

  // Block logic for Plan Sales
  const isSaleBlocked = useMemo(() => {
      return hasPlanInCart && selectedCustomer.id === 'def';
  }, [hasPlanInCart, selectedCustomer]);

  // --- HELPER: GET VISUAL STOCK (Available - Cart Qty) ---
  const getVisualStock = (product: Product) => {
      const inCart = cart.find(item => item.id === product.id);
      const cartQty = inCart ? inCart.quantity : 0;
      return product.stock - cartQty;
  };

  // --- AUTO-CALCULATE PLAN EXPIRATION ---
  useEffect(() => {
      if (hasPlanInCart) {
          // Sum total days: Quantity * ValidityDays for each plan item
          const totalDays = cart
              .filter(item => item.category === 'Planos')
              .reduce((acc, item) => acc + (item.quantity * (item.validityDays || 30)), 0);
          
          if (totalDays > 0) {
              const d = new Date();
              d.setDate(d.getDate() + totalDays);
              setPlanDueDate(d.toISOString().split('T')[0]);
          }
      }
  }, [cart, hasPlanInCart]);

  // --- EFFECT 1: RESET STATE ON OPEN ONLY ---
  useEffect(() => {
    if (showPayment) {
        // Reset Term State
        setIsTermSelection(false);
        setTermInstallments(1);
        setTermFlow({ active: false, currentStep: 1, totalSteps: 1, originalAmount: 0 });
        
        // Default next month date for Term (Payment)
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        setTermDate(d.toISOString().split('T')[0]);
    }
  }, [showPayment]);

  // --- EFFECT 2: UPDATE AMOUNT TO PAY ---
  useEffect(() => {
    if (showPayment) {
        const total = calculateTotal();
        const paid = currentPayments.reduce((acc, p) => acc + p.amount, 0);
        const remaining = Math.max(0, total - paid);
        
        if (!termFlow.active) {
            setAmountToPay(remaining.toFixed(2));
        }
    }
  }, [showPayment, currentPayments, cart, termFlow.active]);

  const addToCart = (product: Product) => {
    const currentStock = getVisualStock(product);
    
    // Check if adding one more would drop below 0 (meaning current visual stock is 0 or less)
    if (currentStock <= 0) {
        alert(`ATENÇÃO: Produto "${product.name}" com estoque zerado ou negativo! Venda permitida, mas verifique reposição.`);
    }

    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1, discount: 0 }]);
    }
    setSearchTerm(''); 
  };

  const updateQuantity = (id: string, delta: number) => {
    // If trying to increase
    if (delta > 0) {
        const item = cart.find(i => i.id === id);
        const product = products.find(p => p.id === id);
        if (item && product) {
            const visualStock = product.stock - item.quantity; // current visual stock before adding
            if (visualStock <= 0) {
                alert(`ATENÇÃO: Estoque zerado para este item!`);
            }
        }
    }

    setCart(cart.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }).filter(Boolean));
  };

  const removeItem = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.code === barcodeInput);
    if (product) {
      addToCart(product);
      setBarcodeInput('');
    } else {
      alert("Produto não encontrado!");
      setBarcodeInput('');
    }
  };

  const calculateTotal = () => {
    return cart.reduce((acc, item) => acc + ((item.price * item.quantity) - item.discount), 0);
  };

  const addPayment = (method: PaymentMethod, dueDate?: string, installmentInfo?: {current: number, total: number}, overrideAmount?: number) => {
      let val = 0;
      
      if (overrideAmount !== undefined) {
          val = overrideAmount;
      } else {
          val = parseFloat(amountToPay);
      }

      if (isNaN(val) || val <= 0) return false;

      const total = calculateTotal();
      const currentPaid = currentPayments.reduce((acc, p) => acc + p.amount, 0);
      
      if (currentPaid + val > total + 0.05) { 
          alert("O valor total dos pagamentos excede o valor da venda.");
          return false;
      }

      // NO DATE MANIPULATION HERE - Pass as String
      // Context will normalize to Local Midnight
      setCurrentPayments(prev => [...prev, { 
          method, 
          amount: val, 
          dueDate: dueDate, 
          installmentNumber: installmentInfo?.current,
          totalInstallments: installmentInfo?.total
      }]);

      return true;
  };

  const handleTermStep = () => {
      let step = termFlow.active ? termFlow.currentStep : 1;
      let total = termFlow.active ? termFlow.totalSteps : termInstallments;
      let originalAmt = termFlow.active ? termFlow.originalAmount : parseFloat(amountToPay);

      if (originalAmt <= 0) {
          alert("Valor inválido.");
          return;
      }

      if (!termFlow.active) {
          setTermFlow({
              active: true,
              currentStep: 1,
              totalSteps: total,
              originalAmount: originalAmt
          });
      }

      let amountForThisStep = 0;
      const base = Math.floor((originalAmt / total) * 100) / 100;
      
      if (step === total) {
          const theoreticallyPaidBefore = base * (total - 1);
          amountForThisStep = Number((originalAmt - theoreticallyPaidBefore).toFixed(2));
      } else {
          amountForThisStep = base;
      }

      const success = addPayment(PaymentMethod.TERM, termDate, { current: step, total: total }, amountForThisStep);

      if (success) {
          if (step < total) {
              // Calculate next month for UI flow
              // Safe way to increment month on string date YYYY-MM-DD
              const [y, m, d] = termDate.split('-').map(Number);
              const nextDate = new Date(y, m, d); // Month is 0-indexed in JS, so `m` is already next month index
              const nextDateStr = nextDate.toISOString().split('T')[0];
              
              setTermDate(nextDateStr);

              setTermFlow(prev => ({
                  ...prev,
                  active: true,
                  currentStep: step + 1,
                  totalSteps: total,
                  originalAmount: originalAmt
              }));
          } else {
              setIsTermSelection(false);
              setTermFlow({ active: false, currentStep: 1, totalSteps: 1, originalAmount: 0 });
          }
      }
  };

  // ... (Rest of POS.tsx Logic: removePayment, handlePrintOption, finalizeSale etc... No logic changes needed inside them besides what StoreContext handles)
  const removePayment = (index: number) => {
      const newPayments = [...currentPayments];
      newPayments.splice(index, 1);
      setCurrentPayments(newPayments);
      
      if (isTermSelection) {
         setTermFlow({ active: false, currentStep: 1, totalSteps: 1, originalAmount: 0 });
         setTermInstallments(1);
      }
  };

  const handlePrintOption = (option: 'print' | 'save' | 'none') => {
      if (!lastSaleData) return;

      if (option === 'print') {
          printReceipt(lastSaleData.sale, settings, lastSaleData.customer, financialRecords);
      } else if (option === 'save') {
          saveReceiptAsImage(lastSaleData.sale, settings, lastSaleData.customer, financialRecords);
      }
      
      setShowPrintOptions(false);
      setLastSaleData(null);
  };

  const finalizeSale = () => {
    const total = calculateTotal();
    const paid = currentPayments.reduce((acc, p) => acc + p.amount, 0);

    if (Math.abs(total - paid) > 0.1) {
        alert("O valor pago deve ser igual ao total da venda. Adicione ou remova pagamentos.");
        return;
    }

    if (hasPlanInCart) {
        if (selectedCustomer.id === 'def') {
            alert("Para vender um plano, é necessário selecionar um cliente.");
            return;
        }
        if (!planDueDate) {
            alert("Data de vencimento do plano inválida.");
            return;
        }
    }

    const primaryMethod = currentPayments.length === 1 ? currentPayments[0].method : 'Múltiplos';

    const saleData = {
      id: currentSaleId,
      customerId: selectedCustomer.id === 'def' ? null : selectedCustomer.id,
      items: cart,
      total,
      discountTotal: cart.reduce((acc, i) => acc + i.discount, 0),
      paymentMethod: primaryMethod, 
      payments: currentPayments,
      date: new Date().toISOString(),
      status: 'completed' as const,
      // Store Context handles date normalization for plan expiration too
      planExpirationDate: hasPlanInCart ? planDueDate : undefined 
    };

    addSale(saleData); // Context now handles Stock Deduction

    const printerEnabled = settings.printerConfig.enabled;
    const autoPrint = settings.printerConfig.autoPrint;

    if (!printerEnabled) {
        saveReceiptAsImage(saleData, settings, selectedCustomer, financialRecords);
    } else {
        if (autoPrint) {
            printReceipt(saleData, settings, selectedCustomer, financialRecords);
        } else {
            setLastSaleData({ sale: saleData, customer: selectedCustomer });
            setShowPrintOptions(true);
        }
    }

    if ((!printerEnabled || autoPrint) && settings.whatsappMessageTemplate && selectedCustomer.phone) {
      const msg = settings.whatsappMessageTemplate
        .replace('{cliente}', selectedCustomer.name)
        .replace('{pedido}', currentSaleId)
        .replace('{valor}', total.toFixed(2));
      
      setConfirmConfig({
          isOpen: true,
          title: "Enviar Comprovante",
          message: `Venda finalizada! Deseja enviar o comprovante via WhatsApp para ${selectedCustomer.name}?`,
          onConfirm: () => {
              window.open(`https://wa.me/55${selectedCustomer.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
          },
          confirmText: "Enviar WhatsApp",
          isDangerous: false
      });
    }

    setCart([]);
    setCurrentPayments([]);
    setShowPayment(false);
    setSelectedCustomer(defaultCustomer);
  };

  const total = calculateTotal();
  const paidTotal = currentPayments.reduce((acc, p) => acc + p.amount, 0);
  const remainingTotal = Math.max(0, total - paidTotal);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.includes(searchTerm);
    if (activeMobileTab === 'plans') {
        return matchesSearch && p.category === 'Planos';
    } else {
        return matchesSearch && p.category !== 'Planos';
    }
  });

  const pixPaymentAmount = useMemo(() => {
    return currentPayments
      .filter(p => p.method === PaymentMethod.PIX)
      .reduce((acc, p) => acc + p.amount, 0);
  }, [currentPayments]);

  const showPixScreen = remainingTotal <= 0.1 && pixPaymentAmount > 0;

  const pixData = useMemo(() => {
    if (!showPixScreen || !settings.pixKey) return null;
    try {
       const payload = generatePixPayload(settings.pixKey, settings.name || 'Loja', 'BRASIL', pixPaymentAmount.toString());
       const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(payload)}`;
       return { payload, qrUrl };
    } catch {
       return null;
    }
  }, [showPixScreen, pixPaymentAmount, settings]);

  const handleCopyPix = () => {
    if (pixData?.payload) {
        navigator.clipboard.writeText(pixData.payload);
        alert("Código Pix Copia e Cola copiado!");
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-slate-100 overflow-hidden relative">
      
      {/* ... (Mobile Tab Switcher and Left/Right Column Layout code remains largely the same) ... */}
      <div className="md:hidden bg-white border-b border-slate-200 flex text-sm font-medium shrink-0">
        <button onClick={() => setActiveMobileTab('cart')} className={`flex-1 py-3 flex items-center justify-center gap-2 ${activeMobileTab === 'cart' ? 'border-b-2 border-accent text-accent' : 'text-slate-500'}`}><ShoppingBag size={18} /> Carrinho ({cart.reduce((a,c)=>a+c.quantity, 0)})</button>
        <button onClick={() => setActiveMobileTab('catalog')} className={`flex-1 py-3 flex items-center justify-center gap-2 ${activeMobileTab === 'catalog' ? 'border-b-2 border-accent text-accent' : 'text-slate-500'}`}><Search size={18} /> Produtos</button>
        <button onClick={() => setActiveMobileTab('plans')} className={`flex-1 py-3 flex items-center justify-center gap-2 ${activeMobileTab === 'plans' ? 'border-b-2 border-accent text-accent' : 'text-slate-500'}`}><Zap size={18} /> Planos</button>
      </div>

      {/* LEFT COLUMN: Cart */}
      <div className={`${activeMobileTab === 'cart' ? 'flex' : 'hidden'} md:flex w-full md:w-5/12 flex-col bg-white border-r border-slate-200 shadow-xl z-10 h-full`}>
        {/* ... (Cart Header and Items) ... */}
        <div className="p-4 bg-primary text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold">Venda #{currentSaleId}</h2>
            <div className="flex items-center gap-2 mt-1 text-slate-300 text-sm cursor-pointer hover:text-white">
              <User size={14} />
              <select 
                className="bg-transparent border-none outline-none cursor-pointer max-w-[150px]"
                value={selectedCustomer?.id || 'def'}
                onChange={(e) => {
                  if (e.target.value === 'def') {
                      setSelectedCustomer(defaultCustomer);
                  } else {
                      const cust = customers.find(c => c.id === e.target.value);
                      if (cust) setSelectedCustomer(cust);
                  }
                }}
              >
                <option value="def" className="text-black">Cliente Balcão</option>
                {customers.map(c => <option key={c.id} value={c.id} className="text-black">{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="text-right">
             <div className="text-xs text-slate-400">Total</div>
             <div className="text-2xl font-bold">R$ {total.toFixed(2)}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
               <ShoppingBag size={48} className="mb-2 opacity-20" />
               <p>Caixa Livre</p>
               <p className="text-xs">Bipe um produto ou pesquise</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex gap-3 bg-slate-50 p-2 rounded border border-slate-100 items-center">
                <img src={item.image} alt="" className="w-12 h-12 rounded object-cover bg-white" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm leading-tight truncate">{item.name}</div>
                  <div className="text-xs text-slate-500">{item.quantity} x R$ {item.price.toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={() => updateQuantity(item.id, -1)} className="p-1 bg-slate-200 rounded hover:bg-slate-300 text-slate-700 w-6 h-6 flex items-center justify-center">-</button>
                   <span className="w-4 text-center text-sm font-bold">{item.quantity}</span>
                   <button onClick={() => updateQuantity(item.id, 1)} className="p-1 bg-slate-200 rounded hover:bg-slate-300 text-slate-700 w-6 h-6 flex items-center justify-center">+</button>
                </div>
                <div className="text-right w-16 md:w-20">
                  <div className="font-bold text-slate-800 text-sm">R$ {(item.quantity * item.price).toFixed(2)}</div>
                  <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
           {isSaleBlocked && (
               <div className="mb-2 p-2 bg-red-100 border border-red-200 rounded text-red-700 text-xs font-bold flex items-center gap-2 justify-center">
                   <AlertTriangle size={14} />
                   Para vender Planos, selecione um Cliente.
               </div>
           )}
           <form onSubmit={handleBarcodeSubmit} className="mb-3">
              <div className="relative">
                <input ref={barcodeRef} type="text" value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} placeholder="Código de Barras" className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:border-accent focus:ring-1 focus:ring-accent outline-none" autoFocus={window.innerWidth > 768} />
              </div>
           </form>
           <button 
                onClick={() => cart.length > 0 && !isSaleBlocked && setShowPayment(true)} 
                disabled={cart.length === 0 || isSaleBlocked} 
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex justify-between px-6 items-center ${cart.length > 0 && !isSaleBlocked ? 'bg-success text-white hover:bg-emerald-600' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
           >
             <span>{isSaleBlocked ? 'Selecione Cliente' : 'Finalizar Venda'}</span>
             <span>R$ {total.toFixed(2)}</span>
           </button>
        </div>
      </div>

      {/* RIGHT COLUMN: Products & Plans */}
      <div className={`${activeMobileTab === 'catalog' || activeMobileTab === 'plans' ? 'flex' : 'hidden'} md:flex w-full md:w-7/12 flex-col p-4 md:p-6 overflow-hidden h-full`}>
        
        {/* DESKTOP TOGGLE & SEARCH HEADER */}
        <div className="flex flex-col md:flex-row gap-4 mb-4 md:mb-6 shrink-0">
           {/* Desktop Toggle Buttons */}
           <div className="hidden md:flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm shrink-0">
                <button onClick={() => setActiveMobileTab('catalog')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeMobileTab === 'catalog' || activeMobileTab === 'cart' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}><Package size={16} /> Produtos</button>
                <button onClick={() => setActiveMobileTab('plans')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeMobileTab === 'plans' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}><Zap size={16} /> Planos</button>
           </div>
           <div className="relative flex-1">
             <Search className="absolute left-3 top-3 text-slate-400" size={20} />
             <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-accent" />
           </div>
        </div>

        {/* LIST */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 overflow-y-auto pb-20 content-start">
          {filteredProducts.map(product => {
            // Calculate Visual Stock
            const displayStock = getVisualStock(product);
            const isZeroStock = displayStock <= 0;

            return (
                <div 
                    key={product.id} 
                    onClick={() => addToCart(product)} 
                    className={`bg-white p-3 rounded-lg shadow-sm border transition-all flex flex-col active:scale-95 transform duration-100 cursor-pointer hover:shadow-md ${isZeroStock ? 'border-red-500 bg-red-50 animate-pulse ring-1 ring-red-500' : 'border-slate-200 hover:border-accent'}`}
                >
                  <div className="aspect-square bg-slate-100 rounded mb-2 overflow-hidden relative">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    <span className={`absolute bottom-0 right-0 text-[10px] px-1 rounded-tl font-bold ${isZeroStock ? 'bg-red-600 text-white' : 'bg-primary text-white'}`}>
                        Estoque: {displayStock}
                    </span>
                  </div>
                  <h3 className="font-medium text-slate-800 text-xs md:text-sm mb-1 leading-tight line-clamp-2 h-8 md:h-10">{product.name}</h3>
                  <div className="mt-auto flex justify-between items-end">
                    <span className="text-[10px] text-slate-400 truncate max-w-[50%]">{product.brand}</span>
                    <span className="font-bold text-accent text-sm md:text-base">R$ {product.price.toFixed(2)}</span>
                  </div>
                </div>
            );
          })}
          {filteredProducts.length === 0 && <div className="col-span-full py-10 text-center text-slate-400"><p>Nenhum item encontrado.</p></div>}
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center backdrop-blur-sm md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden h-[98vh] md:h-auto md:max-h-[90vh] flex flex-col md:flex-row">
            
            {/* Left: Summary & List */}
            <div className="w-full md:w-1/2 p-4 md:p-6 bg-slate-50 border-r border-slate-200 overflow-y-auto h-[40%] md:h-auto border-b md:border-b-0 shrink-0">
               {/* ... (Summary Info) ... */}
               <div className="flex justify-between items-center mb-2 md:mb-6">
                 <h3 className="text-lg md:text-xl font-bold text-slate-800">Resumo</h3>
                 <button onClick={() => setShowPayment(false)} className="md:hidden p-1 bg-slate-200 rounded-full"><X size={20}/></button>
               </div>
               
               <div className="space-y-2 md:space-y-4 mb-4">
                  <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm bg-blue-50/30">
                      <div className="flex items-center gap-2 mb-1"><User size={14} className="text-accent" /><span className="text-xs font-medium text-slate-500">Cliente</span></div>
                      <div className="text-base md:text-lg font-bold text-slate-800 pl-6">{selectedCustomer.name}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:block md:space-y-4">
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm"><div className="flex justify-between text-xs md:text-sm text-slate-500 mb-1">Total</div><div className="text-xl md:text-3xl font-bold text-slate-800">R$ {total.toFixed(2)}</div></div>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm"><div className="flex justify-between text-xs md:text-sm mb-1"><span className="text-green-600">Pago</span></div><div className="text-lg md:text-xl font-bold text-green-600">R$ {paidTotal.toFixed(2)}</div></div>
                  </div>
                  <div className={`p-3 rounded-lg border shadow-sm ${remainingTotal > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}><div className="flex justify-between text-xs md:text-sm mb-1"><span className={remainingTotal > 0 ? 'text-red-600' : 'text-green-600'}>Restante</span></div><div className={`text-lg md:text-xl font-bold ${remainingTotal > 0 ? 'text-red-600' : 'text-green-600'}`}>R$ {remainingTotal.toFixed(2)}</div></div>
               </div>

               <h4 className="font-bold text-slate-700 mb-2 text-xs md:text-sm uppercase tracking-wide">Adicionados</h4>
               <div className="space-y-2 pb-4">
                  {currentPayments.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                          <div className="flex items-center gap-2">
                             {p.method === PaymentMethod.CASH && <Banknote size={14} className="text-green-600"/>}
                             {p.method === PaymentMethod.PIX && <QrCode size={14} className="text-blue-600"/>}
                             {(p.method === PaymentMethod.CREDIT || p.method === PaymentMethod.DEBIT) && <CreditCard size={14} className="text-purple-600"/>}
                             {p.method === PaymentMethod.TERM && <CalendarClock size={14} className="text-orange-600"/>}
                             <div className="flex flex-col">
                                <span className="font-medium text-slate-700 text-sm">{p.method} {p.totalInstallments && p.totalInstallments > 1 ? `(${p.installmentNumber}/${p.totalInstallments})` : ''}</span>
                                {p.dueDate && <span className="text-xs text-orange-600 font-bold">Venc: {new Date(p.dueDate).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}</span>}
                             </div>
                          </div>
                          <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-800 text-sm">R$ {p.amount.toFixed(2)}</span>
                              <button onClick={() => removePayment(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                          </div>
                      </div>
                  ))}
                  {currentPayments.length === 0 && <div className="text-slate-400 text-xs text-center py-2 italic">Nenhum pagamento.</div>}
               </div>
            </div>

            {/* Right: Actions (Dynamic View) */}
            <div className="w-full md:w-1/2 p-4 md:p-6 flex flex-col h-[60%] md:h-auto bg-white">
               <div className="hidden md:flex justify-end mb-4">
                  <button onClick={() => setShowPayment(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
               </div>

               {showPixScreen ? (
                  /* ... (Pix UI remains same) ... */
                  <div className="flex-1 flex flex-col items-center justify-center animate-fade-in text-center overflow-y-auto">
                      <div className="bg-white p-3 rounded-lg shadow-md border border-slate-200 mb-2 shrink-0">
                         {pixData ? <img src={pixData.qrUrl} alt="QR Code Pix" className="w-40 h-40 md:w-64 md:h-64 object-contain" /> : <div className="w-40 h-40 md:w-64 md:h-64 flex items-center justify-center bg-slate-50 text-slate-400 text-sm p-4">configure a Chave Pix nas configurações.</div>}
                      </div>
                      <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-1">Pagamento via Pix</h3>
                      <p className="text-slate-500 mb-2 text-sm">Escaneie o QR Code para pagar <span className="font-bold text-slate-800">R$ {pixPaymentAmount.toFixed(2)}</span></p>
                      <button onClick={handleCopyPix} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors mb-4 border border-slate-200 text-sm"><Copy size={16} /> Copiar Código Pix</button>
                      <div className="w-full mt-auto pt-2"><button onClick={finalizeSale} className="w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all bg-success hover:bg-emerald-600 text-white hover:shadow-xl"><Check size={24} /> Confirmar Venda</button></div>
                  </div>
               ) : (
                  /* STANDARD VIEW: Input and Payment Selection */
                  <>
                    <div className="flex-1 overflow-y-auto">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Valor a Inserir</label>
                        <div className="relative mb-3 md:mb-6">
                            <span className="absolute left-4 top-3 md:top-3 text-slate-400 font-bold">R$</span>
                            <input 
                                type="number" 
                                className={`w-full pl-10 pr-4 py-2 md:py-3 text-xl md:text-2xl font-bold border-2 rounded-xl focus:ring-0 outline-none ${termFlow.active ? 'bg-slate-100 text-slate-500 border-slate-100' : 'text-slate-800 border-slate-200 focus:border-accent'}`}
                                value={amountToPay}
                                onChange={(e) => !termFlow.active && setAmountToPay(e.target.value)}
                                onFocus={(e) => !termFlow.active && e.target.select()}
                                readOnly={termFlow.active}
                            />
                        </div>

                        <label className="block text-xs font-medium text-slate-600 mb-2">Selecione a Forma de Pagamento</label>
                        <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4">
                                <button onClick={() => addPayment(PaymentMethod.CASH)} disabled={termFlow.active} className={`flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border border-slate-200 transition-all gap-1 md:gap-2 group ${termFlow.active ? 'opacity-40 cursor-not-allowed' : 'hover:border-green-500 hover:bg-green-50'}`}><Banknote size={20} className="text-slate-400 group-hover:text-green-600"/><span className="font-medium text-slate-600 text-sm group-hover:text-green-700">Dinheiro</span></button>
                                <button onClick={() => addPayment(PaymentMethod.PIX)} disabled={termFlow.active} className={`flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border border-slate-200 transition-all gap-1 md:gap-2 group ${termFlow.active ? 'opacity-40 cursor-not-allowed' : 'hover:border-blue-500 hover:bg-blue-50'}`}><QrCode size={20} className="text-slate-400 group-hover:text-blue-600"/><span className="font-medium text-slate-600 text-sm group-hover:text-blue-700">Pix</span></button>
                                <button onClick={() => addPayment(PaymentMethod.CREDIT)} disabled={termFlow.active} className={`flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border border-slate-200 transition-all gap-1 md:gap-2 group ${termFlow.active ? 'opacity-40 cursor-not-allowed' : 'hover:border-purple-500 hover:bg-purple-50'}`}><CreditCard size={20} className="text-slate-400 group-hover:text-purple-600"/><span className="font-medium text-slate-600 text-sm group-hover:text-purple-700">Crédito</span></button>
                                <button onClick={() => addPayment(PaymentMethod.DEBIT)} disabled={termFlow.active} className={`flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border border-slate-200 transition-all gap-1 md:gap-2 group ${termFlow.active ? 'opacity-40 cursor-not-allowed' : 'hover:border-purple-500 hover:bg-purple-50'}`}><CreditCard size={20} className="text-slate-400 group-hover:text-purple-600"/><span className="font-medium text-slate-600 text-sm group-hover:text-purple-700">Débito</span></button>

                                {/* CONDITIONAL TERM BUTTON / DATE INPUT / PLAN EXPIRE SPLIT */}
                                {!isTermSelection ? (
                                   <>
                                     <button 
                                        onClick={() => {
                                          if(selectedCustomer.id === 'def') return;
                                          setIsTermSelection(true);
                                        }} 
                                        disabled={selectedCustomer.id === 'def' || termFlow.active} 
                                        className={`${hasPlanInCart ? 'col-span-1' : 'col-span-2'} flex flex-row items-center justify-center p-3 md:p-4 rounded-xl border transition-all gap-2 md:gap-3 group ${selectedCustomer.id === 'def' || termFlow.active ? 'bg-slate-100 opacity-50 cursor-not-allowed border-slate-200' : 'border-slate-200 hover:border-orange-500 hover:bg-orange-50'}`}
                                     >
                                        <CalendarClock size={20} className="text-slate-400 group-hover:text-orange-600"/>
                                        <span className="font-medium text-slate-600 text-sm group-hover:text-orange-700">{hasPlanInCart ? 'A Prazo' : 'A Prazo (Crediário)'}</span>
                                        {!hasPlanInCart && selectedCustomer.id === 'def' && <span className="text-xs text-slate-400 ml-2">(Selecione um cliente)</span>}
                                     </button>

                                     {hasPlanInCart && (
                                         <div className="col-span-1 bg-blue-50 border border-blue-100 rounded-xl p-2 flex flex-col justify-center">
                                             <label className="text-[10px] uppercase font-bold text-blue-600 mb-1 flex items-center gap-1"><Calendar size={10} /> Vencimento do Plano</label>
                                             <input 
                                                type="date"
                                                className="bg-slate-100 border border-blue-200 rounded p-1 text-sm text-slate-500 outline-none w-full cursor-not-allowed font-bold"
                                                value={planDueDate}
                                                readOnly
                                             />
                                         </div>
                                     )}
                                   </>
                                ) : (
                                   <div className="col-span-2 flex gap-2 items-center bg-orange-50 p-2 rounded-xl border border-orange-200 animate-fade-in">
                                      <div className="flex-1">
                                        <label className="text-xs font-bold text-orange-600 block mb-1">
                                            {termFlow.active ? `${termFlow.currentStep}º Vencimento` : 'Vencimento da Parcela'}
                                        </label>
                                        <input 
                                          type="date" 
                                          className="w-full text-sm p-1 rounded border border-orange-300 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                          value={termDate}
                                          onChange={(e) => setTermDate(e.target.value)}
                                        />
                                      </div>
                                      <div className="w-20">
                                        <label className="text-xs font-bold text-orange-600 block mb-1">Parcelas</label>
                                        <input 
                                          type="number" min="1" max="12"
                                          className={`w-full text-sm p-1 rounded border border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center ${termFlow.active ? 'bg-slate-100 text-slate-500' : 'bg-white'}`}
                                          value={termFlow.active ? termFlow.totalSteps : termInstallments}
                                          onChange={(e) => !termFlow.active && setTermInstallments(parseInt(e.target.value) || 1)}
                                          readOnly={termFlow.active}
                                        />
                                      </div>
                                      <button onClick={handleTermStep} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold text-sm h-full">Confirmar</button>
                                      {!termFlow.active && (
                                        <button onClick={() => setIsTermSelection(false)} className="text-slate-400 hover:text-slate-600 p-2"><X size={18} /></button>
                                      )}
                                   </div>
                                )}
                        </div>
                    </div>

                    {!isTermSelection && (
                        <div className="mt-auto pt-2">
                            <button onClick={finalizeSale} disabled={remainingTotal > 0.1} className={`w-full py-3 md:py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all ${remainingTotal > 0.1 ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-success hover:bg-emerald-600 text-white hover:shadow-xl'}`}>
                                <Check size={24} /> {remainingTotal > 0.1 ? `Faltam R$ ${remainingTotal.toFixed(2)}` : 'Confirmar'}
                            </button>
                        </div>
                    )}
                  </>
               )}
            </div>

          </div>
        </div>
      )}

      {showPrintOptions && (
         <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
                <Printer size={48} className="mx-auto text-blue-500 mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Venda Finalizada!</h3>
                <p className="text-slate-500 mb-6">Deseja imprimir o comprovante?</p>
                <div className="grid grid-cols-1 gap-3">
                    <button onClick={() => handlePrintOption('print')} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center justify-center gap-2"><Printer size={20} /> Imprimir Cupom</button>
                    <button onClick={() => handlePrintOption('save')} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center justify-center gap-2"><FileDown size={20} /> Salvar Arquivo</button>
                    <button onClick={() => handlePrintOption('none')} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium">Finalizar sem Imprimir</button>
                </div>
            </div>
         </div>
      )}

      {confirmConfig && <ConfirmModal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig(null)} onConfirm={confirmConfig.onConfirm} title={confirmConfig.title} message={confirmConfig.message} isDangerous={confirmConfig.isDangerous} confirmText={confirmConfig.confirmText || "Confirmar"} />}
    </div>
  );
};
