const pageTitleMap = {
  'dashboard': '数据总览',
  'products': '商品管理',
  'orders': '订单管理',
  'sorting': '分拣管理',
  'delivery': '配送管理',
  'aftersale': '售后退款',
  'pickup-points': '自提点管理',
  'delivery-staff': '配送员管理',
  'suppliers': '供应商管理'
};

function switchModule(moduleName) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`.nav-item[data-module="${moduleName}"]`).classList.add('active');

  document.querySelectorAll('.module').forEach(mod => {
    mod.classList.remove('active');
  });
  document.getElementById(`module-${moduleName}`).classList.add('active');

  document.getElementById('page-title').textContent = pageTitleMap[moduleName] || '';

  initModule(moduleName);
}

function initModule(moduleName) {
  switch (moduleName) {
    case 'dashboard':
      if (typeof dashboard !== 'undefined' && dashboard.init) {
        dashboard.init();
      }
      break;
    case 'products':
      if (typeof productsModule !== 'undefined' && productsModule.init) {
        productsModule.init();
      }
      break;
    case 'orders':
      if (typeof ordersModule !== 'undefined' && ordersModule.init) {
        ordersModule.init();
      }
      break;
    case 'sorting':
      if (typeof sortingModule !== 'undefined' && sortingModule.init) {
        sortingModule.init();
      }
      break;
    case 'delivery':
      if (typeof deliveryModule !== 'undefined' && deliveryModule.init) {
        deliveryModule.init();
      }
      break;
    case 'aftersale':
      if (typeof aftersaleModule !== 'undefined' && aftersaleModule.init) {
        aftersaleModule.init();
      }
      break;
    case 'pickup-points':
      if (typeof pickupPointsModule !== 'undefined' && pickupPointsModule.init) {
        pickupPointsModule.init();
      }
      break;
    case 'delivery-staff':
      if (typeof deliveryStaffModule !== 'undefined' && deliveryStaffModule.init) {
        deliveryStaffModule.init();
      }
      break;
    case 'suppliers':
      if (typeof suppliersModule !== 'undefined' && suppliersModule.init) {
        suppliersModule.init();
      }
      break;
  }
}

function initApp() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const moduleName = item.dataset.module;
      switchModule(moduleName);
    });
  });

  initModule('dashboard');
}

document.addEventListener('DOMContentLoaded', initApp);
