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
    in_transit: 'status-in_transit',
    awaiting_boss_approval: 'status-awaiting',
    approved: 'status-approved',
    cancelled: 'status-cancelled',
    rejected: 'status-rejected',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
}

export function getStatusLabel(status) {
  const labels = {
    pending: 'Pending',
    in_transit: 'In Transit',
    awaiting_boss_approval: 'Awaiting Approval',
    approved: 'Approved',
    cancelled: 'Cancelled',
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

export function getOrderBorderColor(status) {
  const colors = {
    pending: 'border-l-amber-500',
    in_transit: 'border-l-purple-500',
    awaiting_boss_approval: 'border-l-orange-500',
    approved: 'border-l-emerald-500',
    cancelled: 'border-l-red-500',
  };
  return colors[status] || 'border-l-muted';
}
