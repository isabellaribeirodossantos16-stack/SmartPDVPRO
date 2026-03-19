
// ... existing imports
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'; // Added useRef
import { Product, Customer, Sale, FinancialRecord, Supplier, Brand, CompanySettings, PaymentMethod, User, LicenseKey, LicenseType, AppLog, PlanConfig, MessageTemplate, Raffle } from '../types';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, getDocs, getDoc, writeBatch } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
// @ts-ignore
import CryptoJS from 'crypto-js';

// ... (Keep existing Interfaces and Helpers until StoreContext definition)

interface StoreContextType {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  financialRecords: FinancialRecord[];
  suppliers: Supplier[];
  brands: Brand[];
  settings: CompanySettings;
  
  // New: Message Templates
  messageTemplates: MessageTemplate[];
  
  // New: Raffles
  raffles: Raffle[];

  // Auth & Admin Data
  currentUser: User | null;
  users: User[];
  licenseKeys: LicenseKey[];
  logs: AppLog[];
  
  // Permissions Helpers
  isFreeVersion: boolean;
  isAdmin: boolean;
  isCloudSync: boolean; 

  // Actions
  addProduct: (p: Product) => void;
  updateProduct: (p: Product) => void;
  removeProduct: (id: string) => void;
  addSale: (s: Sale) => void;
  addCustomer: (c: Customer) => void;
  updateCustomer: (c: Customer) => void;
  removeCustomer: (id: string) => void;
  addSupplier: (s: Supplier) => void;
  updateSupplier: (s: Supplier) => void;
  removeSupplier: (id: string) => void;
  addBrand: (b: Brand) => void;
  updateBrand: (b: Brand) => void;
  removeBrand: (id: string) => void;
  addFinancialRecord: (r: FinancialRecord) => void;
  updateFinancialRecord: (id: string, data: Partial<FinancialRecord>) => void;
  removeFinancialRecord: (id: string) => void; 
  removeFinancialGroup: (docNumber: string) => void; 
  registerPayment: (id: string, amount: number) => void;
  updateSettings: (s: CompanySettings) => void;
  
  // New: Message Template Actions
  addMessageTemplate: (m: MessageTemplate) => void;
  updateMessageTemplate: (m: MessageTemplate) => void;
  removeMessageTemplate: (id: string) => void;

  // New: Raffle Actions
  addRaffle: (r: Raffle) => void;

  // UPDATED BACKUP ACTIONS
  backupData: () => Promise<string>;
  restoreData: (content: string, passwordInput: string) => Promise<{ isCloud: boolean }>;
  
  // DATA PERSISTENCE SWITCH & SYNC
  saveCloudDataToLocal: () => void;
  uploadLocalDataToCloud: () => Promise<void>; 
  clearLocalData: () => void; 
  
  // NEW ACTION FOR DATA CLEANUP
  cleanupOldData: (options: { revenues: boolean, payables: boolean, sales: boolean, forceAll?: boolean }) => Promise<{ deletedSales: number, deletedRecords: number }>;

