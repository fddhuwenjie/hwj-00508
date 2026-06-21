const dashboard = {
  init() {
    this.renderLayout();
    this.loadAllData();
  },

  renderLayout() {
    const container = document.getElementById('module-dashboard');
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-title">今日GMV</div>
          <div class="stat-value" id="stat-gmv">--</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">今日订单数</div>
          <div class="stat-value" id="stat-orders">--<span class="stat-unit">单</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-title">客单价</div>
          <div class="stat-value" id="stat-avg">--</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">退款率</div>
          <div class="stat-value" id="stat-refund">--<span class="stat-unit">%</span></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">商品销量排行</div>
        <div id="product-ranking-chart" class="chart-container"><div class="empty">加载中...</div></div>
      </div>
      <div class="card">
        <div class="card-title">未提货订单</div>
        <div id="unpicked-orders-table"><div class="empty">加载中...</div></div>
      </div>
    `;
  },

  async loadAllData() {
    const [overviewRes, productsRes, unpickedRes] = await Promise.all([
      api.get('/stats/overview'),
      api.get('/stats/products', { limit: 10 }),
      api.get('/stats/unpicked-orders')
    ]);

    if (overviewRes.success) {
      this.renderStatsCards(overviewRes.data);
    }
    if (productsRes.success) {
      this.renderProductRanking(productsRes.data);
    }
    if (unpickedRes.success) {
      this.renderUnpickedOrders(unpickedRes.data.list);
    }
  },

  renderStatsCards(data) {
    const gmvEl = document.getElementById('stat-gmv');
    const ordersEl = document.getElementById('stat-orders');
    const avgEl = document.getElementById('stat-avg');
    const refundEl = document.getElementById('stat-refund');

    if (gmvEl) gmvEl.innerHTML = `¥${formatMoney(data.gmv)}`;
    if (ordersEl) ordersEl.innerHTML = `${data.order_count}<span class="stat-unit">单</span>`;
    if (avgEl) avgEl.innerHTML = `¥${formatMoney(data.avg_order_value)}`;
    if (refundEl) refundEl.innerHTML = `${data.refund_rate}<span class="stat-unit">%</span>`;
  },

  renderProductRanking(products) {
    const container = document.getElementById('product-ranking-chart');
    if (!container) return;

    if (!products || products.length === 0) {
      container.innerHTML = '<div class="empty">暂无数据</div>';
      return;
    }

    const maxQty = Math.max(...products.map(p => p.sales_quantity));
    let html = '';
    products.forEach(p => {
      const height = maxQty > 0 ? (p.sales_quantity / maxQty) * 240 : 0;
      const name = p.product_name.length > 6 ? p.product_name.slice(0, 6) + '...' : p.product_name;
      html += `
        <div class="chart-bar">
          <div class="bar" style="height: ${height}px;">
            <span class="bar-value">${p.sales_quantity}</span>
          </div>
          <span class="bar-label" title="${p.product_name}">${name}</span>
        </div>
      `;
    });
    container.innerHTML = html;
  },

  renderUnpickedOrders(orders) {
    const container = document.getElementById('unpicked-orders-table');
    if (!container) return;

    if (!orders || orders.length === 0) {
      container.innerHTML = '<div class="empty">暂无未提货订单</div>';
      return;
    }

    let html = '<table><thead><tr><th>订单号</th><th>用户</th><th>联系电话</th><th>自提点</th><th>金额</th><th>提货日期</th></tr></thead><tbody>';
    orders.forEach(order => {
      html += `
        <tr>
          <td>${order.order_no}</td>
          <td>${order.nickname || order.username || '-'}</td>
          <td>${order.user_phone || '-'}</td>
          <td>${order.pickup_point_name || '-'}</td>
          <td>¥${formatMoney(order.total_amount)}</td>
          <td>${order.pickup_date || '-'}</td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }
};
