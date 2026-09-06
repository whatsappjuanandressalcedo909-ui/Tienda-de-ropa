import { Product, Category, Size, Sale, Installment } from './types';

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const generateId = () => {
  return Math.random().toString(36).substring(2, 9);
};

/**
 * Calculates total paid amount for an installment (handles partial payments and backwards compatibility)
 */
export function getInstallmentPaidAmount(inst: Installment): number {
  if (inst.status === 'paid') {
    return inst.paidAmount !== undefined ? inst.paidAmount : inst.amount;
  }
  return inst.paidAmount || 0;
}

/**
 * Calculates remaining balance on an installment
 */
export function getInstallmentRemainingAmount(inst: Installment): number {
  if (inst.status === 'paid') {
    return 0;
  }
  const paid = getInstallmentPaidAmount(inst);
  return Math.max(0, +(inst.amount - paid).toFixed(2));
}

export function getSaleInstallments(sale: Sale): Installment[] {
  if (sale.installmentList && sale.installmentList.length > 0) {
    return sale.installmentList;
  }

  const count = Math.max(1, sale.installments || 1);
  const per = Math.floor((sale.total / count) * 100) / 100;
  let acc = 0;
  const bDate = new Date(sale.date || Date.now());
  const list: Installment[] = [];

  for (let i = 1; i <= count; i++) {
    const dDate = new Date(bDate);
    dDate.setMonth(dDate.getMonth() + (i - 1));
    const amt = i === count ? +(sale.total - acc).toFixed(2) : per;
    acc += amt;
    const isPaid = sale.paymentMethod === 'total';
    list.push({
      number: i,
      amount: amt,
      dueDate: dDate.toISOString(),
      status: isPaid ? 'paid' : 'pending',
      paidDate: isPaid ? sale.date : undefined,
      paidAmount: isPaid ? amt : 0,
    });
  }

  return list;
}

export function getInstallmentSummary(sale: Sale) {
  const installments = getSaleInstallments(sale);
  let totalPaid = 0;
  let totalPending = 0;
  const paidList: Installment[] = [];
  const pendingList: Installment[] = [];

  installments.forEach(inst => {
    const paid = getInstallmentPaidAmount(inst);
    const pending = getInstallmentRemainingAmount(inst);
    totalPaid += paid;
    totalPending += pending;

    if (inst.status === 'paid' || pending <= 0.01) {
      paidList.push(inst);
    } else {
      pendingList.push(inst);
    }
  });

  const isFullyPaid = totalPending <= 0.01;

  return {
    installments,
    paidList,
    pendingList,
    totalPaid,
    totalPending,
    isFullyPaid,
    paidCount: paidList.length,
    pendingCount: pendingList.length,
    totalCount: installments.length,
  };
}

/**
 * Returns detailed due date status (overdue, today, this week, days difference)
 */
export function getDueDateDetails(dueDateStr?: string) {
  const now = new Date();
  // Strip time for exact date comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let due = dueDateStr ? new Date(dueDateStr) : new Date();
  if (isNaN(due.getTime())) {
    due = new Date();
  }
  const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.round((dueDateOnly.getTime() - today.getTime()) / msPerDay);

  const isOverdue = diffDays < 0;
  const isToday = diffDays === 0;
  const isTomorrow = diffDays === 1;
  const isThisWeek = diffDays >= 0 && diffDays <= 7;

  let statusLabel = '';
  if (isToday) {
    statusLabel = 'Vence hoy';
  } else if (isTomorrow) {
    statusLabel = 'Vence mañana';
  } else if (diffDays > 1 && diffDays <= 7) {
    statusLabel = `Vence en ${diffDays} días`;
  } else if (diffDays > 7) {
    statusLabel = `Vence en ${diffDays} días`;
  } else if (diffDays === -1) {
    statusLabel = 'Venció ayer';
  } else {
    statusLabel = `Venció hace ${Math.abs(diffDays)} días`;
  }

  // Friendly date formatting with day of week in Spanish
  const daysOfWeek = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const dayIndex = isNaN(due.getDay()) ? 0 : due.getDay();
  const monthIndex = isNaN(due.getMonth()) ? 0 : due.getMonth();
  const dayOfWeek = daysOfWeek[dayIndex] || '';
  const dayOfMonth = isNaN(due.getDate()) ? 1 : due.getDate();
  const monthName = months[monthIndex] || '';

  let friendlyText = '';
  if (isToday) {
    friendlyText = 'el día de hoy';
  } else if (isTomorrow) {
    friendlyText = 'mañana';
  } else if (isOverdue) {
    friendlyText = `el pasado ${dayOfWeek} ${dayOfMonth} de ${monthName}`;
  } else if (diffDays <= 7) {
    friendlyText = `este ${dayOfWeek} ${dayOfMonth} de ${monthName}`;
  } else {
    friendlyText = `el ${dayOfWeek} ${dayOfMonth} de ${monthName}`;
  }

  const shortFormattedDate = `${dayOfMonth} ${monthName.slice(0, 3)} ${due.getFullYear()}`;

  return {
    diffDays,
    isOverdue,
    isToday,
    isTomorrow,
    isThisWeek,
    statusLabel,
    friendlyText,
    shortFormattedDate,
    rawDate: due,
  };
}

/**
 * Builds direct WhatsApp reminder message matching user specification:
 * 'Hola [Cliente], te recordamos que tu cuota de $[Valor] vence el [Fecha]. Saldo restante: $[Saldo]'
 */
export function createWhatsAppReminderMessage({
  customerName,
  installmentAmount,
  dueDateStr,
  saldoRestante,
  totalPendingDebt,
  installmentRemaining,
}: {
  customerName?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  installmentAmount: number;
  paidAmount?: number;
  installmentRemaining?: number;
  totalPendingDebt?: number;
  dueDateStr?: string;
  saldoRestante?: number;
  storeName?: string;
}): string {
  const name = customerName && customerName.trim() ? customerName.trim() : 'Cliente';

  // Format date [Fecha], e.g. 15/09/2026
  let formattedDate = 'la fecha límite';
  if (dueDateStr) {
    const trimmed = dueDateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.split('T')[0].split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } else {
      const due = new Date(trimmed);
      if (!isNaN(due.getTime())) {
        const day = String(due.getDate()).padStart(2, '0');
        const month = String(due.getMonth() + 1).padStart(2, '0');
        const year = due.getFullYear();
        formattedDate = `${day}/${month}/${year}`;
      } else {
        formattedDate = dueDateStr;
      }
    }
  }

  // Determine Saldo restante
  const balance = saldoRestante !== undefined
    ? saldoRestante
    : (totalPendingDebt !== undefined && totalPendingDebt > 0
        ? totalPendingDebt
        : (installmentRemaining !== undefined && installmentRemaining > 0
            ? installmentRemaining
            : installmentAmount));

  return `Hola ${name}, te recordamos que tu cuota de ${formatCurrency(installmentAmount)} vence el ${formattedDate}. Saldo restante: ${formatCurrency(balance)}`;
}

/**
 * Builds direct WhatsApp link URL with the pre-filled reminder message
 */
export function getWhatsAppReminderUrl(params: {
  phone?: string;
  customerName?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  installmentAmount: number;
  paidAmount?: number;
  installmentRemaining?: number;
  totalPendingDebt?: number;
  dueDateStr?: string;
  saldoRestante?: number;
  storeName?: string;
}): string {
  const message = createWhatsAppReminderMessage(params);
  const cleanPhone = params.phone?.replace(/\D/g, '');
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}
