const sortingModule = {
  currentPage: 1,
  pageSize: 10,
  total: 0,
  pickupDate: '',
  status: '',

  init() {
    this.render();
    this.loadSortingOrders();
  },

  render() {
    const container = document.getElementById('module-sorting');
    container.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="toolbar-left">
            <input type="date" id="sorting-pickup-date-filter" placeholder="提货日期">
            <select id="sorting-status-filter">
              <option value="">全部状态</option>
              <option value="pending">待分拣</option>
              <option value="completed">已完成</option>
            </select>
            <button class="btn btn-default" id="sorting-search-btn">查询</button>
          </div>
          <button class="btn btn-primary" id="generate-sorting-btn">+ 生成分拣单</button>
        </div>
        <div id="sorting-table-container"></div>
        <div class="pagination" id="sorting-pagination"></div>
      </div>
    `;

    document.getElementById('sorting-search-btn').addEventListener('click', () => {
      this.pickupDate = document.getElementById('sorting-pickup-date-filter').value;
      this.status = document.getElementById('sorting-status-filter').value;
      this.currentPage = 1;
      this.loadSortingOrders();
    });

    document.getElementById('generate-sorting-btn').addEventListener('click', () => {
      this.showGenerateForm();
    });
  },

  async loadSortingOrders() {
    const params = {
      page: this.currentPage,
      pageSize: this.pageSize
    };
    if (this.pickupDate) params.pickup_date = this.pickupDate;
    if (this.status) params.status = this.status;

    const res = await api.get('/sorting', params);
    if (res.success) {
      this.total = res.data.total;
      this.renderTable(res.data.list);
      this.renderPagination();
    }
  },

  renderTable(orders) {
    const container = document.getElementById('sorting-table-container');
    if (!container) return;

    if (orders.length === 0) {
      container.innerHTML = '<div class="empty">暂无分拣单数据</div>';
      return;
    }

    let html = '<table><thead><tr><th>分拣单号</th><th>提货日期</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>';
    orders.forEach(order => {
      html += `
        <tr>
          <td>${order.sorting_no}</td>
          <td>${order.pickup_date}</td>
          <td><span class="status-badge status-${order.status}">${statusMap[order.status] || order.status}</span></td>
          <td>${formatDate(order.created_at)}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-default" onclick="sortingModule.viewDetail(${order.id})">详情</button>
              ${order.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="sortingModule.completeSorting(${order.id})">完成分拣</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  },

  renderPagination() {
    const container = document.getElementById('sorting-pagination');
    if (!container) return;

    const totalPages = Math.ceil(this.total / this.pageSize);
    let html = `
      <button onclick="sortingModule.prevPage()" ${this.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="page-info">第 ${this.currentPage} / ${totalPages} 页，共 ${this.total} 条</span>
      <button onclick="sortingModule.nextPage()" ${this.currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
    `;
    container.innerHTML = html;
  },

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadSortingOrders();
    }
  },

  nextPage() {
    const totalPages = Math.ceil(this.total / this.pageSize);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.loadSortingOrders();
    }
  },

  showGenerateForm() {
    const bodyContent = `
      <div class="form-group">
        <label>选择提货日期</label>
        <input type="date" id="generate-pickup-date">
      </div>
      <div style="color: #999; font-size: 13px;">
        系统将自动汇总该提货日期下所有已支付的自提订单，生成分拣单。
      </div>
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">取消</button>
      <button class="btn btn-primary" onclick="sortingModule.generateSorting()">生成</button>
    `;

    showModal('生成分拣单', bodyContent, footerContent);
  },

  async generateSorting() {
    const pickupDate = document.getElementById('generate-pickup-date').value;
    if (!pickupDate) {
      showToast('请选择提货日期', 'error');
      return;
    }

    const res = await api.post('/sorting/generate', { pickup_date: pickupDate });
    if (res.success) {
      showToast('生成分拣单成功', 'success');
      hideModal();
      this.loadSortingOrders();
    } else {
      showToast(res.message || '生成失败', 'error');
    }
  },

  async viewDetail(id) {
    const res = await api.get(`/sorting/${id}`);
    if (res.success) {
      this.showDetail(res.data);
    } else {
      showToast(res.message || '获取详情失败', 'error');
    }
  },

  showDetail(sortingOrder) {
    let itemsHtml = '';
    if (sortingOrder.items && sortingOrder.items.length > 0) {
      itemsHtml = '<h4 style="margin-bottom: 12px; font-size: 14px;">商品汇总</h4>';
      itemsHtml += '<table class="sorting-items-table"><thead><tr><th>商品名称</th><th>规格</th><th>应分拣数量</th><th>缺货数量</th><th>操作</th></tr></thead><tbody>';
      sortingOrder.items.forEach(item => {
        itemsHtml += `
          <tr>
            <td>${item.product_name}</td>
            <td>${item.specification || '-'}</td>
            <td>${item.total_quantity}</td>
            <td style="color: #e74c3c;">${item.shortage_quantity || 0}</td>
            <td>
              ${sortingOrder.status === 'pending' ? `
                <button class="btn btn-sm btn-warning" onclick="sortingModule.showShortageForm(${item.id}, ${item.product_id}, '${item.product_name}', ${item.total_quantity}, ${item.shortage_quantity || 0})">
                  标记缺货
                </button>
              ` : '-'}
            </td>
          </tr>
        `;
      });
      itemsHtml += '</tbody></table>';
    }

    let ordersHtml = '';
    if (sortingOrder.orders && sortingOrder.orders.length > 0) {
      ordersHtml = '<h4 style="margin: 20px 0 12px; font-size: 14px;">关联订单</h4>';
      ordersHtml += '<table><thead><tr><th>订单号</th><th>用户</th><th>联系电话</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>';
      sortingOrder.orders.forEach(order => {
        ordersHtml += `
          <tr>
            <td>${order.order_no}</td>
            <td>${order.nickname || '-'}</td>
            <td>${order.user_phone || '-'}</td>
            <td>¥${formatMoney(order.total_amount)}</td>
            <td><span class="status-badge status-${order.status}">${statusMap[order.status] || order.status}</span></td>
            <td>
              <button class="btn btn-sm btn-default" onclick="sortingModule.viewReceipt(${order.id})">查看小票</button>
            </td>
          </tr>
        `;
      });
      ordersHtml += '</tbody></table>';
    }

    const bodyContent = `
      <div class="form-row">
        <div class="form-group">
          <label>分拣单号</label>
          <div>${sortingOrder.sorting_no}</div>
        </div>
        <div class="form-group">
          <label>状态</label>
          <div><span class="status-badge status-${sortingOrder.status}">${statusMap[sortingOrder.status] || sortingOrder.status}</span></div>
        </div>
      </div>
      <div class="form-group">
        <label>提货日期</label>
        <div>${sortingOrder.pickup_date}</div>
      </div>
      ${itemsHtml}
      ${ordersHtml}
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">关闭</button>
      ${sortingOrder.status === 'pending' ? `<button class="btn btn-success" onclick="sortingModule.completeSorting(${sortingOrder.id})">完成分拣</button>` : ''}
    `;

    showModal('分拣单详情', bodyContent, footerContent);
  },

  showShortageForm(itemId, productId, productName, totalQty, currentShortage) {
    const availableQty = totalQty - currentShortage;
    const bodyContent = `
      <div class="form-group">
        <label>商品名称</label>
        <div>${productName}</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>应分拣数量</label>
          <div>${totalQty}</div>
        </div>
        <div class="form-group">
          <label>已缺货数量</label>
          <div>${currentShortage}</div>
        </div>
      </div>
      <div class="form-group">
        <label>本次缺货数量</label>
        <input type="number" id="shortage-quantity" min="1" max="${availableQty}" placeholder="请输入缺货数量">
        <div style="color: #999; font-size: 12px; margin-top: 4px;">最多可标记 ${availableQty} 件缺货</div>
      </div>
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="sortingModule.viewDetail(${document.querySelector('.modal-body').closest('[id]') ? '' : ''})">取消</button>
      <button class="btn btn-warning" onclick="sortingModule.markShortage(${itemId})">确认缺货</button>
    `;

    showModal('标记缺货', bodyContent, footerContent);

    this.currentSortingOrderId = null;
    const detailBtn = document.querySelector('.modal-footer .btn-default');
    detailBtn.onclick = () => {
      hideModal();
    };
  },

  async markShortage(itemId) {
    const qty = parseInt(document.getElementById('shortage-quantity').value);
    if (!qty || qty <= 0) {
      showToast('请输入有效的缺货数量', 'error');
      return;
    }

    const res = await api.put(`/sorting/item/${itemId}/shortage`, { shortage_quantity: qty });
    if (res.success) {
      showToast('标记缺货成功', 'success');
      hideModal();
      this.loadSortingOrders();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  async viewReceipt(orderId) {
    const res = await api.get('/orders/' + orderId);
    if (!res.success) {
      showToast(res.message || '获取订单详情失败', 'error');
      return;
    }
    this.showReceipt(res.data);
  },

  showReceipt(order) {
    const items = order.items || [];
    const itemsRows = items.map(it => {
      const refund = it.refund_quantity || 0;
      const realQty = it.quantity - refund;
      return `
        <tr>
          <td>${it.product_name}<div style="font-size:11px;color:#666;">${it.specification || ''}</div></td>
          <td class="right">${it.quantity}</td>
          ${refund > 0 ? `<td class="right">-${refund}</td>` : '<td class="right">0</td>'}
          <td class="right">¥${formatMoney(it.price)}</td>
          <td class="right">¥${formatMoney(it.price * realQty)}</td>
        </tr>
      `;
    }).join('');

    const refundAmount = parseFloat(order.refund_amount || 0);
    const payable = order.total_amount - refundAmount;

    const receiptHtml = `
      <div class="receipt-sheet" id="receipt-sheet">
        <h3>社区团购 · 购物小票</h3>
        <div class="receipt-divider"></div>
        <div class="receipt-row"><span>订单号</span><span>${order.order_no}</span></div>
        <div class="receipt-row"><span>用户</span><span>${order.username || order.nickname || '-'}</span></div>
        <div class="receipt-row"><span>电话</span><span>${order.user_phone || '-'}</span></div>
        <div class="receipt-row"><span>提货日期</span><span>${order.pickup_date || '-'}</span></div>
        <div class="receipt-row"><span>状态</span><span>${statusMap[order.status] || order.status}</span></div>
        <div class="receipt-divider"></div>
        <table>
          <thead>
            <tr><th>商品</th><th class="right">数量</th><th class="right">退款</th><th class="right">单价</th><th class="right">小计</th></tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <div class="receipt-divider"></div>
        <div class="receipt-row"><span>商品总额</span><span>¥${formatMoney(order.total_amount)}</span></div>
        ${refundAmount > 0 ? `<div class="receipt-row"><span>退款金额</span><span>-¥${formatMoney(refundAmount)}</span></div>` : ''}
        <div class="receipt-row"><span>应付金额</span><span><strong>¥${formatMoney(payable)}</strong></span></div>
        ${order.pickup_code ? `<div class="receipt-divider"></div><div class="receipt-row"><span>自提核销码</span><span><strong>${order.pickup_code}</strong></span></div>` : ''}
        ${order.remark ? `<div class="receipt-row"><span>备注</span><span>${order.remark}</span></div>` : ''}
      </div>
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">关闭</button>
      <button class="btn btn-primary" onclick="sortingModule.printReceipt()">打印小票</button>
    `;

    showModal('订单小票', receiptHtml, footerContent);
  },

  printReceipt() {
    const sheet = document.getElementById('receipt-sheet');
    if (!sheet) return;
    const printArea = document.createElement('div');
    printArea.className = 'receipt-print-area';
    printArea.innerHTML = sheet.innerHTML;
    document.body.appendChild(printArea);
    window.print();
    document.body.removeChild(printArea);
  },

  async completeSorting(id) {
    if (!confirm('确定要完成分拣吗？完成后订单将变为待提货状态。')) return;

    const res = await api.put(`/sorting/${id}/complete`);
    if (res.success) {
      showToast('分拣完成', 'success');
      hideModal();
      this.loadSortingOrders();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  }
};
