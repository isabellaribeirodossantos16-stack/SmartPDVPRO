
import { Sale, CompanySettings, Customer, FinancialRecord, PaymentMethod } from "../types";
// @ts-ignore
import html2canvas from "html2canvas";

export const generateReceiptContent = (sale: Sale, settings: CompanySettings, customer?: Customer, financialRecords?: FinancialRecord[]) => {
  const width = settings.printerConfig.paperWidth === '58mm' ? '58mm' : '80mm';
  const dateObj = new Date(sale.date);
  const dateStr = dateObj.toLocaleDateString('pt-BR');
  const timeStr = dateObj.toLocaleTimeString('pt-BR');
  
  const totalItems = sale.items.reduce((acc, item) => acc + item.quantity, 0);

  // Determine Customer Name to Display
  let customerName = 'Venda Avulsa';
  let customerCpf = '';
  
  if (customer && customer.id !== 'def') {
      customerName = customer.name;
      customerCpf = customer.cpf ? `<div><strong>CPF:</strong> ${customer.cpf}</div>` : '';
  }

  // Clone and sort records to match payments in order (Oldest due date first)
  // This helps when multiple installments have same amount but different dates
  let availableRecords = financialRecords 
      ? [...financialRecords].filter(r => r.documentNumber === sale.id || r.description.includes(`Venda #${sale.id}`)).sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()) 
      : [];

  // Helper to generate row text
  const getPaymentRowInfo = (payment: any, index: number) => {
      let methodText = payment.method.toString();
      if (payment.method === 'A Prazo') {
          if (payment.totalInstallments && payment.totalInstallments > 1) {
              methodText = `A Prazo (${payment.installmentNumber}/${payment.totalInstallments})`;
          } else {
              methodText = `A Prazo`;
          }
      }

      // If NOT "A Prazo", it is considered paid at the moment of sale
      if (payment.method !== 'A Prazo') {
          return {
              text: `${methodText} - Pago - ${dateStr}`,
              amount: payment.amount
          };
      }

      // FIND MATCHING FINANCIAL RECORD
      // We look for a record with similar amount and matching due date (if present)
      // If payment has no due date (legacy), we take the first available record with matching amount
      const pDate = payment.dueDate ? new Date(payment.dueDate).toISOString().split('T')[0] : null;
      
      const recordIndex = availableRecords.findIndex(r => {
          const rDate = new Date(r.dueDate).toISOString().split('T')[0];
          // Tolerance for float precision issues
          const amtMatch = Math.abs(r.originalAmount - payment.amount) < 0.05;
          
          if (pDate) {
              return amtMatch && rDate === pDate;
          }
          return amtMatch;
      });

      let statusSuffix = "";

      if (recordIndex !== -1) {
          const match = availableRecords[recordIndex];
          // Remove from pool so next payment doesn't grab it
          availableRecords.splice(recordIndex, 1);

          const dueDateObj = new Date(match.dueDate);
          const dueDateStr = dueDateObj.toLocaleDateString('pt-BR');
          const today = new Date();
          today.setHours(0,0,0,0);
          dueDateObj.setHours(0,0,0,0);

          if (match.status === 'paid') {
              // Try to find payment date in history
              let payDate = dueDateStr; // Default if history missing
              if (match.history && match.history.length > 0) {
                  payDate = new Date(match.history[match.history.length - 1].date).toLocaleDateString('pt-BR');
              }
              statusSuffix = ` - Pago - ${payDate}`;
          } else {
              // Calculate Days Difference
              const diffTime = dueDateObj.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              if (diffDays < 0) {
                  statusSuffix = ` - Vencido - ${dueDateStr}`;
              } else if (diffDays === 0) {
                  statusSuffix = ` - Vencendo Hoje`;
              } else if (diffDays === 1) {
                  statusSuffix = ` - Vence Amanhã`;
              } else {
                  statusSuffix = ` - Vence - ${dueDateStr}`;
              }
          }
      } else {
          // If no record found, but it is A Prazo, show N/A or just the label
          statusSuffix = ""; 
      }

      return {
          text: `${methodText}${statusSuffix}`,
          amount: payment.amount
      };
  };

  // Parse Payments for display
  const paymentRows = sale.payments.map((p, idx) => {
    const info = getPaymentRowInfo(p, idx);
    return `
      <div style="margin-bottom: 3px; border-bottom: 1px dotted #eee; padding-bottom: 2px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
            <span style="flex: 1; padding-right: 5px;">${info.text}</span>
            <span style="white-space: nowrap; margin-left: 8px;">R$ ${info.amount.toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div id="receipt-content" style="width: ${width}; font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.2; color: #000; background: #fff; padding: 10px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 10px;">
        <h2 style="font-size: 14px; font-weight: bold; margin: 0;">${settings.name}</h2>
        ${settings.cnpj ? `<div>CNPJ: ${settings.cnpj}</div>` : ''}
        ${settings.phone ? `<div>Tel: ${settings.phone}</div>` : ''}
        <div style="margin-top: 5px;">${dateStr} - ${timeStr}</div>
      </div>

      <div style="border-bottom: 1px dashed #000; margin-bottom: 5px;"></div>
      
      <div style="margin-bottom: 5px;">
        <div><strong>Cliente:</strong> ${customerName}</div>
        ${customerCpf}
      </div>

      <div style="border-bottom: 1px dashed #000; margin-bottom: 5px;"></div>

      <div style="margin-bottom: 5px;">
        <div style="display: flex; font-weight: bold; margin-bottom: 2px;">
           <span style="flex: 1;">Item</span>
           <span style="width: 30px; text-align: center;">Qtd</span>
           <span style="width: 60px; text-align: right;">Vl.Tot</span>
        </div>
        ${sale.items.map(item => `
          <div style="display: flex; margin-bottom: 2px;">
            <span style="flex: 1;">${item.name}</span>
            <span style="width: 30px; text-align: center;">${item.quantity}</span>
            <span style="width: 60px; text-align: right;">${(item.price * item.quantity).toFixed(2)}</span>
          </div>
          <div style="font-size: 9px; color: #555;">(Unit: R$ ${item.price.toFixed(2)})</div>
        `).join('')}
      </div>

      <div style="border-bottom: 1px dashed #000; margin: 5px 0;"></div>

      <div style="display: flex; justify-between;">
        <strong>Qtd. Total Itens:</strong>
        <strong>${totalItems}</strong>
      </div>
      <div style="display: flex; justify-between; font-size: 14px; margin-top: 5px;">
        <strong>TOTAL:</strong>
        <strong>R$ ${sale.total.toFixed(2)}</strong>
      </div>

      <div style="border-bottom: 1px dashed #000; margin: 5px 0;"></div>

      <div style="margin-bottom: 10px;">
        <div style="font-weight: bold; margin-bottom: 4px;">Formas de Pagamento:</div>
        ${paymentRows}
      </div>

      <div style="text-align: center; margin-top: 15px; font-size: 10px;">
        <div>Agradecemos a preferência!</div>
        <div style="font-weight: bold; margin-top: 2px;">${settings.name}</div>
      </div>
    </div>
  `;
};

// Prints content using a New Window to force print dialog
export const printHtml = (htmlContent: string) => {
    // Center popup logic
    const width = 450;
    const height = 600;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    const printWindow = window.open('', '_blank', `width=${width},height=${height},top=${top},left=${left},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`);
    
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Imprimir Cupom</title>
                    <style>
                        body { margin: 0; padding: 0; background-color: #fff; font-family: monospace; }
                        @media print {
                            @page { margin: 0; size: auto; }
                            body { margin: 0; -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    ${htmlContent}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.focus();
                                window.print();
                            }, 500);
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
    } else {
        // Fallback: Use iframe if popup is blocked
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        
        document.body.appendChild(iframe);
        
        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(`<html><head><title>Print</title></head><body>${htmlContent}</body></html>`);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                setTimeout(() => document.body.removeChild(iframe), 2000);
            }, 500);
        } else {
            alert("Abertura de janela bloqueada. Permita pop-ups para imprimir.");
        }
    }
};

export const printReceipt = (sale: Sale, settings: CompanySettings, customer?: Customer, financialRecords?: FinancialRecord[]) => {
  const content = generateReceiptContent(sale, settings, customer, financialRecords);
  printHtml(content);
};

export const saveReceiptAsImage = async (sale: Sale, settings: CompanySettings, customer?: Customer, financialRecords?: FinancialRecord[]) => {
  // Create a hidden container to render the receipt
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.innerHTML = generateReceiptContent(sale, settings, customer, financialRecords);
  document.body.appendChild(container);

  const element = container.querySelector('#receipt-content') as HTMLElement;
  
  try {
    const canvas = await html2canvas(element, {
        scale: 2, // Better quality
        backgroundColor: '#ffffff'
    });
    
    const image = canvas.toDataURL("image/png");
    const link = document.createElement('a');
    link.href = image;
    link.download = `cupom_venda_${sale.id}.png`;
    link.click();
  } catch (error) {
    console.error("Erro ao gerar imagem do cupom", error);
    alert("Erro ao salvar imagem.");
  } finally {
    document.body.removeChild(container);
  }
};
