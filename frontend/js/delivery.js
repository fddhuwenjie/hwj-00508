const deliveryModule = {
  currentPage: 1,
  pageSize: 10,
  total: 0,
  status: '',

  init() {
    this.render();
    this.loadDeliveries();
  },

  render() {
    const container = document.getElementById('module-delivery');
    container.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="toolbar-left">
            <select id="delivery-status-filter">
              <option value="">全部状态</option>
              <option value="pending">待配送</option>
              <option value="delivering">配送中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
            </select>
            <button class="btn btn-default" id="delivery-search-btn">查询</button>
          </div>
          <button class="btn btn-primary" id="create-delivery-btn">+ 创建配送单</button>
        </div>
        <div id="delivery-table-container"></div>
        <div class="pagination" id="delivery-pagination"></div>
      </div>
    `;

    document.getElementById('delivery-search-btn').addEventListener('click', () => {
      this.status = document.getElementById('delivery-status-filter').value;
      this.currentPage = 1;
      this.loadDeliveries();
    });

    document.getElementById('create-delivery-btn').addEventListener('click', () => {
      this.showCreateForm();
    });
  },

  async loadDeliveries() {
    const params = {
      page: this.currentPage,
      pageSize: this.pageSize
    };
    if (this.status) params.status = this.status;

    const res = await api.get('/delivery', params);
    if (res.success) {
      this.total = res.data.total;
      this.renderTable(res.data.list);
      this.renderPagination();
    }
  },

  renderTable(deliveries) {
    const container = document.getElementById('delivery-table-container');
    if (!container) return;

    if (deliveries.length === 0) {
      container.innerHTML = '<div class="empty">暂无配送单数据</div>';
      return;
    }

    let html = '<table><thead><tr><th>配送单ID</th><th>关联订单</th><th>配送员</th><th>联系电话</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>';
    deliveries.forEach(d => {
      html += `
        <tr>
          <td>#${d.id}</td>
          <td>${d.order_no || '-'}</td>
          <td>${d.delivery_staff_name || '-'}</td>
          <td>${d.delivery_staff_phone || '-'}</td>
          <td><span class="status-badge status-${d.status}">${statusMap[d.status] || d.status}</span></td>
          <td>${formatDate(d.created_at)}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-default" onclick="deliveryModule.viewDetail(${d.id})">详情</button>
              ${d.status === 'pending' ? `<button class="btn btn-sm btn-primary" onclick="deliveryModule.startDelivery(${d.id})">开始配送</button>` : ''}
              ${d.status === 'delivering' ? `<button class="btn btn-sm btn-success" onclick="deliveryModule.completeDelivery(${d.id})">完成配送</button>` : ''}
              ${d.status !== 'completed' && d.status !== 'failed' ? `<button class="btn btn-sm btn-danger" onclick="deliveryModule.failDelivery(${d.id})">标记失败</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  },

  renderPagination() {
    const container = document.getElementById('delivery-pagination');
    if (!container) return;

    const totalPages = Math.ceil(this.total / this.pageSize);
    let html = `
      <button onclick="deliveryModule.prevPage()" ${this.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="page-info">第 ${this.currentPage} / ${totalPages} 页，共 ${this.total} 条</span>
      <button onclick="deliveryModule.nextPage()" ${this.currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
    `;
    container.innerHTML = html;
  },

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadDeliveries();
    }
  },

  nextPage() {
    const totalPages = Math.ceil(this.total / this.pageSize);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.loadDeliveries();
    }
  },

  async showCreateForm() {
    const [ordersRes, staffRes] = await Promise.all([
      api.get('/orders', { status: 'paid', pageSize: 100 }),
      api.get('/delivery-staff', { status: 'active', pageSize: 100 })
    ]);

    let orderOptions = '<option value="">请选择订单</option>';
    if (ordersRes.success && ordersRes.data.list) {
      ordersRes.data.list.forEach(order => {
        if (order.delivery_type === 'delivery') {
          orderOptions += `<option value="${order.id}">${order.order_no} - ¥${formatMoney(order.total_amount)}</option>`;
        }
      });
    }

    let staffOptions = '<option value="">请选择配送员</option>';
    if (staffRes.success && staffRes.data.list) {
      staffRes.data.list.forEach(staff => {
        staffOptions += `<option value="${staff.id}">${staff.name} ${staff.phone ? '(' + staff.phone + ')' : ''}</option>`;
      });
    }

    const bodyContent = `
      <div class="form-group">
        <label>选择订单</label>
        <select id="create-delivery-order">${orderOptions}</select>
      </div>
      <div class="form-group">
        <label>选择配送员</label>
        <select id="create-delivery-staff">${staffOptions}</select>
      </div>
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">取消</button>
      <button class="btn btn-primary" onclick="deliveryModule.createDelivery()">创建</button>
    `;

    showModal('创建配送单', bodyContent, footerContent);
  },

  async createDelivery() {
    const orderId = document.getElementById('create-delivery-order').value;
    const staffId = document.getElementById('create-delivery-staff').value;

    if (!orderId) {
      showToast('请选择订单', 'error');
      return;
    }
    if (!staffId) {
      showToast('请选择配送员', 'error');
      return;
    }

    const res = await api.post('/delivery', {
      order_id: parseInt(orderId),
      delivery_staff_id: parseInt(staffId)
    });

    if (res.success) {
      showToast('创建配送单成功', 'success');
      hideModal();
      this.loadDeliveries();
    } else {
      showToast(res.message || '创建失败', 'error');
    }
  },

  async viewDetail(id) {
    const res = await api.get(`/delivery/${id}`);
    if (res.success) {
      this.showDetail(res.data);
    } else {
      showToast(res.message || '获取详情失败', 'error');
    }
  },

  showDetail(delivery) {
    let itemsHtml = '';
    if (delivery.items && delivery.items.length > 0) {
      itemsHtml = '<div class="order-items"><h4>商品清单</h4>';
      delivery.items.forEach(item => {
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
      <div class="form-row">
        <div class="form-group">
          <label>配送单ID</label>
          <div>#${delivery.id}</div>
        </div>
        <div class="form-group">
          <label>状态</label>
          <div><span class="status-badge status-${delivery.status}">${statusMap[delivery.status] || delivery.status}</span></div>
        </div>
      </div>
      <div class="form-group">
        <label>关联订单</label>
        <div>${delivery.order_no || '-'}</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>配送员</label>
          <div>${delivery.delivery_staff_name || '-'}</div>
        </div>
        <div class="form-group">
          <label>联系电话</label>
          <div>${delivery.delivery_staff_phone || '-'}</div>
        </div>
      </div>
      <div class="form-group">
        <label>配送地址</label>
        <div>${delivery.address || '-'}</div>
      </div>
      <div class="form-group">
        <label>订单金额</label>
        <div>¥${formatMoney(delivery.total_amount)}</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>开始时间</label>
          <div>${formatDate(delivery.start_time)}</div>
        </div>
        <div class="form-group">
          <label>结束时间</label>
          <div>${formatDate(delivery.end_time)}</div>
        </div>
      </div>
      ${delivery.remark ? `
      <div class="form-group">
        <label>备注</label>
        <div>${delivery.remark}</div>
      </div>
      ` : ''}
      ${itemsHtml}
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">关闭</button>
      ${delivery.status === 'pending' ? `<button class="btn btn-primary" onclick="deliveryModule.startDelivery(${delivery.id})">开始配送</button>` : ''}
      ${delivery.status === 'delivering' ? `<button class="btn btn-success" onclick="deliveryModule.completeDelivery(${delivery.id})">完成配送</button>` : ''}
    `;

    showModal('配送单详情', bodyContent, footerContent);
  },

  async startDelivery(id) {
    if (!confirm('确定要开始配送吗？')) return;

    const res = await api.put(`/delivery/${id}/start`);
    if (res.success) {
      showToast('开始配送', 'success');
      hideModal();
      this.loadDeliveries();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  async completeDelivery(id) {
    if (!confirm('确定要完成配送吗？')) return;

    const res = await api.put(`/delivery/${id}/complete`);
    if (res.success) {
      showToast('配送完成', 'success');
      hideModal();
      this.loadDeliveries();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  failDelivery(id) {
    const bodyContent = `
      <div class="form-group">
        <label>失败原因</label>
        <textarea id="fail-remark" rows="3" placeholder="请输入失败原因"></textarea>
      </div>
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">取消</button>
      <button class="btn btn-danger" onclick="deliveryModule.confirmFail(${id})">确认标记失败</button>
    `;

    showModal('标记配送失败', bodyContent, footerContent);
  },

  async confirmFail(id) {
    const remark = document.getElementById('fail-remark').value.trim();

    const res = await api.put(`/delivery/${id}/fail`, { remark });
    if (res.success) {
      showToast('已标记为失败', 'success');
      hideModal();
      this.loadDeliveries();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  }
};
