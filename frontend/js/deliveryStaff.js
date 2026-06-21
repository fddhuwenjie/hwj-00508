const deliveryStaffModule = {
  currentPage: 1,
  pageSize: 10,
  total: 0,
  status: '',

  init() {
    this.render();
    this.loadStaff();
  },

  render() {
    const container = document.getElementById('module-delivery-staff');
    container.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="toolbar-left">
            <select id="delivery-staff-status-filter">
              <option value="">全部状态</option>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
            <button class="btn btn-default" id="delivery-staff-search-btn">查询</button>
          </div>
          <button class="btn btn-primary" id="add-delivery-staff-btn">+ 新增配送员</button>
        </div>
        <div id="delivery-staff-table-container"></div>
        <div class="pagination" id="delivery-staff-pagination"></div>
      </div>
    `;

    document.getElementById('delivery-staff-search-btn').addEventListener('click', () => {
      this.status = document.getElementById('delivery-staff-status-filter').value;
      this.currentPage = 1;
      this.loadStaff();
    });

    document.getElementById('add-delivery-staff-btn').addEventListener('click', () => {
      this.showStaffForm();
    });
  },

  async loadStaff() {
    const params = {
      page: this.currentPage,
      pageSize: this.pageSize
    };
    if (this.status) params.status = this.status;

    const res = await api.get('/delivery-staff', params);
    if (res.success) {
      this.total = res.data.total;
      this.renderTable(res.data.list);
      this.renderPagination();
    }
  },

  renderTable(staffList) {
    const container = document.getElementById('delivery-staff-table-container');
    if (!container) return;

    if (staffList.length === 0) {
      container.innerHTML = '<div class="empty">暂无配送员数据</div>';
      return;
    }

    let html = '<table><thead><tr><th>ID</th><th>姓名</th><th>联系电话</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>';
    staffList.forEach(staff => {
      html += `
        <tr>
          <td>${staff.id}</td>
          <td>${staff.name}</td>
          <td>${staff.phone || '-'}</td>
          <td><span class="status-badge status-${staff.status}">${statusMap[staff.status] || staff.status}</span></td>
          <td>${formatDate(staff.created_at)}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-default" onclick="deliveryStaffModule.editStaff(${staff.id})">编辑</button>
              <button class="btn btn-sm ${staff.status === 'active' ? 'btn-warning' : 'btn-success'}" onclick="deliveryStaffModule.toggleStatus(${staff.id}, '${staff.status}')">
                ${staff.status === 'active' ? '停用' : '启用'}
              </button>
              <button class="btn btn-sm btn-danger" onclick="deliveryStaffModule.deleteStaff(${staff.id})">删除</button>
            </div>
          </td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  },

  renderPagination() {
    const container = document.getElementById('delivery-staff-pagination');
    if (!container) return;

    const totalPages = Math.ceil(this.total / this.pageSize);
    let html = `
      <button onclick="deliveryStaffModule.prevPage()" ${this.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="page-info">第 ${this.currentPage} / ${totalPages} 页，共 ${this.total} 条</span>
      <button onclick="deliveryStaffModule.nextPage()" ${this.currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
    `;
    container.innerHTML = html;
  },

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadStaff();
    }
  },

  nextPage() {
    const totalPages = Math.ceil(this.total / this.pageSize);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.loadStaff();
    }
  },

  showStaffForm(staff = null) {
    const isEdit = staff !== null;
    const title = isEdit ? '编辑配送员' : '新增配送员';

    const bodyContent = `
      <div class="form-group">
        <label>姓名</label>
        <input type="text" id="form-staff-name" value="${staff ? staff.name : ''}" placeholder="请输入姓名">
      </div>
      <div class="form-group">
        <label>联系电话</label>
        <input type="text" id="form-staff-phone" value="${staff ? staff.phone || '' : ''}" placeholder="请输入联系电话">
      </div>
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">取消</button>
      <button class="btn btn-primary" onclick="deliveryStaffModule.saveStaff(${isEdit ? staff.id : 'null'})">保存</button>
    `;

    showModal(title, bodyContent, footerContent);
  },

  async editStaff(id) {
    const res = await api.get(`/delivery-staff/${id}`);
    if (res.success) {
      this.showStaffForm(res.data);
    } else {
      showToast(res.message || '获取配送员信息失败', 'error');
    }
  },

  async saveStaff(id) {
    const data = {
      name: document.getElementById('form-staff-name').value.trim(),
      phone: document.getElementById('form-staff-phone').value.trim() || null
    };

    if (!data.name) {
      showToast('请输入姓名', 'error');
      return;
    }

    let res;
    if (id) {
      res = await api.put(`/delivery-staff/${id}`, data);
    } else {
      res = await api.post('/delivery-staff', data);
    }

    if (res.success) {
      showToast(id ? '编辑成功' : '新增成功', 'success');
      hideModal();
      this.loadStaff();
    } else {
      showToast(res.message || '保存失败', 'error');
    }
  },

  async toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const res = await api.put(`/delivery-staff/${id}/status`, { status: newStatus });
    if (res.success) {
      showToast(newStatus === 'active' ? '已启用' : '已停用', 'success');
      this.loadStaff();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  async deleteStaff(id) {
    if (!confirm('确定要删除该配送员吗？')) return;

    const res = await api.delete(`/delivery-staff/${id}`);
    if (res.success) {
      showToast('删除成功', 'success');
      this.loadStaff();
    } else {
      showToast(res.message || '删除失败', 'error');
    }
  }
};
