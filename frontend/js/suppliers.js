const suppliersModule = {
  currentPage: 1,
  pageSize: 10,
  total: 0,
  allData: [],

  init() {
    this.render();
    this.loadSuppliers();
  },

  render() {
    const container = document.getElementById('module-suppliers');
    container.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="toolbar-left"></div>
          <button class="btn btn-primary" id="add-supplier-btn">+ 新增供应商</button>
        </div>
        <div id="suppliers-table-container"></div>
        <div class="pagination" id="suppliers-pagination"></div>
      </div>
    `;

    document.getElementById('add-supplier-btn').addEventListener('click', () => {
      this.showSupplierForm();
    });
  },

  async loadSuppliers() {
    const res = await api.get('/suppliers');
    if (res.success) {
      this.allData = res.data;
      this.total = res.data.length;
      this.renderTable();
      this.renderPagination();
    }
  },

  getPageData() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.allData.slice(start, end);
  },

  renderTable() {
    const container = document.getElementById('suppliers-table-container');
    if (!container) return;

    const suppliers = this.getPageData();

    if (suppliers.length === 0) {
      container.innerHTML = '<div class="empty">暂无供应商数据</div>';
      return;
    }

    let html = '<table><thead><tr><th>ID</th><th>供应商名称</th><th>联系人</th><th>联系电话</th><th>创建时间</th><th>操作</th></tr></thead><tbody>';
    suppliers.forEach(s => {
      html += `
        <tr>
          <td>${s.id}</td>
          <td>${s.name}</td>
          <td>${s.contact || '-'}</td>
          <td>${s.phone || '-'}</td>
          <td>${formatDate(s.created_at)}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-default" onclick="suppliersModule.editSupplier(${s.id})">编辑</button>
              <button class="btn btn-sm btn-danger" onclick="suppliersModule.deleteSupplier(${s.id})">删除</button>
            </div>
          </td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  },

  renderPagination() {
    const container = document.getElementById('suppliers-pagination');
    if (!container) return;

    const totalPages = Math.ceil(this.total / this.pageSize);
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = `
      <button onclick="suppliersModule.prevPage()" ${this.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="page-info">第 ${this.currentPage} / ${totalPages} 页，共 ${this.total} 条</span>
      <button onclick="suppliersModule.nextPage()" ${this.currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
    `;
    container.innerHTML = html;
  },

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderTable();
      this.renderPagination();
    }
  },

  nextPage() {
    const totalPages = Math.ceil(this.total / this.pageSize);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.renderTable();
      this.renderPagination();
    }
  },

  showSupplierForm(supplier = null) {
    const isEdit = supplier !== null;
    const title = isEdit ? '编辑供应商' : '新增供应商';

    const bodyContent = `
      <div class="form-group">
        <label>供应商名称</label>
        <input type="text" id="form-supplier-name" value="${supplier ? supplier.name : ''}" placeholder="请输入供应商名称">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>联系人</label>
          <input type="text" id="form-supplier-contact" value="${supplier ? supplier.contact || '' : ''}" placeholder="请输入联系人">
        </div>
        <div class="form-group">
          <label>联系电话</label>
          <input type="text" id="form-supplier-phone" value="${supplier ? supplier.phone || '' : ''}" placeholder="请输入联系电话">
        </div>
      </div>
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">取消</button>
      <button class="btn btn-primary" onclick="suppliersModule.saveSupplier(${isEdit ? supplier.id : 'null'})">保存</button>
    `;

    showModal(title, bodyContent, footerContent);
  },

  async editSupplier(id) {
    const res = await api.get(`/suppliers/${id}`);
    if (res.success) {
      this.showSupplierForm(res.data);
    } else {
      showToast(res.message || '获取供应商信息失败', 'error');
    }
  },

  async saveSupplier(id) {
    const data = {
      name: document.getElementById('form-supplier-name').value.trim(),
      contact: document.getElementById('form-supplier-contact').value.trim() || null,
      phone: document.getElementById('form-supplier-phone').value.trim() || null
    };

    if (!data.name) {
      showToast('请输入供应商名称', 'error');
      return;
    }

    let res;
    if (id) {
      res = await api.put(`/suppliers/${id}`, data);
    } else {
      res = await api.post('/suppliers', data);
    }

    if (res.success) {
      showToast(id ? '编辑成功' : '新增成功', 'success');
      hideModal();
      this.loadSuppliers();
    } else {
      showToast(res.message || '保存失败', 'error');
    }
  },

  async deleteSupplier(id) {
    if (!confirm('确定要删除该供应商吗？')) return;

    const res = await api.delete(`/suppliers/${id}`);
    if (res.success) {
      showToast('删除成功', 'success');
      this.loadSuppliers();
    } else {
      showToast(res.message || '删除失败', 'error');
    }
  }
};
