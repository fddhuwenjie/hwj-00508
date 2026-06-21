const ordersModule = {
  currentPage: 1,
  pageSize: 10,
  total: 0,
  status: '',
  pickupDate: '',
  userId: '',

  init() {
    this.render();
    this.loadOrders();
  },

  render() {
    const container = document.getElementById('module-orders');
    container.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="toolbar-left">
            <select id="order-status-filter">
              <option value="">全部状态</option>
              <option value="pending_payment">待支付</option>
              <option value="paid">已支付</option>
              <option value="pending_sorting">待分拣</option>
              <option value="pending_pickup">待提货</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
              <option value="refunded">已退款</option>
            </select>
            <input type="date" id="order-pickup-date-filter" placeholder="提货日期">
            <button class="btn btn-default" id="order-search-btn">查询</button>
          </div>
        </div>
        <div id="orders-table-container"></div>
        <div class="pagination" id="orders-pagination"></div>
      </div>
    `;

    document.getElementById('order-search-btn').addEventListener('click', () => {
      this.status = document.getElementById('order-status-filter').value;
      this.pickupDate = document.getElementById('order-pickup-date-filter').value;
      this.currentPage = 1;
      this.loadOrders();
    });
  },

  async loadOrders() {
    const params = {
      page: this.currentPage,
      pageSize: this.pageSize
    };
    if (this.status) params.status = this.status;
    if (this.pickupDate) params.pickup_date = this.pickupDate;
    if (this.userId) params.user_id = this.userId;

    const res = await api.get('/orders', params);
    if (res.success) {
      this.total = res.data.total;
      this.renderTable(res.data.list);
      this.renderPagination();
    }
  },

  renderTable(orders) {
    const container = document.getElementById('orders-table-container');
    if (!container) return;

    if (orders.length === 0) {
      container.innerHTML = '<div class="empty">暂无订单数据</div>';
      return;
    }

    let html = '<table><thead><tr><th>订单号</th><th>配送方式</th><th>金额</th><th>状态</th><th>提货日期</th><th>创建时间</th><th>操作</th></tr></thead><tbody>';
    orders.forEach(order => {
      html += `
        <tr>
          <td>${order.order_no}</td>
          <td>${deliveryTypeMap[order.delivery_type] || order.delivery_type}</td>
          <td>¥${formatMoney(order.total_amount)}</td>
          <td><span class="status-badge status-${order.status}">${statusMap[order.status] || order.status}</span></td>
          <td>${order.pickup_date || '-'}</td>
          <td>${formatDate(order.created_at)}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-default" onclick="ordersModule.viewOrder(${order.id})">详情</button>
              ${order.status === 'pending_payment' ? `<button class="btn btn-sm btn-success" onclick="ordersModule.payOrder(${order.id})">支付</button>` : ''}
              ${order.status !== 'cancelled' && order.status !== 'completed' && order.status !== 'refunded' ? `<button class="btn btn-sm btn-warning" onclick="ordersModule.cancelOrder(${order.id})">取消</button>` : ''}
              ${order.status === 'pending_pickup' && order.delivery_type === 'pickup' ? `<button class="btn btn-sm btn-primary" onclick="ordersModule.showPickupVerify(${order.id})">核销</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  },

  renderPagination() {
    const container = document.getElementById('orders-pagination');
    if (!container) return;

    const totalPages = Math.ceil(this.total / this.pageSize);
    let html = `
      <button onclick="ordersModule.prevPage()" ${this.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="page-info">第 ${this.currentPage} / ${totalPages} 页，共 ${this.total} 条</span>
      <button onclick="ordersModule.nextPage()" ${this.currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
    `;
    container.innerHTML = html;
  },

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadOrders();
    }
  },

  nextPage() {
    const totalPages = Math.ceil(this.total / this.pageSize);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.loadOrders();
    }
  },

  async viewOrder(id) {
    const res = await api.get(`/orders/${id}`);
    if (res.success) {
      this.showOrderDetail(res.data);
    } else {
      showToast(res.message || '获取订单详情失败', 'error');
    }
  },

  showOrderDetail(order) {
    let itemsHtml = '';
    if (order.items && order.items.length > 0) {
      itemsHtml = '<div class="order-items"><h4>商品清单</h4>';
      order.items.forEach(item => {
        itemsHtml += `
          <div class="order-item">
            <span>${item.product_name} ${item.specification ? '(' + item.specification + ')' : ''} x ${item.quantity}</span>
            <span>¥${formatMoney(item.subtotal)}</span>
          </div>
        `;
      });
      itemsHtml += '</div>';
    }

    const bodyContent = `
      <div class="form-group">
        <label>订单号</label>
        <div>${order.order_no}</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>订单状态</label>
          <div><span class="status-badge status-${order.status}">${statusMap[order.status] || order.status}</span></div>
        </div>
        <div class="form-group">
          <label>配送方式</label>
          <div>${deliveryTypeMap[order.delivery_type] || order.delivery_type}</div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>用户</label>
          <div>${order.nickname || order.username || '-'}</div>
        </div>
        <div class="form-group">
          <label>联系电话</label>
          <div>${order.user_phone || '-'}</div>
        </div>
      </div>
      <div class="form-group">
        <label>订单金额</label>
        <div>¥${formatMoney(order.total_amount)}</div>
      </div>
      ${order.refund_amount ? `
      <div class="form-group">
        <label>已退款金额</label>
        <div style="color: #e74c3c;">¥${formatMoney(order.refund_amount)}</div>
      </div>
      ` : ''}
      <div class="form-row">
        <div class="form-group">
          <label>提货日期</label>
          <div>${order.pickup_date || '-'}</div>
        </div>
        <div class="form-group">
          <label>自提点</label>
          <div>${order.pickup_point_id || '-'}</div>
        </div>
      </div>
      ${order.pickup_code ? `
      <div class="form-group">
        <label>核销码</label>
        <div class="pickup-code">${order.pickup_code}</div>
      </div>
      ` : ''}
      <div class="form-group">
        <label>备注</label>
        <div>${order.remark || '-'}</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>创建时间</label>
          <div>${formatDate(order.created_at)}</div>
        </div>
        <div class="form-group">
          <label>支付时间</label>
          <div>${formatDate(order.paid_at)}</div>
        </div>
      </div>
      ${itemsHtml}
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">关闭</button>
    `;

    showModal('订单详情', bodyContent, footerContent);
  },

  async payOrder(id) {
    if (!confirm('确定要支付该订单吗？')) return;

    const res = await api.put(`/orders/${id}/pay`);
    if (res.success) {
      showToast('支付成功', 'success');
      this.loadOrders();
    } else {
      showToast(res.message || '支付失败', 'error');
    }
  },

  async cancelOrder(id) {
    if (!confirm('确定要取消该订单吗？')) return;

    const res = await api.put(`/orders/${id}/cancel`);
    if (res.success) {
      showToast('取消成功', 'success');
      this.loadOrders();
    } else {
      showToast(res.message || '取消失败', 'error');
    }
  },

  showPickupVerify(orderId) {
    const bodyContent = `
      <div class="form-group">
        <label>请输入核销码</label>
        <input type="text" id="pickup-verify-code" placeholder="请输入6位核销码" maxlength="6">
      </div>
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">取消</button>
      <button class="btn btn-primary" onclick="ordersModule.verifyPickup(${orderId})">确认核销</button>
    `;

    showModal('自提核销', bodyContent, footerContent);
  },

  async verifyPickup(orderId) {
    const code = document.getElementById('pickup-verify-code').value.trim();
    if (!code) {
      showToast('请输入核销码', 'error');
      return;
    }

    const res = await api.get(`/orders/${orderId}/pickup-verify`, { pickup_code: code });
    if (res.success) {
      showToast('核销成功', 'success');
      hideModal();
      this.loadOrders();
    } else {
      showToast(res.message || '核销失败', 'error');
    }
  },

  async updateStatus(id, status) {
    const res = await api.put(`/orders/${id}/status`, { status });
    if (res.success) {
      showToast('状态更新成功', 'success');
      this.loadOrders();
    } else {
      showToast(res.message || '更新失败', 'error');
    }
  }
};
