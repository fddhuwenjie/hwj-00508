const pickupPointsModule = {
  currentPage: 1,
  pageSize: 10,
  total: 0,
  status: '',

  init() {
    this.render();
    this.loadPoints();
  },

  render() {
    const container = document.getElementById('module-pickup-points');
    container.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="toolbar-left">
            <select id="pickup-point-status-filter">
              <option value="">全部状态</option>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
            <button class="btn btn-default" id="pickup-point-search-btn">查询</button>
          </div>
          <button class="btn btn-primary" id="add-pickup-point-btn">+ 新增自提点</button>
        </div>
        <div id="pickup-points-table-container"></div>
        <div class="pagination" id="pickup-points-pagination"></div>
      </div>
    `;

    document.getElementById('pickup-point-search-btn').addEventListener('click', () => {
      this.status = document.getElementById('pickup-point-status-filter').value;
      this.currentPage = 1;
      this.loadPoints();
    });

    document.getElementById('add-pickup-point-btn').addEventListener('click', () => {
      this.showPointForm();
    });
  },

  async loadPoints() {
    const params = {
      page: this.currentPage,
      pageSize: this.pageSize
    };
    if (this.status) params.status = this.status;

    const res = await api.get('/pickup-points', params);
    if (res.success) {
      this.total = res.data.total;
      this.renderTable(res.data.list);
      this.renderPagination();
    }
  },

  renderTable(points) {
    const container = document.getElementById('pickup-points-table-container');
    if (!container) return;

    if (points.length === 0) {
      container.innerHTML = '<div class="empty">暂无自提点数据</div>';
      return;
    }

    let html = '<table><thead><tr><th>ID</th><th>名称</th><th>地址</th><th>联系人</th><th>联系电话</th><th>状态</th><th>操作</th></tr></thead><tbody>';
    points.forEach(p => {
      html += `
        <tr>
          <td>${p.id}</td>
          <td>${p.name}</td>
          <td>${p.address || '-'}</td>
          <td>${p.contact || '-'}</td>
          <td>${p.phone || '-'}</td>
          <td><span class="status-badge status-${p.status}">${statusMap[p.status] || p.status}</span></td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-default" onclick="pickupPointsModule.editPoint(${p.id})">编辑</button>
              <button class="btn btn-sm ${p.status === 'active' ? 'btn-warning' : 'btn-success'}" onclick="pickupPointsModule.toggleStatus(${p.id}, '${p.status}')">
                ${p.status === 'active' ? '停用' : '启用'}
              </button>
              <button class="btn btn-sm btn-danger" onclick="pickupPointsModule.deletePoint(${p.id})">删除</button>
            </div>
          </td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  },

  renderPagination() {
    const container = document.getElementById('pickup-points-pagination');
    if (!container) return;

    const totalPages = Math.ceil(this.total / this.pageSize);
    let html = `
      <button onclick="pickupPointsModule.prevPage()" ${this.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="page-info">第 ${this.currentPage} / ${totalPages} 页，共 ${this.total} 条</span>
      <button onclick="pickupPointsModule.nextPage()" ${this.currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
    `;
    container.innerHTML = html;
  },

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadPoints();
    }
  },

  nextPage() {
    const totalPages = Math.ceil(this.total / this.pageSize);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.loadPoints();
    }
  },

  showPointForm(point = null) {
    const isEdit = point !== null;
    const title = isEdit ? '编辑自提点' : '新增自提点';

    const bodyContent = `
      <div class="form-group">
        <label>自提点名称</label>
        <input type="text" id="form-point-name" value="${point ? point.name : ''}" placeholder="请输入自提点名称">
      </div>
      <div class="form-group">
        <label>地址</label>
        <input type="text" id="form-point-address" value="${point ? point.address || '' : ''}" placeholder="请输入地址">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>联系人</label>
          <input type="text" id="form-point-contact" value="${point ? point.contact || '' : ''}" placeholder="请输入联系人">
        </div>
        <div class="form-group">
          <label>联系电话</label>
          <input type="text" id="form-point-phone" value="${point ? point.phone || '' : ''}" placeholder="请输入联系电话">
        </div>
      </div>
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">取消</button>
      <button class="btn btn-primary" onclick="pickupPointsModule.savePoint(${isEdit ? point.id : 'null'})">保存</button>
    `;

    showModal(title, bodyContent, footerContent);
  },

  async editPoint(id) {
    const res = await api.get(`/pickup-points/${id}`);
    if (res.success) {
      this.showPointForm(res.data);
    } else {
      showToast(res.message || '获取自提点信息失败', 'error');
    }
  },

  async savePoint(id) {
    const data = {
      name: document.getElementById('form-point-name').value.trim(),
      address: document.getElementById('form-point-address').value.trim() || null,
      contact: document.getElementById('form-point-contact').value.trim() || null,
      phone: document.getElementById('form-point-phone').value.trim() || null
    };

    if (!data.name) {
      showToast('请输入自提点名称', 'error');
      return;
    }

    let res;
    if (id) {
      res = await api.put(`/pickup-points/${id}`, data);
    } else {
      res = await api.post('/pickup-points', data);
    }

    if (res.success) {
      showToast(id ? '编辑成功' : '新增成功', 'success');
      hideModal();
      this.loadPoints();
    } else {
      showToast(res.message || '保存失败', 'error');
    }
  },

  async toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const res = await api.put(`/pickup-points/${id}/status`, { status: newStatus });
    if (res.success) {
      showToast(newStatus === 'active' ? '已启用' : '已停用', 'success');
      this.loadPoints();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  async deletePoint(id) {
    if (!confirm('确定要删除该自提点吗？')) return;

    const res = await api.delete(`/pickup-points/${id}`);
    if (res.success) {
      showToast('删除成功', 'success');
      this.loadPoints();
    } else {
      showToast(res.message || '删除失败', 'error');
    }
  }
};