  // Auth Actions
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  registerUser: (u: Partial<User> & { password?: string }) => Promise<{ success: boolean; message: string }>;
  resetUserPassword: (username: string, email: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  updateUserCredentials: (type: 'username' | 'password' | 'email', verification: { u?: string, e?: string, p?: string }, newValue: string) => Promise<{ success: boolean; message: string }>;
  
  // Admin Actions
  generateLicenseKey: (type: LicenseType) => string;
  activateLicense: (key: string, username: string) => { success: boolean, message: string };
  adminGenerateAndActivate: (type: LicenseType, userId: string) => { success: boolean, message: string };
  adminDeleteUser: (userId: string) => void;
  adminResetCooldown: (userId: string, type: 'NAME' | 'PASSWORD' | 'EMAIL') => Promise<void>;
  adminToggleUserSync: (userId: string, status: boolean) => Promise<void>; // NEW
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// ... (Keep defaultPlans, initialSettings, Helpers and useEffects until addSale function)
// RE-INSERTING ESSENTIAL HELPERS FOR CONTEXT INTEGRITY
const defaultPlans: PlanConfig[] = [
    { key: 'monthly_basic', name: "Mensal Básico", price: "R$ 39,90", isVisible: true, features: ["Acesso total ao sistema", "App Versão Offline", "Sem custos adicionais"] },
    { key: 'annual_eco', name: "Anual Econômico", price: "R$ 299,90", isVisible: true, features: ["Acesso total ao sistema", "App Versão Offline", "Equivalente a R$ 24,99/mês"] },
    { key: 'lifetime', name: "Vitalício Premium", price: "R$ 499,90", isVisible: true, features: ["Acesso total ao sistema", "App Versão Offline", "Sem renovações", "Suporte prioritário"] },
    { key: 'fidelity', name: "Mensal Fidelidade", price: "R$ 89,90", isVisible: true, features: ["Acesso total ao sistema", "Funciona Online", "Backup em Nuvem Auto", "Acesso Multi-dispositivo", "Login em qualquer lugar"] }
];

const initialSettings: CompanySettings = {
  name: "Minha Loja", cnpj: "", stateRegistration: "", phone: "", address: "", pixKey: "", whatsappMessageTemplate: "Olá {cliente}, identificamos um débito de R$ {valor} referente ao pedido {pedido}. Segue chave Pix para pagamento:", logo: "", loginEnabled: true,
  dashboardWidgets: { sales: { enabled: true, range: 0 }, receivables: { enabled: true, range: 30 }, payables: { enabled: true, range: 30 }, alerts: { enabled: true, range: 3 }, birthdays: { enabled: true, range: 0 }, lists: true },
  printerConfig: { enabled: true, autoPrint: false, paperWidth: '80mm' }, licenseKey: "FREE-TRIAL", sidebarConfig: { backgroundColor: '#0f172a', textColor: '#cbd5e1', activeItemColor: '#3b82f6' }, backupRestorationCount: 0, cloudSyncEnabled: false, dataRetention: { revenues: 0, payables: 0, sales: 0 }, customPlans: defaultPlans
};

const saveLocalImage = (id: string, base64: string | undefined, prefix: string) => { if (!base64) return; try { localStorage.setItem(`img_${prefix}_${id}`, base64); } catch (e) { console.error("Storage limit reached for images", e); } };
const getLocalImage = (id: string, prefix: string) => { return localStorage.getItem(`img_${prefix}_${id}`) || undefined; };
const removeLocalImage = (id: string, prefix: string) => { localStorage.removeItem(`img_${prefix}_${id}`); };

const LOCAL_KEYS = { PRODUCTS: 'smartpdv_products', CUSTOMERS: 'smartpdv_customers', SALES: 'smartpdv_sales', FINANCE: 'smartpdv_financial', SUPPLIERS: 'smartpdv_suppliers', BRANDS: 'smartpdv_brands', SETTINGS: 'smartpdv_settings', MESSAGES: 'smartpdv_messages', RAFFLES: 'smartpdv_raffles' };

function getLocalData<T>(key: string): T[] { try { const data = localStorage.getItem(key); return data ? JSON.parse(data) : []; } catch { return []; } }
const setLocalData = (key: string, data: any[]) => { localStorage.setItem(key, JSON.stringify(data)); };
const SECRET_KEY = "SMARTPDV_SECURE_2024_PRO";
const encryptDataWithCryptoJS = (data: any): string => { try { const jsonStr = JSON.stringify(data); return CryptoJS.AES.encrypt(jsonStr, SECRET_KEY).toString(); } catch (e) { console.error("Erro na criptografia", e); throw new Error("Falha ao criptografar dados."); } };
const decryptDataWithCryptoJS = (cipherText: string): any => { try { const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY); const decryptedStr = bytes.toString(CryptoJS.enc.Utf8); if (!decryptedStr) throw new Error("Decryption failed"); return JSON.parse(decryptedStr); } catch (e) { console.error("Erro na descriptografia", e); throw new Error("Arquivo inválido ou senha incorreta."); } };
const cleanForCloud = (data: any) => { if (!data) return data; const { image, logo, ...rest } = data; if (rest.items && Array.isArray(rest.items)) { rest.items = rest.items.map((i: any) => { const { image, ...itemRest } = i; return itemRest; }); } return rest; };
const normalizeDate = (dateStr: string | undefined): string => { if (!dateStr) { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString(); } if (dateStr.length === 10 && dateStr.includes('-')) { const [y, m, d] = dateStr.split('-').map(Number); const date = new Date(y, m - 1, d, 12, 0, 0, 0); return date.toISOString(); } return dateStr; };

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ... (State initialization same as original file)
  const [currentUser, setCurrentUser] = useState<User | null>(() => { const stored = localStorage.getItem('current_session_soft'); return stored ? JSON.parse(stored) : null; });
  const [authInitialized, setAuthInitialized] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [settings, setSettings] = useState<CompanySettings>(initialSettings);
  const [users, setUsers] = useState<User[]>([]);
  const [licenseKeys, setLicenseKeys] = useState<LicenseKey[]>([]);
  const [logs, setLogs] = useState<AppLog[]>([]);
  
  const productsRef = useRef<string>("");
  const customersRef = useRef<string>("");
  const salesRef = useRef<string>("");
  const financeRef = useRef<string>("");

  const isAdmin = currentUser?.role === 'admin' || currentUser?.username === 'Coutinho';
  const isFreeVersion = !isAdmin && (!currentUser?.licenseKey || currentUser?.licenseKey === 'FREE-TRIAL' || currentUser?.licenseKey === 'FREE-VERSION');
  
  // Logic Updated: isCloudSync depends on Plan OR Admin Override
  const isCloudSync = useMemo(() => {
      if (!currentUser) return false;
      const keyData = licenseKeys.find(k => k.key === currentUser.licenseKey);
      
      // Allow if: Admin OR Plan is Fidelity OR User has 'allowedCloudSync' explicitly set to true
      const hasPlanPermission = isAdmin || (keyData && keyData.type === 'monthly_fidelity') || currentUser.allowedCloudSync === true;
      
      return hasPlanPermission && settings.cloudSyncEnabled === true;
  }, [currentUser, licenseKeys, isAdmin, settings.cloudSyncEnabled]);

  const logAction = (action: string, details: string, targetUserId?: string, targetUsername?: string) => {
      const uId = targetUserId || currentUser?.id;
      const uName = targetUsername || currentUser?.username;
      if (!uId || !uName) return;
      addDoc(collection(db, 'logs'), { ownerId: uId, userId: uId, username: uName, action, details, timestamp: new Date().toISOString() }).catch(e => console.warn("Logging suppressed", e));
  };

  // ... (useEffect listeners)
  useEffect(() => { const handleSoftReset = () => { localStorage.removeItem('current_session_soft'); setCurrentUser(null); setProducts([]); setCustomers([]); setSales([]); setFinancialRecords([]); setSuppliers([]); setBrands([]); setMessageTemplates([]); setRaffles([]); setSettings(initialSettings); signOut(auth).catch(() => {}); }; window.addEventListener('app:soft_reset', handleSoftReset); return () => window.removeEventListener('app:soft_reset', handleSoftReset); }, []);
  
