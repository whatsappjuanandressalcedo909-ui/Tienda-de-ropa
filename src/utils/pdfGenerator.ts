import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Customer, Sale } from '../types';
import { 
  formatCurrency, 
  getInstallmentSummary, 
  getInstallmentPaidAmount, 
  getInstallmentRemainingAmount 
} from '../utils';

interface CustomerPDFData {
  customer: Customer;
  sales: Sale[];
}

export function generateCustomerStatementPDF({ customer, sales }: CustomerPDFData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryColor = [79, 70, 229]; // Indigo #4F46E5
  const darkTextColor = [30, 41, 59]; // Slate #1E293B
  const grayTextColor = [100, 116, 139]; // Slate #64748B
  const emeraldColor = [16, 185, 129]; // Emerald #10B981
  const amberColor = [217, 119, 6]; // Amber #D97706

  const completedSales = sales.filter(s => s.status === 'completed');
  let totalSpent = 0;
  let totalPaid = 0;
  let totalPending = 0;

  interface PendingInstallmentRow {
    invoice: string;
    number: number;
    totalInstallments: number;
    dueDate: string;
    amount: number;
  }

  const pendingRows: PendingInstallmentRow[] = [];

  completedSales.forEach(sale => {
    totalSpent += sale.total;
    const summary = getInstallmentSummary(sale);
    totalPaid += summary.totalPaid;
    totalPending += summary.totalPending;

    summary.pendingList.forEach(inst => {
      pendingRows.push({
        invoice: `#${sale.id.slice(0, 6).toUpperCase()}`,
        number: inst.number,
        totalInstallments: summary.totalCount,
        dueDate: inst.dueDate ? new Date(inst.dueDate).toLocaleDateString('es-CO') : 'Inmediata',
        amount: getInstallmentRemainingAmount(inst),
      });
    });
  });

  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTADO DE CUENTA Y RESUMEN DE VENTAS', 14, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha de emisión: ${new Date().toLocaleString('es-CO')}`, 14, 21);

  // Customer Information Box
  let yPos = 36;
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN DEL CLIENTE', 14, yPos);

  yPos += 5;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, yPos, pageWidth - 28, 24, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Nombre:', 18, yPos + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${customer.firstName} ${customer.lastName}`, 36, yPos + 7);

  doc.setFont('helvetica', 'bold');
  doc.text('Correo:', 18, yPos + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(customer.email, 36, yPos + 13);

  doc.setFont('helvetica', 'bold');
  doc.text('Teléfono:', 18, yPos + 19);
  doc.setFont('helvetica', 'normal');
  doc.text(customer.phone || 'No registrado', 36, yPos + 19);

  // Status Badge on the right
  const isPazYSalvo = totalPending === 0;
  if (isPazYSalvo) {
    doc.setFillColor(209, 250, 229);
    doc.roundedRect(pageWidth - 75, yPos + 5, 55, 14, 2, 2, 'F');
    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('PAZ Y SALVO', pageWidth - 48, yPos + 13, { align: 'center' });
  } else {
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(pageWidth - 85, yPos + 5, 65, 14, 2, 2, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('CRÉDITO CON SALDO ACTIVO', pageWidth - 53, yPos + 13, { align: 'center' });
  }

  // Financial Summary Cards
  yPos += 30;
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('BALANCE FINANCIERO', 14, yPos);

  yPos += 4;
  const cardWidth = (pageWidth - 28 - 8) / 3;

  // Card 1: Total Compras
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, yPos, cardWidth, 18, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(grayTextColor[0], grayTextColor[1], grayTextColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL COMPRAS', 18, yPos + 6);
  doc.setFontSize(11);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(formatCurrency(totalSpent), 18, yPos + 13);

  // Card 2: Total Pagado
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14 + cardWidth + 4, yPos, cardWidth, 18, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL ABONADO / PAGADO', 18 + cardWidth + 4, yPos + 6);
  doc.setFontSize(11);
  doc.text(formatCurrency(totalPaid), 18 + cardWidth + 4, yPos + 13);

  // Card 3: Saldo Pendiente
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(14 + (cardWidth + 4) * 2, yPos, cardWidth, 18, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(amberColor[0], amberColor[1], amberColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('SALDO PENDIENTE CUOTAS', 18 + (cardWidth + 4) * 2, yPos + 6);
  doc.setFontSize(11);
  doc.text(formatCurrency(totalPending), 18 + (cardWidth + 4) * 2, yPos + 13);

  yPos += 26;

  // Table 1: Cuotas Pendientes
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALLE DE CUOTAS POR PAGAR', 14, yPos);

  if (pendingRows.length === 0) {
    yPos += 5;
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(14, yPos, pageWidth - 28, 12, 2, 2, 'FD');
    doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('✓ El cliente no tiene cuotas pendientes. Todas las obligaciones están al día.', 18, yPos + 8);
    yPos += 18;
  } else {
    const pendingTableData = pendingRows.map(r => [
      r.invoice,
      `Cuota ${r.number} de ${r.totalInstallments}`,
      r.dueDate,
      formatCurrency(r.amount),
      'POR PAGAR',
    ]);

    autoTable(doc, {
      startY: yPos + 4,
      head: [['Factura', 'N° Cuota', 'Vencimiento', 'Valor Cuota', 'Estado']],
      body: pendingTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [217, 119, 6],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'center', textColor: [180, 83, 9], fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY;
    yPos = (finalY || yPos + 40) + 10;
  }

  // Check if we need a new page for sales history
  if (yPos > 210) {
    doc.addPage();
    yPos = 20;
  }

  // Table 2: Historial General de Compras
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('HISTORIAL DE COMPRAS REGISTRADAS', 14, yPos);

  const salesTableData = completedSales.map(s => {
    const summ = getInstallmentSummary(s);
    const itemsCount = s.items?.reduce((a, b) => a + b.quantity, 0) || 1;
    const modalText = s.paymentMethod === 'credit' 
      ? `Crédito (${summ.paidCount}/${summ.totalCount} pagadas)` 
      : 'Contado';
    return [
      `#${s.id.slice(0, 6).toUpperCase()}`,
      new Date(s.date).toLocaleDateString('es-CO'),
      modalText,
      `${itemsCount} unidad(es)`,
      formatCurrency(s.total),
      summ.isFullyPaid ? 'Paz y Salvo' : `Pendiente: ${formatCurrency(summ.totalPending)}`,
    ];
  });

  if (salesTableData.length === 0) {
    yPos += 5;
    doc.setTextColor(grayTextColor[0], grayTextColor[1], grayTextColor[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Sin compras registradas.', 14, yPos + 6);
  } else {
    autoTable(doc, {
      startY: yPos + 4,
      head: [['Factura', 'Fecha', 'Modalidad', 'Productos', 'Total Venta', 'Estado Cuotas']],
      body: salesTableData,
      theme: 'striped',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' },
        5: { fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 282, pageWidth - 14, 282);
    doc.setFontSize(8);
    doc.setTextColor(grayTextColor[0], grayTextColor[1], grayTextColor[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Documento de control y seguimiento comercial expedido electrónicamente.',
      14,
      287
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, 287, { align: 'right' });
  }

  return doc;
}

/**
 * Downloads or shares the generated Customer Statement PDF.
 */
export async function downloadOrShareCustomerPDF(
  customer: Customer,
  sales: Sale[]
): Promise<{ shared: boolean; downloaded: boolean }> {
  const doc = generateCustomerStatementPDF({ customer, sales });
  const sanitizedName = `${customer.firstName}_${customer.lastName}`.replace(/[^a-zA-Z0-9_]/g, '');
  const fileName = `Estado_Cuenta_${sanitizedName}_${new Date().toISOString().slice(0, 10)}.pdf`;

  // Check if Web Share API with files is available
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Estado de Cuenta - ${customer.firstName} ${customer.lastName}`,
          text: `Resumen de ventas y cuotas pendientes de ${customer.firstName} ${customer.lastName}.`,
          files: [file],
        });
        return { shared: true, downloaded: false };
      }
    } catch (err: any) {
      // User cancelled share or share error; fallback to download
      if (err.name === 'AbortError') {
        return { shared: false, downloaded: false };
      }
    }
  }

  // Fallback: Direct download
  doc.save(fileName);
  return { shared: false, downloaded: true };
}

/**
 * Exports a single Sale Installment Receipt as PDF
 */
export function generateSaleReceiptPDF(sale: Sale): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200], // Thermal voucher style 80mm roll width
  });

  const summary = getInstallmentSummary(sale);
  const pageWidth = 80;

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TIRILLA DE CUOTAS', pageWidth / 2, 10, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Factura #${sale.id.slice(0, 6).toUpperCase()}`, pageWidth / 2, 15, { align: 'center' });
  doc.text(`Fecha: ${new Date(sale.date).toLocaleDateString('es-CO')}`, pageWidth / 2, 19, { align: 'center' });

  if (sale.customerName) {
    doc.text(`Cliente: ${sale.customerName}`, pageWidth / 2, 23, { align: 'center' });
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(6, 26, pageWidth - 6, 26);

  let y = 31;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL VENTA:', 6, y);
  doc.text(formatCurrency(sale.total), pageWidth - 6, y, { align: 'right' });

  y += 5;
  doc.setTextColor(16, 185, 129);
  doc.text('Total Pagado:', 6, y);
  doc.text(formatCurrency(summary.totalPaid), pageWidth - 6, y, { align: 'right' });

  y += 5;
  doc.setTextColor(217, 119, 6);
  doc.text('Saldo Por Pagar:', 6, y);
  doc.text(formatCurrency(summary.totalPending), pageWidth - 6, y, { align: 'right' });

  y += 7;
  doc.setDrawColor(200, 200, 200);
  doc.line(6, y, pageWidth - 6, y);

  y += 5;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DESGLOSE DE CUOTAS', 6, y);

  y += 4;
  summary.installments.forEach(inst => {
    const isPaid = inst.status === 'paid';
    const paid = getInstallmentPaidAmount(inst);
    const remaining = getInstallmentRemainingAmount(inst);
    const hasPartial = paid > 0 && !isPaid;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text(`Cuota ${inst.number}/${summary.totalCount}:`, 6, y);
    doc.text(formatCurrency(hasPartial ? remaining : inst.amount), pageWidth - 20, y, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    if (isPaid) {
      doc.setTextColor(16, 185, 129);
      doc.text('PAGADA', pageWidth - 6, y, { align: 'right' });
    } else if (hasPartial) {
      doc.setTextColor(217, 119, 6);
      doc.text('ABONO', pageWidth - 6, y, { align: 'right' });
    } else {
      doc.setTextColor(217, 119, 6);
      doc.text('PEND.', pageWidth - 6, y, { align: 'right' });
    }
    y += 4;
  });

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(6, y, pageWidth - 6, y);
  y += 6;
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('¡Gracias por su compra!', pageWidth / 2, y, { align: 'center' });

  return doc;
}
