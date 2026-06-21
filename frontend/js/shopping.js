const shoppingModule = (function () {
  let state = {
    users: [],
    products: [],
    pickupPoints: [],
    cart: [],
    currentUserId: null,
    category: '',
    keyword: '',
    view: 'products'
  };

  async function loadUsers() {
    const res = await api.get('/users', { page: 1, pageSize: 100 });
    if (res.success) {
      state.users = res.data.list || [];
      if (!state.currentUserId && state.users.length > 0) {
        state.currentUserId = state.users[0].id;
      }
    }
  }

  async function loadProducts() {
    const params = { page: 1, pageSize: 100 };
    if (state.category) params.category = state.category;
    const res = await api.get('/products', params);
    if (res.success) {
      let list = res.data.list || [];
      if (state.keyword) {
        const kw = state.keyword.toLowerCase();
        list = list.filter(p =>
          (p.name || '').toLowerCase().includes(kw) ||
          (p.category || '').toLowerCase().includes(kw)
        );
      }
      state.products = list;
    }
  }

  async function loadPickupPoints() {
    const res = await api.get('/pickup-points', { status: 'active', page: 1, pageSize: 100 });
    if (res.success) {
      state.pickupPoints = res.data.list || [];
    }
  }

  async function loadCart() {
    if (!state.currentUserId) {
      state.cart = [];
      return;
    }
    const res = await api.get('/cart/' + state.currentUserId);
    if (res.success) {
      state.cart = res.data || [];
    }
  }

  function cartCount() {
    return state.cart.reduce((s, it) => s + it.quantity, 0);
  }

  function cartTotal() {
    return state.cart.reduce((s, it) => s + it.group_price * it.quantity, 0);
  }

  function renderHeader() {
    const userOptions = state.users
      .map(u => `<option value="${u.id}" ${u.id === state.currentUserId ? 'selected' : ''}>${u.nickname || u.username}（${u.phone || '-'}）</option>`)
      .join('');

    return `
      <div class="shopping-toolbar">
        <div class="shopping-toolbar-left">
          <label class="shop-field">
            <span>当前用户</span>
            <select id="shop-user-select">${userOptions}</select>
          </label>
          <label class="shop-field">
            <span>分类</span>
            <input type="text" id="shop-category-input" value="${state.category}" placeholder="输入分类筛选">
          </label>
          <label class="shop-field">
            <span>搜索</span>
            <input type="text" id="shop-keyword-input" value="${state.keyword}" placeholder="商品名/分类">
          </label>
          <button class="btn btn-primary" id="shop-search-btn">搜索</button>
        </div>
        <div class="shopping-toolbar-right">
          <button class="btn ${state.view === 'products' ? 'btn-primary' : 'btn-default'}" id="shop-view-products">商品列表</button>
          <button class="btn ${state.view === 'cart' ? 'btn-primary' : 'btn-default'}" id="shop-view-cart">购物车(${cartCount()})</button>
        </div>
      </div>
    `;
  }

  function renderProducts() {
    if (state.products.length === 0) {
      return '<div class="empty-state">暂无可购买商品</div>';
    }

    const cards = state.products.map(p => {
      const soldOut = p.stock <= 0 || p.status !== 'on';
      const img = p.image
        ? `<img src="${p.image}" alt="${p.name}" onerror="this.style.display='none'">`
        : `<div class="product-card-img-placeholder">${(p.name || '').slice(0, 1)}</div>`;
      return `
        <div class="product-card ${soldOut ? 'sold-out' : ''}">
          <div class="product-card-img">${img}</div>
          <div class="product-card-body">
            <div class="product-card-name">${p.name}</div>
            <div class="product-card-spec">${p.specification || ''}</div>
            <div class="product-card-meta">
              <span class="product-card-price">¥${formatMoney(p.group_price)}</span>
              <span class="product-card-stock ${p.stock <= 5 ? 'low' : ''}">库存 ${p.stock}</span>
            </div>
            <button class="btn btn-primary btn-block add-cart-btn" data-id="${p.id}" ${soldOut ? 'disabled' : ''}>
              ${soldOut ? '已售罄' : '加入购物车'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    return `<div class="product-grid">${cards}</div>`;
  }

  function renderCart() {
    if (state.cart.length === 0) {
      return '<div class="empty-state">购物车空空如也，快去挑选商品吧～</div>';
    }

    const rows = state.cart.map(it => {
      const subtotal = it.group_price * it.quantity;
      const overStock = it.quantity > it.stock;
      return `
        <tr>
          <td>${it.name}<div class="cell-sub">${it.specification || ''}</div></td>
          <td>¥${formatMoney(it.group_price)}</td>
          <td>
            <div class="qty-control">
              <button class="qty-btn qty-minus" data-id="${it.cart_id}" data-stock="${it.stock}">-</button>
              <input type="number" class="qty-input" data-id="${it.cart_id}" data-stock="${it.stock}" value="${it.quantity}" min="1">
              <button class="qty-btn qty-plus" data-id="${it.cart_id}" data-stock="${it.stock}">+</button>
            </div>
            ${overStock ? '<div class="cell-warn">超过库存</div>' : ''}
          </td>
          <td>¥${formatMoney(subtotal)}</td>
          <td><button class="btn btn-danger btn-sm cart-remove-btn" data-id="${it.cart_id}">删除</button></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="shopping-cart">
        <table class="data-table">
          <thead>
            <tr><th>商品</th><th>单价</th><th>数量</th><th>小计</th><th>操作</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="shopping-cart-footer">
          <div class="cart-summary">
            共 <strong>${cartCount()}</strong> 件商品，合计 <strong class="cart-total">¥${formatMoney(cartTotal())}</strong>
          </div>
          <button class="btn btn-success" id="shop-checkout-btn">提交订单</button>
        </div>
      </div>
    `;
  }

  function render() {
    const container = document.getElementById('module-shopping');
    if (!container) return;
    let body = '';
    if (state.view === 'products') {
      body = renderProducts();
    } else {
      body = renderCart();
    }
    container.innerHTML = renderHeader() + '<div class="shopping-body">' + body + '</div>';
    bindEvents();
  }

  function bindEvents() {
    const userSelect = document.getElementById('shop-user-select');
    if (userSelect) {
      userSelect.addEventListener('change', async (e) => {
        state.currentUserId = parseInt(e.target.value);
        await loadCart();
        render();
      });
    }

    document.getElementById('shop-search-btn')?.addEventListener('click', async () => {
      state.category = document.getElementById('shop-category-input').value.trim();
      state.keyword = document.getElementById('shop-keyword-input').value.trim();
      await loadProducts();
      render();
    });

    document.getElementById('shop-view-products')?.addEventListener('click', () => {
      state.view = 'products';
      render();
    });

    document.getElementById('shop-view-cart')?.addEventListener('click', () => {
      state.view = 'cart';
      render();
    });

    document.querySelectorAll('.add-cart-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!state.currentUserId) {
          showToast('请先选择用户', 'error');
          return;
        }
        const productId = parseInt(btn.dataset.id);
        const res = await api.post('/cart', { user_id: state.currentUserId, product_id: productId, quantity: 1 });
        if (res.success) {
          showToast('已加入购物车');
          await loadCart();
          render();
        } else {
          showToast(res.message || '加入购物车失败', 'error');
        }
      });
    });

    document.querySelectorAll('.qty-minus').forEach(btn => {
      btn.addEventListener('click', () => updateQty(parseInt(btn.dataset.id), -1));
    });
    document.querySelectorAll('.qty-plus').forEach(btn => {
      btn.addEventListener('click', () => updateQty(parseInt(btn.dataset.id), 1));
    });
    document.querySelectorAll('.qty-input').forEach(input => {
      input.addEventListener('change', (e) => {
        let qty = parseInt(e.target.value);
        if (isNaN(qty) || qty < 1) qty = 1;
        setQty(parseInt(input.dataset.id), qty);
      });
    });

    document.querySelectorAll('.cart-remove-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cartId = parseInt(btn.dataset.id);
        const res = await api.delete('/cart/' + cartId);
        if (res.success) {
          showToast('已删除');
          await loadCart();
          render();
        } else {
          showToast(res.message || '删除失败', 'error');
        }
      });
    });

    document.getElementById('shop-checkout-btn')?.addEventListener('click', openCheckout);
  }

  async function updateQty(cartId, delta) {
    const item = state.cart.find(it => it.cart_id === cartId);
    if (!item) return;
    let qty = item.quantity + delta;
    if (qty < 1) qty = 1;
    await setQty(cartId, qty);
  }

  async function setQty(cartId, qty) {
    const item = state.cart.find(it => it.cart_id === cartId);
    if (item && qty > item.stock) {
      showToast('数量不能超过库存', 'error');
      qty = item.stock;
    }
    const res = await api.put('/cart/' + cartId, { quantity: qty });
    if (!res.success) {
      showToast(res.message || '更新失败', 'error');
    }
    await loadCart();
    render();
  }

  function openCheckout() {
    if (state.cart.length === 0) {
      showToast('购物车为空', 'error');
      return;
    }
    const overStock = state.cart.find(it => it.quantity > it.stock);
    if (overStock) {
      showToast(`商品 ${overStock.name} 数量超过库存`, 'error');
      return;
    }

    const pointOptions = state.pickupPoints
      .map(p => `<option value="${p.id}">${p.name}（${p.address || ''}）</option>`)
      .join('');

    const body = `
      <div class="checkout-form">
        <div class="form-group">
          <label>配送方式</label>
          <div class="radio-group">
            <label><input type="radio" name="delivery_type" value="pickup" checked> 到店自提</label>
            <label><input type="radio" name="delivery_type" value="delivery"> 送货上门</label>
          </div>
        </div>
        <div class="form-group" id="pickup-group">
          <label>自提点</label>
          <select id="checkout-pickup">${pointOptions}</select>
        </div>
        <div class="form-group" id="address-group" style="display:none;">
          <label>收货地址</label>
          <textarea id="checkout-address" rows="2" placeholder="请填写详细收货地址"></textarea>
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea id="checkout-remark" rows="2" placeholder="选填"></textarea>
        </div>
        <div class="checkout-summary">
          共 ${cartCount()} 件，合计 <strong>¥${formatMoney(cartTotal())}</strong>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-default" onclick="hideModal()">取消</button>
      <button class="btn btn-primary" id="checkout-submit-btn">确认提交</button>
    `;

    showModal('提交订单', body, footer);

    document.querySelectorAll('input[name="delivery_type"]').forEach(r => {
      r.addEventListener('change', (e) => {
        const isPickup = e.target.value === 'pickup';
        document.getElementById('pickup-group').style.display = isPickup ? '' : 'none';
        document.getElementById('address-group').style.display = isPickup ? 'none' : '';
      });
    });

    document.getElementById('checkout-submit-btn').addEventListener('click', submitOrder);
  }

  async function submitOrder() {
    const deliveryType = document.querySelector('input[name="delivery_type"]:checked').value;
    const remark = document.getElementById('checkout-remark').value.trim();
    let pickupPointId = null;
    let address = null;

    if (deliveryType === 'pickup') {
      pickupPointId = parseInt(document.getElementById('checkout-pickup').value);
    } else {
      address = document.getElementById('checkout-address').value.trim();
      if (!address) {
        showToast('请填写收货地址', 'error');
        return;
      }
    }

    const items = state.cart.map(it => ({ product_id: it.product_id, quantity: it.quantity }));

    const submitBtn = document.getElementById('checkout-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';

    const res = await api.post('/orders', {
      user_id: state.currentUserId,
      items,
      delivery_type: deliveryType,
      pickup_point_id: pickupPointId,
      address,
      remark
    });

    submitBtn.disabled = false;
    submitBtn.textContent = '确认提交';

    if (!res.success) {
      showToast(res.message || '下单失败', 'error');
      return;
    }

    const order = res.data;
    await api.delete('/cart/user/' + state.currentUserId + '/clear');
    await loadCart();
    hideModal();
    showOrderSuccess(order);
  }

  function showOrderSuccess(order) {
    const body = `
      <div class="order-success">
        <div class="order-success-icon">✅</div>
        <div class="order-success-title">订单提交成功</div>
        <div class="order-success-meta">
          <div>订单号：${order.order_no}</div>
          <div>金额：¥${formatMoney(order.total_amount)}</div>
          <div>状态：${statusMap[order.status] || order.status}</div>
          ${order.pickup_code ? `<div>自提核销码：<strong>${order.pickup_code}</strong></div>` : ''}
        </div>
      </div>
    `;
    const footer = `
      <button class="btn btn-default" onclick="hideModal()">稍后支付</button>
      <button class="btn btn-success" id="order-pay-btn" data-id="${order.id}">立即支付</button>
    `;
    showModal('下单成功', body, footer);
    document.getElementById('order-pay-btn').addEventListener('click', payOrder);
  }

  async function payOrder(e) {
    const orderId = parseInt(e.target.dataset.id);
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = '支付中...';
    const res = await api.put('/orders/' + orderId + '/pay');
    btn.disabled = false;
    btn.textContent = '立即支付';
    if (!res.success) {
      showToast(res.message || '支付失败', 'error');
      return;
    }
    const paid = res.data;
    const body = `
      <div class="order-success">
        <div class="order-success-icon">💰</div>
        <div class="order-success-title">支付成功</div>
        <div class="order-success-meta">
          <div>订单号：${paid.order_no}</div>
          <div>金额：¥${formatMoney(paid.total_amount)}</div>
          <div>状态：${statusMap[paid.status] || paid.status}</div>
        </div>
      </div>
    `;
    const footer = `<button class="btn btn-primary" onclick="hideModal()">完成</button>`;
    showModal('支付完成', body, footer);
  }

  async function init() {
    await loadUsers();
    await Promise.all([loadProducts(), loadPickupPoints(), loadCart()]);
    state.view = 'products';
    render();
  }

  return { init };
})();
