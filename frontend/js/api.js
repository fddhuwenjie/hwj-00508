const API_BASE = 'http://localhost:8508/api';

const api = {
  async get(url, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${API_BASE}${url}?${queryString}` : `${API_BASE}${url}`;
    const res = await fetch(fullUrl);
    return res.json();
  },

  async post(url, data = {}) {
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async put(url, data = {}) {
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async delete(url) {
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'DELETE'
    });
    return res.json();
  }
};

const statusMap = {
  pending_payment: '待支付',
  paid: '已支付',
  cancelled: '已取消',
  pending_sorting: '待分拣',
  pending_pickup: '待提货',
  completed: '已完成',
  refunded: '已退款',
  pending: '待处理',
  delivering: '配送中',
  failed: '失败',
  approved: '已通过',
  rejected: '已拒绝',
  on: '上架中',
  off: '已下架',
  active: '启用',
  inactive: '停用'
};

const aftersaleTypeMap = {
  shortage: '缺货',
  quality: '质量问题',
  wrong: '错发',
  other: '其他'
};

const deliveryTypeMap = {
  pickup: '自提',
  delivery: '配送'
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatMoney(amount) {
  if (amount === null || amount === undefined) return '0.00';
  return parseFloat(amount).toFixed(2);
}

function showModal(title, bodyContent, footerContent = '') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyContent;
  document.getElementById('modal-footer').innerHTML = footerContent;
  document.getElementById('modal').classList.add('show');
}

function hideModal() {
  document.getElementById('modal').classList.remove('show');
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#f39c12'};
    color: #fff;
    border-radius: 4px;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

document.getElementById('modal-close').addEventListener('click', hideModal);
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') hideModal();
});
