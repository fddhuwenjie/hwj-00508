const aftersaleModule = {
  currentPage: 1,
  pageSize: 10,
  total: 0,
  status: '',
  type: '',

  init() {
    this.render();
    this.loadAftersales();
  },

  render() {
    const container = document.getElementById('module-aftersale');
    container.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="toolbar-left">
            <select id="aftersale-status-filter">
              <option value="">全部状态</option>
              <option value="pending">待处理</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
            </select>
            <select id="aftersale-type-filter">
              <option value="">全部类型</option>
              <option value="shortage">缺货</option>
              <option value="quality">质量问题</option>
              <option value="wrong">错发</option>
              <option value="other">其他</option>
            </select>
            <button class="btn btn-default" id="aftersale-search-btn">查询</button>
          </div>
          <button class="btn btn-primary" id="add-aftersale-btn">+ 新增售后</button>
        </div>
        <div id="aftersale-table-container"></div>
        <div class="pagination" id="aftersale-pagination"></div>
      </div>
    `;

    document.getElementById('aftersale-search-btn').addEventListener('click', () => {
      this.status = document.getElementById('aftersale-status-filter').value;
      this.type = document.getElementById('aftersale-type-filter').value;
      this.currentPage = 1;
      this.loadAftersales();
    });

    document.getElementById('add-aftersale-btn').addEventListener('click', () => {
      this.showAddForm();
    });
  },

  async loadAftersales() {
    const params = {
      page: this.currentPage,
      pageSize: this.pageSize
    };
    if (this.status) params.status = this.status;

    const res = await api.get('/aftersale', params);
    if (res.success) {
      this.total = res.data.total;
      this.renderTable(res.data.list);
      this.renderPagination();
    }
  },

  renderTable(list) {
    const container = document.getElementById('aftersale-table-container');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = '<div class="empty">暂无售后数据</div>';
      return;
    }

    let html = '<table><thead><tr><th>ID</th><th>关联订单</th><th>售后类型</th><th>退款金额</th><th>状态</th><th>申请时间</th><th>操作</th></tr></thead><tbody>';
    list.forEach(item => {
      html += `
        <tr>
          <td>#${item.id}</td>
          <td>${item.order_no || '-'}</td>
          <td>${aftersaleTypeMap[item.type] || item.type}</td>
          <td style="color: #e74c3c;">¥${formatMoney(item.refund_amount)}</td>
          <td><span class="status-badge status-${item.status}">${statusMap[item.status] || item.status}</span></td>
          <td>${formatDate(item.created_at)}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-default" onclick="aftersaleModule.viewDetail(${item.id})">详情</button>
              ${item.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="aftersaleModule.auditAftersale(${item.id}, 'approved')">通过</button>` : ''}
              ${item.status === 'pending' ? `<button class="btn btn-sm btn-danger" onclick="aftersaleModule.auditAftersale(${item.id}, 'rejected')">拒绝</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  },

  renderPagination() {
    const container = document.getElementById('aftersale-pagination');
    if (!container) return;

    const totalPages = Math.ceil(this.total / this.pageSize);
    let html = `
      <button onclick="aftersaleModule.prevPage()" ${this.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="page-info">第 ${this.currentPage} / ${totalPages} 页，共 ${this.total} 条</span>
      <button onclick="aftersaleModule.nextPage()" ${this.currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
    `;
    container.innerHTML = html;
  },

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadAftersales();
    }
  },

  nextPage() {
    const totalPages = Math.ceil(this.total / this.pageSize);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.loadAftersales();
    }
  },

  async showAddForm() {
    const ordersRes = await api.get('/orders', { pageSize: 100 });

    let orderOptions = '<option value="">请选择订单</option>';
    if (ordersRes.success && ordersRes.data.list) {
      ordersRes.data.list.forEach(order => {
        orderOptions += `<option value="${order.id}" data-amount="${order.total_amount}" data-user="${order.user_id}">${order.order_no} - ¥${formatMoney(order.total_amount)}</option>`;
      });
    }

    const bodyContent = `
      <div class="form-group">
        <label>选择订单</label>
        <select id="add-aftersale-order">${orderOptions}</select>
      </div>
      <div class="form-group">
        <label>售后类型</label>
        <select id="add-aftersale-type">
          <option value="shortage">缺货</option>
          <option value="quality">质量问题</option>
          <option value="wrong">错发</option>
          <option value="other">其他</option>
        </select>
      </div>
      <div class="form-group">
        <label>退款金额</label>
        <input type="number" id="add-aftersale-amount" step="0.01" placeholder="请输入退款金额">
      </div>
      <div class="form-group">
        <label>问题描述</label>
        <textarea id="add-aftersale-desc" rows="3" placeholder="请描述售后原因"></textarea>
      </div>
      <div class="form-group">
        <label>图片URL（多个用逗号分隔）</label>
        <input type="text" id="add-aftersale-images" placeholder="请输入图片URL">
      </div>
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">取消</button>
      <button class="btn btn-primary" onclick="aftersaleModule.submitAftersale()">提交申请</button>
    `;

    showModal('新增售后申请', bodyContent, footerContent);
  },

  async submitAftersale() {
    const orderId = document.getElementById('add-aftersale-order').value;
    const type = document.getElementById('add-aftersale-type').value;
    const amount = parseFloat(document.getElementById('add-aftersale-amount').value);
    const description = document.getElementById('add-aftersale-desc').value.trim();
    const images = document.getElementById('add-aftersale-images').value.trim();

    const orderSelect = document.getElementById('add-aftersale-order');
    const userId = orderSelect.options[orderSelect.selectedIndex].dataset.user;

    if (!orderId) {
      showToast('请选择订单', 'error');
      return;
    }
    if (!type) {
      showToast('请选择售后类型', 'error');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      showToast('请输入有效的退款金额', 'error');
      return;
    }

    const data = {
      order_id: parseInt(orderId),
      user_id: parseInt(userId),
      type,
      refund_amount: amount
    };
    if (description) data.description = description;
    if (images) data.images = images;

    const res = await api.post('/aftersale', data);
    if (res.success) {
      showToast('提交成功', 'success');
      hideModal();
      this.loadAftersales();
    } else {
      showToast(res.message || '提交失败', 'error');
    }
  },

  async viewDetail(id) {
    const res = await api.get(`/aftersale/${id}`);
    if (res.success) {
      this.showDetail(res.data);
    } else {
      showToast(res.message || '获取详情失败', 'error');
    }
  },

  showDetail(aftersale) {
    let itemsHtml = '';
    if (aftersale.items && aftersale.items.length > 0) {
      itemsHtml = '<div class="order-items"><h4>订单商品</h4>';
      aftersale.items.forEach(item => {
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
          <label>售后ID</label>
          <div>#${aftersale.id}</div>
        </div>
        <div class="form-group">
          <label>状态</label>
          <div><span class="status-badge status-${aftersale.status}">${statusMap[aftersale.status] || aftersale.status}</span></div>
        </div>
      </div>
      <div class="form-group">
        <label>关联订单</label>
        <div>${aftersale.order_no || '-'}</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>售后类型</label>
          <div>${aftersaleTypeMap[aftersale.type] || aftersale.type}</div>
        </div>
        <div class="form-group">
          <label>退款金额</label>
          <div style="color: #e74c3c;">¥${formatMoney(aftersale.refund_amount)}</div>
        </div>
      </div>
      <div class="form-group">
        <label>申请人</label>
        <div>${aftersale.nickname || aftersale.username || '-'} ${aftersale.user_phone ? '(' + aftersale.user_phone + ')' : ''}</div>
      </div>
      <div class="form-group">
        <label>问题描述</label>
        <div>${aftersale.description || '-'}</div>
      </div>
      ${aftersale.images ? `
      <div class="form-group">
        <label>图片凭证</label>
        <div>${aftersale.images}</div>
      </div>
      ` : ''}
      ${aftersale.audit_remark ? `
      <div class="form-group">
        <label>审核意见</label>
        <div>${aftersale.audit_remark}</div>
      </div>
      ` : ''}
      <div class="form-row">
        <div class="form-group">
          <label>申请时间</label>
          <div>${formatDate(aftersale.created_at)}</div>
        </div>
        <div class="form-group">
          <label>审核时间</label>
          <div>${formatDate(aftersale.audited_at)}</div>
        </div>
      </div>
      ${itemsHtml}
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">关闭</button>
      ${aftersale.status === 'pending' ? `<button class="btn btn-success" onclick="aftersaleModule.auditAftersale(${aftersale.id}, 'approved')">审核通过</button>` : ''}
      ${aftersale.status === 'pending' ? `<button class="btn btn-danger" onclick="aftersaleModule.auditAftersale(${aftersale.id}, 'rejected')">审核拒绝</button>` : ''}
    `;

    showModal('售后详情', bodyContent, footerContent);
  },

  auditAftersale(id, status) {
    const title = status === 'approved' ? '审核通过' : '审核拒绝';
    const btnClass = status === 'approved' ? 'btn-success' : 'btn-danger';

    const bodyContent = `
      <div class="form-group">
        <label>审核意见</label>
        <textarea id="audit-remark" rows="3" placeholder="请输入审核意见"></textarea>
      </div>
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">取消</button>
      <button class="btn ${btnClass}" onclick="aftersaleModule.confirmAudit(${id}, '${status}')">确认</button>
    `;

    showModal(title, bodyContent, footerContent);
  },

  async confirmAudit(id, status) {
    const auditRemark = document.getElementById('audit-remark').value.trim();

    const data = { status };
    if (auditRemark) data.audit_remark = auditRemark;

    const res = await api.put(`/aftersale/${id}/audit`, data);
    if (res.success) {
      showToast(status === 'approved' ? '审核通过' : '已拒绝', 'success');
      hideModal();
      this.loadAftersales();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  }
};
