import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusColor(status) {
  const colors = {
    pending: 'status-pending',
    completed: 'status-completed',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    approved: 'status-approved',
    rejected: 'status-rejected',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
}

export function getStatusLabel(status) {
  const labels = {
    pending: 'Pending',
    completed: 'Completed',
    cancelled: 'Cancelled',
    approved: 'Approved',
    rejected: 'Rejected',
  };
  return labels[status] || status;
}

export function getRoleLabel(role) {
  const labels = {
    boss: 'Boss (Patron)',
    customer_service: 'Customer Service',
    driver: 'Driver',
  };
  return labels[role] || role;
}

export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  const detail = error?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) return detail[0]?.msg || fallback;
  return fallback;
}

export function getOrderBorderColor(status) {
  const colors = {
    pending: 'border-l-amber-500',
    completed: 'border-l-emerald-500',
    cancelled: 'border-l-red-500',
  };
  return colors[status] || 'border-l-muted';
}

export function getOrderTypeBadge(orderType) {
  if (orderType === 'pickup') return { label: 'Pickup', className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' };
  return { label: 'Delivery', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
}
