
export enum PaymentMethod {
  CASH = 'Dinheiro',
  PIX = 'Pix',
  DEBIT = 'Débito',
  CREDIT = 'Crédito',
  TERM = 'A Prazo',
  MIXED = 'Múltiplos'
}

export interface SalePayment {
  method: PaymentMethod;
  amount: number;
  dueDate?: string; 
  installments?: number; 
  installmentNumber?: number; 
  totalInstallments?: number; 
}

export interface Customer {
  id: string;
  ownerId?: string; // Firebase Isolation
  name: string;
  cpf?: string; 
  phone: string;
  email: string;
  debt: number;
  birthDate?: string; 
  registrationDate?: string; // NEW: Data de Cadastro Imutável
  street?: string;
  number?: string;
  apartment?: string;
  city?: string;
  state?: string;
}

export interface Brand {
  id: string;
  ownerId?: string; // Firebase Isolation
  name: string;
}

export interface Supplier {
  id: string;
  ownerId?: string; // Firebase Isolation
  name: string;
  contact: string;
}

export interface Product {
  id: string;
  ownerId?: string; // Firebase Isolation
  code: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  category: string;
  brand: string; 
  supplierId?: string;
  image?: string;
  validityDays?: number; // Added for Plans
}

export interface CartItem extends Product {
  quantity: number;
  discount: number; 
}

export interface Sale {
  id: string;
  ownerId?: string; // Firebase Isolation
  customerId: string | null; 
  items: CartItem[];
  total: number;
  discountTotal: number;
  paymentMethod: string; 
  payments: SalePayment[]; 
  date: string;
  status: 'completed' | 'pending';
  planExpirationDate?: string; // NEW: Stores the calculated expiration date for Plans
}

export interface PaymentHistory {
  date: string;
  amount: number;
  note?: string;
}

export interface FinancialRecord {
  id: string;
  ownerId?: string; // Firebase Isolation
  documentNumber?: string; // ID de Registro (Agrupamento de Conta)
  description: string;
  amount: number; 
  originalAmount: number; 
  type: 'receivable' | 'payable';
  dueDate: string;
  status: 'paid' | 'pending' | 'partial';
  entityName: string; 
  history: PaymentHistory[];
}

export interface DashboardWidgetConfig {
  enabled: boolean;
  range: number; 
}

export interface SidebarConfig {
  backgroundColor: string;
  textColor: string;
  activeItemColor?: string; // Nova propriedade para cor do botão ativo
}

export interface DataRetentionConfig {
  revenues: number; // Months to keep (0 = forever)
  payables: number; // Months to keep (0 = forever)
  sales: number;    // Months to keep (0 = forever)
}

// NEW: Dynamic Plan Configuration
export interface PlanConfig {
  key: string; // 'monthly_basic', 'annual_eco', 'lifetime', 'fidelity'
  name: string;
  price: string;
  isVisible: boolean;
  features: string[];
}

export interface CompanySettings {
  id?: string; // Firestore ID
  ownerId?: string; // Firebase Isolation
  name: string;
  cnpj: string;
  stateRegistration: string;
  phone?: string; 
  address: string;
  pixKey: string;
  whatsappMessageTemplate: string;
  logo?: string;
  loginEnabled?: boolean; // NEW: Controls if login screen is skipped
  
  dashboardWidgets: {
    sales: DashboardWidgetConfig;
    receivables: DashboardWidgetConfig;
    payables: DashboardWidgetConfig;
    alerts: DashboardWidgetConfig;
    birthdays: DashboardWidgetConfig;
    lists: boolean; 
  };
  printerConfig: {
    enabled: boolean;
    autoPrint: boolean;
    paperWidth: '58mm' | '80mm';
    printerName?: string;
  };
  licenseKey?: string;
  sidebarConfig?: SidebarConfig;
  backupRestorationCount?: number; // Contador de restaurações para segurança
  cloudSyncEnabled?: boolean; // NEW: Controls if data sync is active (requires specific plan)
  dataRetention?: DataRetentionConfig; // NEW: Auto-deletion settings
  customPlans?: PlanConfig[]; // NEW: Customizable plans list
}

// --- NOVOS TIPOS PARA AUTENTICAÇÃO E LICENÇAS ---

export type UserRole = 'admin' | 'user';

// Added 'monthly_fidelity'
export type LicenseType = 'trial_30min' | 'monthly' | 'monthly_fidelity' | 'annual' | 'lifetime';

export interface LicenseKey {
  key: string;
  type: LicenseType;
  generatedBy: string; // Username do admin
  createdAt: string;
  isUsed: boolean;
  usedBy?: string; // Username de quem usou
  usedAt?: string;
  yearUsed?: number; // Para validação de uso único por ano
}

export interface UserSession {
  loginTime: string;
  ip?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password?: string; // Restored for Soft Auth fallback
  role: UserRole;
  licenseKey?: string;
  licenseExpiry?: string | null; // Null se vitalício ou expirado
  lastLicenseActivation?: string; // Timestamp ISO da última ativação para cooldown
  isOnline: boolean;
  lastLogin?: string;
  
  // Security Cooldown Fields
  lastUsernameChange?: string | null; // ISO Date
  lastPasswordChange?: string | null; // ISO Date
  lastEmailChange?: string | null; // ISO Date

  // NEW: Admin Override for Cloud Sync
  allowedCloudSync?: boolean; 

  history: {
    action: string;
    date: string;
    details?: string;
  }[];
}

export interface AppLog {
    id: string;
    ownerId?: string; // Firebase Isolation
    userId: string;
    username: string;
    action: string;
    details: string;
    timestamp: string;
}

// NEW: Message Template Interface
export interface MessageTemplate {
    id: string;
    ownerId?: string;
    title: string;
    category: string;
    content: string; // The description/body of the message
}

// NEW: Raffle Interface
export interface RaffleWinner {
    position: number;
    text: string;
}

export interface Raffle {
    id: string;
    ownerId?: string;
    type: 'clients' | 'numbers' | 'names';
    title?: string; // NEW: Custom Title (e.g., "Dia dos Pais")
    date: string;
    winner?: string; // Deprecated but kept for compatibility
    winners?: RaffleWinner[]; // NEW: Array of winners
    details?: string; // e.g., "Total participants: 50" or "Range: 1-100"
}
