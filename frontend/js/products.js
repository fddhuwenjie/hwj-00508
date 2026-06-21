const productsModule = {
  currentPage: 1,
  pageSize: 10,
  total: 0,
  category: '',
  status: '',

  init() {
    this.render();
    this.loadProducts();
  },

  render() {
    const container = document.getElementById('module-products');
    container.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="toolbar-left">
            <select id="product-category-filter">
              <option value="">全部分类</option>
              <option value="蔬果">蔬果</option>
              <option value="肉蛋">肉蛋</option>
              <option value="粮油">粮油</option>
              <option value="日用品">日用品</option>
              <option value="零食">零食</option>
            </select>
            <select id="product-status-filter">
              <option value="">全部状态</option>
              <option value="on">上架中</option>
              <option value="off">已下架</option>
            </select>
          </div>
          <button class="btn btn-primary" id="add-product-btn">+ 新增商品</button>
        </div>
        <div id="products-table-container"></div>
        <div class="pagination" id="products-pagination"></div>
      </div>
    `;

    document.getElementById('product-category-filter').addEventListener('change', () => {
      this.category = document.getElementById('product-category-filter').value;
      this.currentPage = 1;
      this.loadProducts();
    });

    document.getElementById('product-status-filter').addEventListener('change', () => {
      this.status = document.getElementById('product-status-filter').value;
      this.currentPage = 1;
      this.loadProducts();
    });

    document.getElementById('add-product-btn').addEventListener('click', () => {
      this.showProductForm();
    });
  },

  async loadProducts() {
    const params = {
      page: this.currentPage,
      pageSize: this.pageSize
    };
    if (this.category) params.category = this.category;
    if (this.status) params.status = this.status;

    const res = await api.get('/products', params);
    if (res.success) {
      this.total = res.data.total;
      this.renderTable(res.data.list);
      this.renderPagination();
    }
  },

  renderTable(products) {
    const container = document.getElementById('products-table-container');
    if (!container) return;

    if (products.length === 0) {
      container.innerHTML = '<div class="empty">暂无商品数据</div>';
      return;
    }

    let html = '<table><thead><tr><th>ID</th><th>商品名称</th><th>分类</th><th>规格</th><th>团购价</th><th>库存</th><th>状态</th><th>操作</th></tr></thead><tbody>';
    products.forEach(p => {
      html += `
        <tr>
          <td>${p.id}</td>
          <td>${p.name}</td>
          <td>${p.category}</td>
          <td>${p.specification || '-'}</td>
          <td>¥${formatMoney(p.group_price)}</td>
          <td>${p.stock}</td>
          <td><span class="status-badge status-${p.status}">${statusMap[p.status] || p.status}</span></td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-default" onclick="productsModule.editProduct(${p.id})">编辑</button>
              <button class="btn btn-sm ${p.status === 'on' ? 'btn-warning' : 'btn-success'}" onclick="productsModule.toggleStatus(${p.id}, '${p.status}')">
                ${p.status === 'on' ? '下架' : '上架'}
              </button>
              <button class="btn btn-sm btn-danger" onclick="productsModule.deleteProduct(${p.id})">删除</button>
            </div>
          </td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  },

  renderPagination() {
    const container = document.getElementById('products-pagination');
    if (!container) return;

    const totalPages = Math.ceil(this.total / this.pageSize);
    let html = `
      <button onclick="productsModule.prevPage()" ${this.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="page-info">第 ${this.currentPage} / ${totalPages} 页，共 ${this.total} 条</span>
      <button onclick="productsModule.nextPage()" ${this.currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
    `;
    container.innerHTML = html;
  },

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadProducts();
    }
  },

  nextPage() {
    const totalPages = Math.ceil(this.total / this.pageSize);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.loadProducts();
    }
  },

  showProductForm(product = null) {
    const isEdit = product !== null;
    const title = isEdit ? '编辑商品' : '新增商品';

    const bodyContent = `
      <div class="form-group">
        <label>商品名称</label>
        <input type="text" id="form-product-name" value="${product ? product.name : ''}" placeholder="请输入商品名称">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>分类</label>
          <select id="form-product-category">
            <option value="蔬果" ${product && product.category === '蔬果' ? 'selected' : ''}>蔬果</option>
            <option value="肉蛋" ${product && product.category === '肉蛋' ? 'selected' : ''}>肉蛋</option>
            <option value="粮油" ${product && product.category === '粮油' ? 'selected' : ''}>粮油</option>
            <option value="日用品" ${product && product.category === '日用品' ? 'selected' : ''}>日用品</option>
            <option value="零食" ${product && product.category === '零食' ? 'selected' : ''}>零食</option>
          </select>
        </div>
        <div class="form-group">
          <label>规格</label>
          <input type="text" id="form-product-spec" value="${product ? product.specification || '' : ''}" placeholder="如：500g/份">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>团购价</label>
          <input type="number" id="form-product-price" value="${product ? product.group_price : ''}" placeholder="请输入团购价" step="0.01">
        </div>
        <div class="form-group">
          <label>库存</label>
          <input type="number" id="form-product-stock" value="${product ? product.stock : 0}" placeholder="请输入库存">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>截单时间</label>
          <input type="datetime-local" id="form-product-cutoff" value="${product ? product.cutoff_time || '' : ''}">
        </div>
        <div class="form-group">
          <label>提货日期</label>
          <input type="date" id="form-product-pickup" value="${product ? product.pickup_date || '' : ''}">
        </div>
      </div>
      <div class="form-group">
        <label>商品图片URL</label>
        <input type="text" id="form-product-image" value="${product ? product.image || '' : ''}" placeholder="请输入图片URL">
      </div>
    `;

    const footerContent = `
      <button class="btn btn-default" onclick="hideModal()">取消</button>
      <button class="btn btn-primary" onclick="productsModule.saveProduct(${isEdit ? product.id : 'null'})">保存</button>
    `;

    showModal(title, bodyContent, footerContent);
  },

  async editProduct(id) {
    const res = await api.get(`/products/${id}`);
    if (res.success) {
      this.showProductForm(res.data);
    } else {
      showToast(res.message || '获取商品信息失败', 'error');
    }
  },

  async saveProduct(id) {
    const data = {
      name: document.getElementById('form-product-name').value.trim(),
      category: document.getElementById('form-product-category').value,
      specification: document.getElementById('form-product-spec').value.trim(),
      group_price: parseFloat(document.getElementById('form-product-price').value),
      stock: parseInt(document.getElementById('form-product-stock').value) || 0,
      cutoff_time: document.getElementById('form-product-cutoff').value || null,
      pickup_date: document.getElementById('form-product-pickup').value || null,
      image: document.getElementById('form-product-image').value.trim() || null
    };

    if (!data.name) {
      showToast('请输入商品名称', 'error');
      return;
    }
    if (isNaN(data.group_price)) {
      showToast('请输入有效的团购价', 'error');
      return;
    }

    let res;
    if (id) {
      res = await api.put(`/products/${id}`, data);
    } else {
      res = await api.post('/products', data);
    }

    if (res.success) {
      showToast(id ? '编辑成功' : '新增成功', 'success');
      hideModal();
      this.loadProducts();
    } else {
      showToast(res.message || '保存失败', 'error');
    }
  },

  async toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'on' ? 'off' : 'on';
    const res = await api.put(`/products/${id}/status`, { status: newStatus });
    if (res.success) {
      showToast(newStatus === 'on' ? '已上架' : '已下架', 'success');
      this.loadProducts();
    } else {
      showToast(res.message || '操作失败', 'error');
    }
  },

  async deleteProduct(id) {
    if (!confirm('确定要删除该商品吗？')) return;

    const res = await api.delete(`/products/${id}`);
    if (res.success) {
      showToast('删除成功', 'success');
      this.loadProducts();
    } else {
      showToast(res.message || '删除失败', 'error');
    }
  }
};