  // Initial Auth Listener
  useEffect(() => { const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => { if (firebaseUser) { try { const userDocRef = doc(db, 'users', firebaseUser.uid); const userDocSnap = await getDoc(userDocRef); if (userDocSnap.exists()) { const userData = { id: userDocSnap.id, ...userDocSnap.data() } as User; updateDoc(userDocRef, { isOnline: true, lastLogin: new Date().toISOString() }).catch(() => {}); setCurrentUser(userData); localStorage.removeItem('current_session_soft'); const settingsQuery = query(collection(db, 'settings'), where('ownerId', '==', userData.id)); const settingsSnap = await getDocs(settingsQuery); if (!settingsSnap.empty) { const remoteSettings = { ...settingsSnap.docs[0].data(), id: settingsSnap.docs[0].id } as CompanySettings; if (!remoteSettings.customPlans) { remoteSettings.customPlans = defaultPlans; } setSettings(remoteSettings); setLocalData(LOCAL_KEYS.SETTINGS, [remoteSettings]); } } else { const newUser: User = { id: firebaseUser.uid, username: firebaseUser.email?.split('@')[0] || 'User', email: firebaseUser.email || '', role: 'user', isOnline: true, lastLogin: new Date().toISOString(), history: [], licenseKey: 'FREE-TRIAL', licenseExpiry: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), allowedCloudSync: false }; setDoc(userDocRef, newUser).catch(() => {}); setCurrentUser(newUser); } } catch (e) { console.error("Error fetching user profile:", e); } } else { const storedSoft = localStorage.getItem('current_session_soft'); if (storedSoft) { setCurrentUser(JSON.parse(storedSoft)); } else { const storedSettings = getLocalData<CompanySettings>(LOCAL_KEYS.SETTINGS); const activeSettings = storedSettings[0] || initialSettings; if (activeSettings.loginEnabled === false) { const guestUser: User = { id: 'guest_user', username: 'Vendedor (Visitante)', email: '', role: 'user', isOnline: true, history: [], licenseKey: 'FREE-VERSION' }; setCurrentUser(guestUser); setSettings(activeSettings); } else { setCurrentUser(null); setProducts([]); setCustomers([]); setSales([]); setFinancialRecords([]); setSuppliers([]); setBrands([]); setMessageTemplates([]); setRaffles([]); setSettings(initialSettings); setLogs([]); } } } setAuthInitialized(true); }); return () => unsubscribeAuth(); }, []);
  
  // NEW EFFECT: Real-time User Profile Sync
  // This ensures that if Admin grants 'allowedCloudSync', the user gets it immediately without relogging.
  useEffect(() => {
      if (!currentUser?.id || currentUser.id === 'guest_user') return;

      const unsubUserProfile = onSnapshot(doc(db, 'users', currentUser.id), (docSnap) => {
          if (docSnap.exists()) {
              const freshData = { id: docSnap.id, ...docSnap.data() } as User;
              // Update state if permissions changed
              setCurrentUser(prev => {
                  if (!prev) return freshData;
                  if (prev.allowedCloudSync !== freshData.allowedCloudSync || prev.licenseKey !== freshData.licenseKey) {
                      return { ...prev, ...freshData };
                  }
                  return prev;
              });
          }
      });

      return () => unsubUserProfile();
  }, [currentUser?.id]);

  useEffect(() => { 
      if (!currentUser) return; 
      
      let unsubKeys = () => {}; 
      let unsubUsers = () => {}; 

      try { 
          const licQuery = isAdmin ? collection(db, 'licenseKeys') : query(collection(db, 'licenseKeys'), where('usedBy', '==', currentUser.username)); 
          unsubKeys = onSnapshot(licQuery, (snapshot) => { setLicenseKeys(snapshot.docs.map(doc => ({ ...doc.data() } as LicenseKey))); }); 
      } catch (e) {} 

      if (isAdmin) {
          try {
              unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
                  const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
                  setUsers(usersList);
              });
          } catch (e) { console.error("Error subscribing to users list", e); }
      }

      let unsubProds = () => {}; let unsubCusts = () => {}; let unsubSales = () => {}; let unsubFin = () => {}; let unsubSupp = () => {}; let unsubBrands = () => {}; let unsubMsgs = () => {}; let unsubRaffles = () => {}; let unsubSettings = () => {}; 
      
      if (isCloudSync) { 
          const q = (col: string) => query(collection(db, col), where('ownerId', '==', currentUser.id)); 
          unsubProds = onSnapshot(q('products'), (snap) => { const data = snap.docs.map(doc => { const { id, ...rest } = doc.data(); const p = { ...rest, id: doc.id } as Product; const localImg = getLocalImage(p.id, 'prod'); if (localImg) p.image = localImg; return p; }); if (productsRef.current !== JSON.stringify(data)) { productsRef.current = JSON.stringify(data); setProducts(data); } }); 
          unsubCusts = onSnapshot(q('customers'), (snap) => { const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Customer)); if (customersRef.current !== JSON.stringify(data)) { customersRef.current = JSON.stringify(data); setCustomers(data); } }); 
          unsubSales = onSnapshot(q('sales'), (snap) => { const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale)); if (salesRef.current !== JSON.stringify(data)) { salesRef.current = JSON.stringify(data); setSales(data); } }); 
          
          // UPDATED: Smarter Merge for Financial Records to prevent missing data
          unsubFin = onSnapshot(q('financialRecords'), (snap) => { 
              const cloudRecords = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as FinancialRecord)); 
              
              setFinancialRecords(prev => {
                  const cloudMap = new Map(cloudRecords.map(r => [r.id, r]));
                  
                  // Helper to identify unique records ignoring ID (which changes from Local to Cloud)
                  const getSig = (r: FinancialRecord) => `${r.documentNumber || ''}|${r.description}|${r.type}|${r.dueDate}`;
                  const cloudSignatures = new Set(cloudRecords.map(r => getSig(r)));

                  // Keep records from PREV that are NOT in Cloud (by ID) AND don't have a matching signature (duplicate check)
                  const preservedLocal = prev.filter(local => {
                      if (cloudMap.has(local.id)) return false;
                      if (cloudSignatures.has(getSig(local))) return false;
                      return true;
                  });

                  // Merge Cloud + Preserved Local (Optimistic updates)
                  // Sort by Date Descending
                  const merged = [...cloudRecords, ...preservedLocal];
                  return merged.sort((a,b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
              });
          }); 

          unsubSupp = onSnapshot(q('suppliers'), (snap) => { const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier)); setSuppliers(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev); }); 
          unsubBrands = onSnapshot(q('brands'), (snap) => { const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Brand)); setBrands(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev); }); 
          unsubMsgs = onSnapshot(q('messages'), (snap) => { const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as MessageTemplate)); setMessageTemplates(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev); }); 
          unsubRaffles = onSnapshot(q('raffles'), (snap) => { const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Raffle)); setRaffles(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev); }); 
          unsubSettings = onSnapshot(q('settings'), (snap) => { 
              if (!snap.empty) { 
                  const { id, ...rest } = snap.docs[0].data(); 
                  const settingsData = { ...rest, id: snap.docs[0].id } as CompanySettings; 
                  if (!settingsData.customPlans) settingsData.customPlans = defaultPlans; 
                  const currentKeyData = licenseKeys.find(k => k.key === currentUser.licenseKey);
                  const hasPlanPermission = isAdmin || (currentKeyData && currentKeyData.type === 'monthly_fidelity') || currentUser.allowedCloudSync === true;
                  if (!hasPlanPermission) { settingsData.cloudSyncEnabled = false; } 
                  const localLogo = getLocalImage(settingsData.ownerId!, 'logo'); 
                  if (localLogo) settingsData.logo = localLogo; 
                  setSettings(prev => JSON.stringify(prev) !== JSON.stringify(settingsData) ? settingsData : prev); setLocalData(LOCAL_KEYS.SETTINGS, [settingsData]); 
              } 
          }); 
      } else { 
          setProducts(getLocalData<Product>(LOCAL_KEYS.PRODUCTS)); 
          setCustomers(getLocalData<Customer>(LOCAL_KEYS.CUSTOMERS)); 
          setSales(getLocalData<Sale>(LOCAL_KEYS.SALES)); 
          setFinancialRecords(getLocalData<FinancialRecord>(LOCAL_KEYS.FINANCE)); 
          setSuppliers(getLocalData<Supplier>(LOCAL_KEYS.SUPPLIERS)); 
          setBrands(getLocalData<Brand>(LOCAL_KEYS.BRANDS)); 
          setMessageTemplates(getLocalData<MessageTemplate>(LOCAL_KEYS.MESSAGES)); 
          setRaffles(getLocalData<Raffle>(LOCAL_KEYS.RAFFLES)); 
          const localSettings = getLocalData<CompanySettings>(LOCAL_KEYS.SETTINGS)[0]; 
          if (localSettings) { if (!localSettings.customPlans) localSettings.customPlans = defaultPlans; setSettings(localSettings); } else { setSettings(initialSettings); } 
      } 
      
      return () => { unsubProds(); unsubCusts(); unsubSales(); unsubFin(); unsubSupp(); unsubBrands(); unsubMsgs(); unsubRaffles(); unsubSettings(); unsubKeys(); unsubUsers(); }; 
  }, [currentUser?.id, isAdmin, isCloudSync]);

  const cleanupOldData = async (options: { revenues: boolean, payables: boolean, sales: boolean, forceAll?: boolean }) => { return { deletedSales: 0, deletedRecords: 0 }; };

  // --- CRUD ACTIONS ---
  // ... (Products, Sales, Customers, etc... Keep existing logic)
  const addProduct = async (p: Product) => { if (!currentUser) return; if (isCloudSync) { const {image, id, ...d} = p; try { const ref = await addDoc(collection(db,'products'),{...cleanForCloud(d), ownerId:currentUser.id}); if(image) saveLocalImage(ref.id, image, 'prod'); }catch(e){} } else { const newP = {...p, id:Date.now().toString(), ownerId:currentUser.id}; setProducts([...products, newP]); setLocalData(LOCAL_KEYS.PRODUCTS, [...products, newP]); if(p.image) saveLocalImage(newP.id, p.image, 'prod'); } };
  const updateProduct = async (p: Product) => { if (isCloudSync) { const {image,id,...d}=p; if(image) saveLocalImage(id,image,'prod'); try{await updateDoc(doc(db,'products',id),cleanForCloud(d));}catch(e){} } else { const newP = products.map(x=>x.id===p.id?p:x); setProducts(newP); setLocalData(LOCAL_KEYS.PRODUCTS, newP); if(p.image) saveLocalImage(p.id,p.image,'prod'); } };
  const removeProduct = async (id: string) => { if(isCloudSync){ try{await deleteDoc(doc(db,'products',id)); removeLocalImage(id,'prod');}catch(e){} } else { const newP = products.filter(x=>x.id!==id); setProducts(newP); setLocalData(LOCAL_KEYS.PRODUCTS, newP); removeLocalImage(id,'prod'); } };
  
  // UPDATED addSale to ensure Financial Records appear instantly
  const addSale = async (s: Sale) => {
      if (isCloudSync) {
          const { id, ...d } = s;
          await addDoc(collection(db, 'sales'), { ...cleanForCloud(d), ownerId: currentUser!.id });
      } else {
          setSales(prev => [s, ...prev]);
          setLocalData(LOCAL_KEYS.SALES, [s, ...sales]);
      }
      const updatedProducts = [...products];
      const batchUpdates = []; 
      for (const item of s.items) {
          if (item.category === 'Planos') continue;
          const productIndex = updatedProducts.findIndex(p => p.id === item.id);
          if (productIndex > -1) {
              const currentStock = updatedProducts[productIndex].stock;
              const newStock = currentStock - item.quantity;
              updatedProducts[productIndex] = { ...updatedProducts[productIndex], stock: newStock };
              if (isCloudSync) {
                  batchUpdates.push(updateDoc(doc(db, 'products', item.id), { stock: newStock }));
              }
          }
      }
      setProducts(updatedProducts);
      if (!isCloudSync) {
          setLocalData(LOCAL_KEYS.PRODUCTS, updatedProducts);
      } else {
          try { await Promise.all(batchUpdates); } catch (e) { console.error("Failed to sync stock updates", e); }
      }
      const newFinancialRecords: FinancialRecord[] = [];
      s.payments.forEach((payment, index) => {
          const isPaid = payment.method !== 'A Prazo';
          const dueDate = payment.dueDate || s.date;
          const record: FinancialRecord = {
              id: `${s.id}_pay_${index}_${Date.now()}`,
              ownerId: currentUser?.id,
              documentNumber: s.id,
              description: `Venda #${s.id} (${payment.method})`,
              amount: payment.amount,
              originalAmount: payment.amount,
              type: 'receivable',
              dueDate: normalizeDate(dueDate),
              status: isPaid ? 'paid' : 'pending',
              entityName: s.customerId ? (customers.find(c => c.id === s.customerId)?.name || 'Cliente') : 'Cliente Balcão',
              history: isPaid ? [{ date: s.date, amount: payment.amount, note: 'Pagamento à vista' }] : []
          };
          newFinancialRecords.push(record);
      });

      // ALWAYS UPDATE STATE (OPTIMISTIC)
      setFinancialRecords(prev => [...prev, ...newFinancialRecords]);

      if (isCloudSync) {
          newFinancialRecords.forEach(record => {
             addDoc(collection(db, 'financialRecords'), { 
                 ...cleanForCloud(record), 
                 ownerId: currentUser!.id,
                 dueDate: record.dueDate
             }).catch(console.error);
          });
      } else {
          const currentFinance = getLocalData<FinancialRecord>(LOCAL_KEYS.FINANCE);
          const updatedFinance = [...currentFinance, ...newFinancialRecords];
          setLocalData(LOCAL_KEYS.FINANCE, updatedFinance);
      }
  };

  const addCustomer = async (c:Customer) => { if(isCloudSync){const {id,...d}=c; await addDoc(collection(db,'customers'),{...cleanForCloud(d),ownerId:currentUser!.id});}else{const n={...c,id:Date.now().toString(),ownerId:currentUser!.id}; setCustomers([...customers,n]); setLocalData(LOCAL_KEYS.CUSTOMERS,[...customers,n]);}};
  const updateCustomer = async (c:Customer) => { if(isCloudSync){const {id,...d}=c; await updateDoc(doc(db,'customers',id),cleanForCloud(d));}else{const n=customers.map(x=>x.id===c.id?c:x); setCustomers(n); setLocalData(LOCAL_KEYS.CUSTOMERS,n);}};
  const removeCustomer = async (id:string) => { if(isCloudSync){await deleteDoc(doc(db,'customers',id));}else{const n=customers.filter(x=>x.id!==id); setCustomers(n); setLocalData(LOCAL_KEYS.CUSTOMERS,n);}};
  const addSupplier = async (s:Supplier) => { if(isCloudSync){const {id,...d}=s; await addDoc(collection(db,'suppliers'),{...cleanForCloud(d),ownerId:currentUser!.id});}else{const n={...s,id:Date.now().toString(),ownerId:currentUser!.id}; setSuppliers([...suppliers,n]); setLocalData(LOCAL_KEYS.SUPPLIERS,[...suppliers,n]);}};
  const updateSupplier = async (s:Supplier) => { if(isCloudSync){const {id,...d}=s; await updateDoc(doc(db,'suppliers',id),cleanForCloud(d));}else{const n=suppliers.map(x=>x.id===s.id?s:x); setSuppliers(n); setLocalData(LOCAL_KEYS.SUPPLIERS,n);}};
  const removeSupplier = async (id:string) => { if(isCloudSync){await deleteDoc(doc(db,'suppliers',id));}else{const n=suppliers.filter(x=>x.id!==id); setSuppliers(n); setLocalData(LOCAL_KEYS.SUPPLIERS,n);}};
  const addBrand = async (b:Brand) => { if(isCloudSync){const {id,...d}=b; await addDoc(collection(db,'brands'),{...cleanForCloud(d),ownerId:currentUser!.id});}else{const n={...b,id:Date.now().toString(),ownerId:currentUser!.id}; setBrands([...brands,n]); setLocalData(LOCAL_KEYS.BRANDS,[...brands,n]);}};
  const updateBrand = async (b:Brand) => { if(isCloudSync){const {id,...d}=b; await updateDoc(doc(db,'brands',id),cleanForCloud(d));}else{const n=brands.map(x=>x.id===b.id?b:x); setBrands(n); setLocalData(LOCAL_KEYS.BRANDS,n);}};
  const removeBrand = async (id:string) => { if(isCloudSync){await deleteDoc(doc(db,'brands',id));}else{const n=brands.filter(x=>x.id!==id); setBrands(n); setLocalData(LOCAL_KEYS.BRANDS,n);}};
  const addFinancialRecord = async (r:FinancialRecord) => { const recordWithFixedDate = { ...r, dueDate: normalizeDate(r.dueDate) }; setFinancialRecords(prev=>[...prev,recordWithFixedDate]); if(isCloudSync){const {id,...d}=recordWithFixedDate; await addDoc(collection(db,'financialRecords'),{...cleanForCloud(d),ownerId:currentUser!.id});}else{const n={...recordWithFixedDate,id:r.id||Date.now().toString(),ownerId:currentUser!.id}; setFinancialRecords([...financialRecords,n]); setLocalData(LOCAL_KEYS.FINANCE,[...financialRecords,n]);}};
  const updateFinancialRecord = async (id:string,d:Partial<FinancialRecord>) => { if(isCloudSync){await updateDoc(doc(db,'financialRecords',id),cleanForCloud(d));}else{const n=financialRecords.map(x=>x.id===id?{...x,...d}:x); setFinancialRecords(n); setLocalData(LOCAL_KEYS.FINANCE,n);}};
  const removeFinancialRecord = async (id:string) => { if(isCloudSync){await deleteDoc(doc(db,'financialRecords',id));}else{const n=financialRecords.filter(x=>x.id!==id); setFinancialRecords(n); setLocalData(LOCAL_KEYS.FINANCE,n);}};
  const removeFinancialGroup = async (docNum:string) => { if(isCloudSync){const d=financialRecords.filter(r=>r.documentNumber===docNum); d.forEach(async r=>await deleteDoc(doc(db,'financialRecords',r.id)));}else{const n=financialRecords.filter(x=>x.documentNumber!==docNum); setFinancialRecords(n); setLocalData(LOCAL_KEYS.FINANCE,n);}};
  
  const registerPayment = async (id:string, amount:number) => { 
      const rec = financialRecords.find(r=>r.id===id); 
      if(!rec) return; 
      const nAmt = Math.max(0, rec.amount - amount); 
      const st = nAmt <= 0.01 ? 'paid' : 'partial'; 
      const newHistoryItem = { date: new Date().toISOString(), amount: amount, note: 'Pagamento Realizado' };
      const hist = [...(rec.history || []), newHistoryItem]; 
      const up = {amount:nAmt, status:st as any, history:hist}; 
      if(isCloudSync){ 
          await updateDoc(doc(db,'financialRecords',id), up); 
          if(rec.type==='receivable'){
              const c=customers.find(x=>x.name===rec.entityName); 
              if(c&&c.id!=='def') await updateDoc(doc(db,'customers',c.id),{debt:Math.max(0,c.debt-amount)});
          }
      } else { 
          const n=financialRecords.map(x=>x.id===id?{...x,...up}:x); 
          setFinancialRecords(n); 
          setLocalData(LOCAL_KEYS.FINANCE,n); 
          if(rec.type==='receivable'){
              const c=customers.find(x=>x.name===rec.entityName); 
              if(c&&c.id!=='def'){
                  const nc=customers.map(x=>x.id===c.id?{...x,debt:Math.max(0,x.debt-amount)}:x); 
                  setCustomers(nc); 
                  setLocalData(LOCAL_KEYS.CUSTOMERS,nc);
              }
          }
      }
  };

  const addMessageTemplate = async (m: MessageTemplate) => { if (isCloudSync) { const { id, ...d } = m; await addDoc(collection(db, 'messages'), { ...cleanForCloud(d), ownerId: currentUser!.id }); } else { const n = { ...m, id: Date.now().toString(), ownerId: currentUser!.id }; setMessageTemplates([...messageTemplates, n]); setLocalData(LOCAL_KEYS.MESSAGES, [...messageTemplates, n]); } };
  const updateMessageTemplate = async (m: MessageTemplate) => { if (isCloudSync) { const { id, ...d } = m; await updateDoc(doc(db, 'messages', id), cleanForCloud(d)); } else { const n = messageTemplates.map(x => x.id === m.id ? m : x); setMessageTemplates(n); setLocalData(LOCAL_KEYS.MESSAGES, n); } };
  const removeMessageTemplate = async (id: string) => { if (isCloudSync) { await deleteDoc(doc(db, 'messages', id)); } else { const n = messageTemplates.filter(x => x.id !== id); setMessageTemplates(n); setLocalData(LOCAL_KEYS.MESSAGES, n); } };
  const addRaffle = async (r: Raffle) => { if (isCloudSync) { const { id, ...d } = r; await addDoc(collection(db, 'raffles'), { ...cleanForCloud(d), ownerId: currentUser!.id }); } else { const n = { ...r, id: Date.now().toString(), ownerId: currentUser!.id }; setRaffles([...raffles, n]); setLocalData(LOCAL_KEYS.RAFFLES, [...raffles, n]); } };
  
  // FIX: Update Settings with Cloud Push
  const updateSettings = async (s:CompanySettings) => { 
      setSettings(s); 
      setLocalData(LOCAL_KEYS.SETTINGS,[s]); 
      if(s.logo && s.logo.startsWith('data:')) { saveLocalImage(currentUser!.id, s.logo, 'logo'); } 
      
      // Force update to cloud if user is activating sync OR already has sync
      // This fixes the issue where enabling sync (Restaurar) would immediately be overwritten by old cloud setting
      if(currentUser && (isCloudSync || s.cloudSyncEnabled)) {
          const {id,...d}=s; 
          const q=query(collection(db,'settings'),where('ownerId','==',currentUser.id)); 
          const snap=await getDocs(q); 
          if(snap.empty){
              await addDoc(collection(db,'settings'),{...cleanForCloud(d),ownerId:currentUser.id});
          }else{
              await updateDoc(doc(db,'settings',snap.docs[0].id),cleanForCloud(d));
          }
      }
  };

  const clearLocalData = () => { setProducts([]); setCustomers([]); setSales([]); setFinancialRecords([]); setSuppliers([]); setBrands([]); setMessageTemplates([]); setRaffles([]); setLocalData(LOCAL_KEYS.PRODUCTS, []); setLocalData(LOCAL_KEYS.CUSTOMERS, []); setLocalData(LOCAL_KEYS.SALES, []); setLocalData(LOCAL_KEYS.FINANCE, []); setLocalData(LOCAL_KEYS.SUPPLIERS, []); setLocalData(LOCAL_KEYS.BRANDS, []); setLocalData(LOCAL_KEYS.MESSAGES, []); setLocalData(LOCAL_KEYS.RAFFLES, []); };
  const uploadLocalDataToCloud = async () => { if (!currentUser) return; const collections = ['products', 'customers', 'sales', 'financialRecords', 'suppliers', 'brands', 'messages', 'raffles']; for (const colName of collections) { const q = query(collection(db, colName), where('ownerId', '==', currentUser.id)); const snapshot = await getDocs(q); const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref)); await Promise.all(deletePromises); } const upload = async (col: string, data: any[]) => { const promises = data.map(item => { const { id, ...rest } = item; const cleanItem = cleanForCloud(rest); return addDoc(collection(db, col), { ...cleanItem, ownerId: currentUser.id }); }); await Promise.all(promises); }; await upload('products', products); await upload('customers', customers); await upload('sales', sales); await upload('financialRecords', financialRecords); await upload('suppliers', suppliers); await upload('brands', brands); await upload('messages', messageTemplates); await upload('raffles', raffles); const newSettings = { ...settings, cloudSyncEnabled: true }; setSettings(newSettings); const q = query(collection(db, 'settings'), where('ownerId', '==', currentUser.id)); const snap = await getDocs(q); const cleanData = cleanForCloud({ ...newSettings, ownerId: currentUser.id }); if (snap.empty) { await addDoc(collection(db, 'settings'), cleanData); } else { await updateDoc(doc(db, 'settings', snap.docs[0].id), cleanData); } };
  const saveCloudDataToLocal = () => { setLocalData(LOCAL_KEYS.PRODUCTS, products); setLocalData(LOCAL_KEYS.CUSTOMERS, customers); setLocalData(LOCAL_KEYS.SALES, sales); setLocalData(LOCAL_KEYS.FINANCE, financialRecords); setLocalData(LOCAL_KEYS.SUPPLIERS, suppliers); setLocalData(LOCAL_KEYS.BRANDS, brands); setLocalData(LOCAL_KEYS.MESSAGES, messageTemplates); setLocalData(LOCAL_KEYS.RAFFLES, raffles); const localSettings = { ...settings, cloudSyncEnabled: false }; setLocalData(LOCAL_KEYS.SETTINGS, [localSettings]); };
  const backupData = async (): Promise<string> => { if (!currentUser) throw new Error("Usuário não autenticado"); const payload = { products, customers, sales, financialRecords, suppliers, brands, settings, messageTemplates, raffles, meta: { date: new Date().toISOString(), user: currentUser.username, password: currentUser.password, version: '1.2.0' } }; return encryptDataWithCryptoJS(payload); };
  const restoreData = async (content: string, passwordInput: string): Promise<{ isCloud: boolean }> => { try { const data = decryptDataWithCryptoJS(content); if (!data || !data.products) throw new Error("Arquivo inválido"); if (data.meta && data.meta.password) { if (data.meta.password !== passwordInput) { throw new Error("A senha informada não é compatível com a senha deste backup."); } } setProducts(data.products || []); setCustomers(data.customers || []); setSales(data.sales || []); setFinancialRecords(data.financialRecords || []); setSuppliers(data.suppliers || []); setBrands(data.brands || []); setMessageTemplates(data.messageTemplates || []); setRaffles(data.raffles || []); if (data.settings) setSettings(data.settings); saveCloudDataToLocal(); return { isCloud: false }; } catch (e: any) { console.error(e); if (e.message.includes("senha informada não é compatível")) { throw e; } throw new Error(e.message || "Falha ao restaurar. Verifique o arquivo."); } };
  const login = async (u:string,p:string) => { try { const q=query(collection(db,'users'),where('username','==',u)); const s=await getDocs(q); if(s.empty) return false; const d={...s.docs[0].data(),id:s.docs[0].id} as User; try { if(d.email) await signInWithEmailAndPassword(auth,d.email,p); return true; } catch(e: any) { console.warn("Login failed via Firebase Auth."); } if(d.password===p){ updateDoc(doc(db,'users',d.id),{isOnline:true,lastLogin:new Date().toISOString()}); setCurrentUser(d); localStorage.setItem('current_session_soft',JSON.stringify(d)); return true; } return false; } catch(e) { return false; } };
  const logout = async () => { if(currentUser && currentUser.id !== 'guest_user') try{await updateDoc(doc(db,'users',currentUser.id),{isOnline:false});}catch(e){} await signOut(auth); localStorage.removeItem('current_session_soft'); if (settings.loginEnabled === false) { const guestUser: User = { id: 'guest_user', username: 'Vendedor (Visitante)', email: '', role: 'user', isOnline: true, history: [], licenseKey: 'FREE-VERSION' }; setCurrentUser(guestUser); } else { setCurrentUser(null); } };
  const registerUser = async (u:any) => { try { const res = await createUserWithEmailAndPassword(auth, u.email, u.password); const n = { id: res.user.uid, username: u.username, email: u.email, password: u.password, role: 'user' as const, isOnline: true, history: [], licenseKey: 'FREE-TRIAL', licenseExpiry: new Date(Date.now()+259200000).toISOString(), allowedCloudSync: false }; await setDoc(doc(db,'users',n.id),n); return {success:true, message:'Sucesso'}; } catch(e:any) { console.error("Registration Error:", e); if (e.code === 'auth/email-already-in-use') return {success:false, message:'Email em uso'}; return {success:false, message: e.message || 'Erro ao criar conta'}; } };
  const resetUserPassword = async (u:string,e:string,np:string) => { try{ const q=query(collection(db,'users'),where('username','==',u),where('email','==',e)); const s=await getDocs(q); if(s.empty) return {success:false,message:'Dados incorretos'}; await updateDoc(doc(db,'users',s.docs[0].id),{password:np}); return {success:true,message:'Senha alterada'}; }catch(err:any){return{success:false,message:err.message};}};
  const adminResetCooldown = async (userId: string, type: 'NAME' | 'PASSWORD' | 'EMAIL') => { if (!isAdmin) return; const updates: any = {}; if (type === 'NAME') updates.lastUsernameChange = null; if (type === 'PASSWORD') updates.lastPasswordChange = null; if (type === 'EMAIL') updates.lastEmailChange = null; await updateDoc(doc(db, 'users', userId), updates); if (currentUser?.id === userId) { setCurrentUser(prev => prev ? ({ ...prev, ...updates }) : null); } };
  const updateUserCredentials = async (type: 'username' | 'password' | 'email', verification: { u?: string, e?: string, p?: string }, newValue: string) => { return {success:false, message:'Not implemented in snippet'}; };
  const updateUsername = () => false; 
  const adminDeleteUser = async (uid:string) => { if(isAdmin) await deleteDoc(doc(db,'users',uid)); };
  
  // NEW: Manual Cloud Sync Toggle by Admin
  const adminToggleUserSync = async (userId: string, status: boolean) => {
      if(!isAdmin) return;
      await updateDoc(doc(db, 'users', userId), { allowedCloudSync: status });
  };

  const generateLicenseKey = (t:LicenseType) => { const k=`KEY-${Date.now()}`; addDoc(collection(db,'licenseKeys'),{key:k,type:t,generatedBy:currentUser?.username,createdAt:new Date().toISOString(),isUsed:false}); return k; };
  const activateLicense = (k:string, u:string) => { const l=licenseKeys.find(x=>x.key===k&&!x.isUsed); const usr=users.find(x=>x.username===u); if(!l||!usr) return {success:false, message:'Inválido'}; let expiry: string | null = null; const now = Date.now(); const day = 24 * 60 * 60 * 1000; if (l.type === 'monthly' || l.type === 'monthly_fidelity') expiry = new Date(now + 30 * day).toISOString(); else if (l.type === 'annual') expiry = new Date(now + 365 * day).toISOString(); else if (l.type === 'trial_30min') expiry = new Date(now + 30 * 60 * 1000).toISOString(); const isRenewal = usr.licenseKey && usr.licenseKey !== 'FREE-TRIAL'; const actionText = isRenewal ? "Renovação de Licença" : "Ativação de Licença"; const historyEntry = { action: actionText, date: new Date().toISOString(), details: `Chave: ${k}. Ativado pelo próprio usuário. Validade: ${expiry ? new Date(expiry).toLocaleDateString() : 'Vitalício'}` }; const newHistory = [historyEntry, ...(usr.history || [])]; updateDoc(doc(db,'licenseKeys',l.key),{isUsed:true,usedBy:u}); updateDoc(doc(db,'users',usr.id),{ licenseKey:k, licenseExpiry: expiry, history: newHistory }); logAction( isRenewal ? "License Self-Renewal" : "License Self-Activation", `User ${u} activated key ${k}`, usr.id, u ); return {success:true, message:'Ativado'}; };
  const adminGenerateAndActivate = (t:LicenseType, uid:string) => { if(!isAdmin) return {success:false, message:'Erro'}; const k=`ADM-${Date.now()}`; let expiry: string | null = null; const now = Date.now(); const day = 24 * 60 * 60 * 1000; if (t === 'monthly' || t === 'monthly_fidelity') expiry = new Date(now + 30 * day).toISOString(); else if (t === 'annual') expiry = new Date(now + 365 * day).toISOString(); else if (t === 'trial_30min') expiry = new Date(now + 30 * 60 * 1000).toISOString(); const targetUser = users.find(u => u.id === uid); if (!targetUser) return { success: false, message: 'Usuário não encontrado' }; const isRenewal = targetUser.licenseKey && targetUser.licenseKey !== 'FREE-TRIAL'; const actionText = isRenewal ? "Renovação de Licença (Admin)" : "Ativação de Licença (Admin)"; const historyEntry = { action: actionText, date: new Date().toISOString(), details: `Plano: ${t}. Ativado por Admin: ${currentUser?.username}. Validade: ${expiry ? new Date(expiry).toLocaleDateString() : 'Vitalício'}` }; const newHistory = [historyEntry, ...(targetUser.history || [])]; addDoc(collection(db,'licenseKeys'),{key:k,type:t,isUsed:true,usedBy:targetUser.username}); updateDoc(doc(db,'users',uid),{ licenseKey:k, licenseExpiry: expiry, history: newHistory }); logAction( isRenewal ? "License Renewed (Admin)" : "License Activated (Admin)", `Admin ${currentUser?.username} activated ${t} for user ${targetUser.username}`, uid, targetUser.username ); return {success:true, message:'Ativado'}; };
  
  if (!authInitialized) return <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white">Carregando Sistema...</div>;

  return (
    <StoreContext.Provider value={{
      products, customers, sales, financialRecords, suppliers, brands, settings, messageTemplates, raffles,
      currentUser, users, licenseKeys, logs, isFreeVersion, isAdmin, isCloudSync,
      addProduct, updateProduct, removeProduct, addSale, addCustomer, updateCustomer, removeCustomer, 
      addSupplier, updateSupplier, removeSupplier, addBrand, updateBrand, removeBrand,
      addFinancialRecord, updateFinancialRecord, removeFinancialRecord, removeFinancialGroup,
      registerPayment, updateSettings, backupData, restoreData, saveCloudDataToLocal,
      login, logout, registerUser, resetUserPassword, updateUserCredentials, updateUsername,
      generateLicenseKey, activateLicense, adminGenerateAndActivate, adminDeleteUser, adminResetCooldown,
      cleanupOldData, uploadLocalDataToCloud, clearLocalData,
      addMessageTemplate, updateMessageTemplate, removeMessageTemplate, addRaffle, adminToggleUserSync
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
