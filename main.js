'use strict';

/* ========================================
   KONFIG
======================================== */
const BACKEND_URL = "https://popn1shop.onrender.com";
const MANIFEST_URL = window.REDEPOP_MANIFEST_URL || "./manifest.json";

/* ========================================
   PERFORMANCE OPTIMIZATION CONFIGS
======================================== */
const VALIDATION_DEBOUNCE_MS = 500; // Wait 500ms after user stops typing
const VALIDATION_CACHE_DURATION_MS = 5 * 60 * 1000; // Cache for 5 minutes
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout

/* ========================================
   DYNAMIC CONFIGURATION
======================================== */
// Dynamic color schemes - Fixed to POPN1 purple theme
const COLOR_SCHEMES = [
  { primary: '#412573', secondary: '#140e26' }, // POPN1 Purple Theme
];

/* ========================================
   VALIDATION CACHE & PERFORMANCE
======================================== */
const validationCache = new Map();
let validationDebounceTimer = null;
let currentValidationController = null;

// Cache management
function getCachedValidation(productId, secretCode) {
  const key = `${productId}:${secretCode}`;
  const cached = validationCache.get(key);
  
  if (cached && (Date.now() - cached.timestamp < VALIDATION_CACHE_DURATION_MS)) {
    return cached.result;
  }
  
  return null;
}

function setCachedValidation(productId, secretCode, result) {
  const key = `${productId}:${secretCode}`;
  validationCache.set(key, {
    result,
    timestamp: Date.now()
  });
  
  // Limit cache size
  if (validationCache.size > 100) {
    const firstKey = validationCache.keys().next().value;
    validationCache.delete(firstKey);
  }
}

// Optimized validation with debounce and cache
async function validateSecretCode(productId, secretCode) {
  // Check cache first
  const cached = getCachedValidation(productId, secretCode);
  if (cached) {
    console.log('✅ Using cached validation result');
    return cached;
  }
  
  // Cancel any pending request
  if (currentValidationController) {
    currentValidationController.abort();
  }
  
  // Create new abort controller
  currentValidationController = new AbortController();
  const signal = currentValidationController.signal;
  
  try {
    // Race between fetch and timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), REQUEST_TIMEOUT_MS)
    );
    
    const fetchPromise = fetch(
      `${BACKEND_URL}/validate?product_id=${encodeURIComponent(productId)}&secret_code=${encodeURIComponent(secretCode)}`,
      { signal }
    );
    
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    const result = await res.json();
    
    // Cache successful validation
    setCachedValidation(productId, secretCode, result);
    
    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('❌ Request cancelled');
      throw new Error('cancelled');
    }
    throw err;
  }
}

/* ========================================
   UTILITY FUNCTIONS
======================================== */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function setRandomColorScheme() {
  // Always use the POPN1 purple theme
  document.documentElement.style.setProperty('--dynamic-primary', '#412573');
  document.documentElement.style.setProperty('--dynamic-secondary', '#140e26');
  document.documentElement.style.setProperty('--dynamic-gradient', 
    `linear-gradient(135deg, #412573, #140e26)`);
}

function createIntersectionObserver() {
  return new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.classList.add('loading');
          img.src = img.dataset.src;
          img.onload = () => {
            img.classList.remove('loading');
            img.classList.add('loaded');
          };
          img.removeAttribute('data-src');
        }
      }
    });
  }, { 
    rootMargin: '50px',
    threshold: 0.1 
  });
}

/* ========================================
   DOM ELEMENTS
======================================== */
const orderModal = document.getElementById('orderModal');
const orderModalCloseBtn = document.getElementById('orderModalCloseBtn');
const orderForm = document.getElementById('orderForm');
const orderSubmitBtn = document.getElementById('orderSubmitBtn');
const orderFormMessage = document.getElementById('orderFormMessage');
const catalog = document.getElementById('catalog');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialized after DOM ready
let platformSelect;
let gameIdInput;

/* ========================================
   UTIL: UPDATE INFO MODAL
======================================== */
function updateOrderProductInfo(name, img, secret) {
  document.getElementById('orderProductName').textContent = name || '';
  document.getElementById('orderProductImg').src = img || '';
  document.getElementById('orderProductId').value = secret || '';
}

/* ========================================
   ENHANCED ELEMENT CREATION
======================================== */
function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  return node;
}

function buildProductCard({ src, name, secret, isExtra, isFeatured }, index) {
  const cardClass = `product-card${isExtra ? ' extra-product' : ''}${isFeatured ? ' featured' : ''}`;
  const card = el('div', cardClass, { 'data-secret': secret });
  
  // Add animation delay
  card.style.animationDelay = `${index * 0.1}s`;
  
  // Featured badge
  if (isFeatured) {
    const badge = el('div', 'featured-badge', { text: '⭐' });
    card.appendChild(badge);
  }
  
  // Lazy loading image
  const img = el('img', 'product-img', { 
    'data-src': src, 
    alt: name,
    loading: 'lazy'
  });
  
  const title = el('div', 'product-name', { text: name });
  
  card.appendChild(img);
  card.appendChild(title);
  
  if (isExtra) card.hidden = true;
  
  return card;
}

function buildTierSection(tier, baseUrl) {
  const section = el('section', 'reward-tier', { 'data-tier': tier.id });
  
  // Animation delay for tiers
  const tierIndex = parseInt(tier.id.split('-')[1]) || 1;
  section.style.animationDelay = `${tierIndex * 0.2}s`;
  
  const header = el('div', 'tier-header', { text: tier.label || tier.id });
  section.appendChild(header);
  
  const grid = el('div', 'product-grid');
  section.appendChild(grid);
  
  const showFirst = Number.isInteger(tier.showFirst) ? tier.showFirst : 6;
  let items = Array.isArray(tier.items) ? tier.items : [];

  // === NEW PINNED LOGIC ===
  // 1. Preserve the order of pinned items exactly as they appear in the manifest
  const pinned = items.filter(it => it.pinned);
  // 2. Randomize only the non-pinned items
  let others = items.filter(it => !it.pinned);
  others = shuffleArray(others);
  // 3. Recombine: pinned first, then randomized others
  items = [...pinned, ...others];
  // ========================

  // Select random featured products (1–2 among the VISIBLE (non-extra) group)
  const visibleCount = Math.min(showFirst, items.length);
  const featuredCount = Math.floor(Math.random() * 2) + 1;
  const featuredIndices = new Set();
  while (featuredIndices.size < Math.min(featuredCount, visibleCount)) {
    featuredIndices.add(Math.floor(Math.random() * visibleCount));
  }
  
  items.forEach((item, idx) => {
    const src = item.url ? item.url : (baseUrl + item.file);
    const name = item.name || item.file || item.url || 'Produto';
    const isExtra = idx >= showFirst;
    const isFeatured = featuredIndices.has(idx) && !isExtra;
    
    const card = buildProductCard({ src, name, secret: tier.id, isExtra, isFeatured }, idx);
    grid.appendChild(card);
  });
  
  if (items.length > showFirst) {
    const btn = el('button', 'veja-mais-btn', { 'data-tier': tier.id });
    btn.appendChild(el('span', 'btn-text', { text: 'VEJA MAIS' }));
    btn.appendChild(el('span', 'arrow-icon', { html: '&#9660;' }));
    section.appendChild(btn);
  }
  
  return section;
}

/* ========================================
   ENHANCED CATALOG LOADING
======================================== */
async function loadCatalog() {
  try {
    // Always use POPN1 purple theme
    setRandomColorScheme();
    
    // Show loading
    if (loadingOverlay) {
      loadingOverlay.style.display = 'flex';
    }
    
    // Simulate minimum loading time for smooth UX
    const [response] = await Promise.all([
      fetch(MANIFEST_URL, { cache: 'force-cache' }), // Use cache for faster loading
      new Promise(resolve => setTimeout(resolve, 800)) // Reduced to 800ms
    ]);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const manifest = await response.json();
    const baseUrl = (manifest.baseUrl || '').trim();
    const tiers = Array.isArray(manifest.tiers) ? manifest.tiers : [];
    
    catalog.innerHTML = '';
    
    // Create intersection observer for lazy loading
    const imageObserver = createIntersectionObserver();
    
    tiers.forEach(tier => {
      const tierSection = buildTierSection(tier, baseUrl);
      catalog.appendChild(tierSection);
      
      // Setup lazy loading for images in this tier
      const images = tierSection.querySelectorAll('.product-img[data-src]');
      images.forEach(img => imageObserver.observe(img));
    });
    
    // Hide loading overlay
    if (loadingOverlay) {
      setTimeout(() => {
        loadingOverlay.classList.add('hidden');
        setTimeout(() => {
          loadingOverlay.style.display = 'none';
        }, 300);
      }, 300);
    }
    
  } catch (err) {
    console.error('Gagal memuat manifest:', err);
    catalog.innerHTML = '<p style="color:#00ccff;text-align:center;padding:20px;">Falha ao carregar catálogo. Tente novamente mais tarde.</p>';
    
    // Hide loading overlay even on error
    if (loadingOverlay) {
      setTimeout(() => {
        loadingOverlay.classList.add('hidden');
        setTimeout(() => {
          loadingOverlay.style.display = 'none';
        }, 300);
      }, 300);
    }
  }
}

/* ========================================
   Handle Product Card Click
======================================== */
document.addEventListener('click', e => {
  const card = e.target.closest('.product-card');
  if (card && !card.hidden) {
    const name = card.querySelector('.product-name').textContent;
    const src = card.querySelector('.product-img').src || card.querySelector('.product-img').dataset.src;
    const secret = card.dataset.secret;
    updateOrderProductInfo(name, src, secret);
    orderModal.classList.add('active');
  }
});

/* ========================================
   Handle "Veja Mais" Click
======================================== */
document.addEventListener('click', e => {
  const btn = e.target.closest('.veja-mais-btn');
  if (btn) {
    const tierId = btn.dataset.tier;
    const grid = document.querySelector(`[data-tier="${tierId}"] .product-grid`);
    const cards = grid.querySelectorAll('.product-card.extra-product');
    
    const allVisible = Array.from(cards).every(card => !card.hidden);
    
    if (allVisible) {
      cards.forEach(card => { card.hidden = true; });
      btn.querySelector('.btn-text').textContent = 'VEJA MAIS';
      btn.querySelector('.arrow-icon').innerHTML = '&#9660;';
    } else {
      cards.forEach(card => { card.hidden = false; });
      btn.querySelector('.btn-text').textContent = 'VEJA MENOS';
      btn.querySelector('.arrow-icon').innerHTML = '&#9650;';
    }
  }
});

/* ========================================
   Close Modal
======================================== */
if (orderModalCloseBtn) {
  orderModalCloseBtn.addEventListener('click', () => {
    orderModal.classList.remove('active');
  });
}
if (orderModal) {
  orderModal.addEventListener('click', e => {
    if (e.target === orderModal) {
      orderModal.classList.remove('active');
    }
  });
}

/* ========================================
   CPF Validation
======================================== */
let isCPFValid = false;

function validateCPF(cpfStr) {
  const cpf = cpfStr.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let check1 = (sum * 10) % 11;
  if (check1 === 10) check1 = 0;
  if (check1 !== parseInt(cpf[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let check2 = (sum * 10) % 11;
  if (check2 === 10) check2 = 0;
  if (check2 !== parseInt(cpf[10])) return false;
  
  return true;
}

/* ========================================
   Platform and Game ID Validation
======================================== */
function applyGameIdRules() {
  if (!platformSelect || !gameIdInput) return;
  
  const platform = platformSelect.value;
  
  if (platform === 'POPN1') {
    gameIdInput.placeholder = 'Ex. 123456789012 (12 dígitos)';
    gameIdInput.maxLength = 12;
  } else {
    gameIdInput.placeholder = 'Selecione a plataforma para ver o formato';
    gameIdInput.maxLength = 12;
  }
}

function validateGameId() {
  if (!platformSelect || !gameIdInput) return false;
  
  const platform = platformSelect.value;
  const gameId = gameIdInput.value.trim();
  
  if (platform === 'POPN1') {
    return /^\d{12}$/.test(gameId);
  }
  
  return false;
}

/* ========================================
   Secret Code Validation (OPTIMIZED)
======================================== */
let isSecretCodeValid = false;
const secretCodeInput = document.getElementById('secretCode');
const secretCodeStatus = document.getElementById('secretCodeStatus');

function showSpinner() {
  if (!secretCodeStatus) return;
  secretCodeStatus.innerHTML = `
    <svg viewBox="0 0 50 50" style="width:20px;height:20px;animation:spin 1s linear infinite">
      <circle cx="25" cy="25" r="20" fill="none" stroke="#00ccff" stroke-width="4" stroke-dasharray="31.415 31.415" stroke-linecap="round">
      </circle>
    </svg>
  `;
}

function showCheck() {
  if (!secretCodeStatus) return;
  secretCodeStatus.innerHTML = `<ion-icon name="checkmark-circle" style="color:#28c650;font-size:1.6em"></ion-icon>`;
}

function showWarning() {
  if (!secretCodeStatus) return;
  secretCodeStatus.innerHTML = `<ion-icon name="warning" style="color:#00ccff;font-size:1.6em"></ion-icon>`;
}

function clearStatus() {
  if (!secretCodeStatus) return;
  secretCodeStatus.innerHTML = "";
}

if (secretCodeInput) {
  secretCodeInput.addEventListener('input', function () {
    const secretCode = this.value.trim();
    const productId = document.getElementById('orderProductId').value;

    // Reset validation state immediately
    isSecretCodeValid = false;
    updateOrderSubmitBtn();

    // Clear any existing debounce timer
    if (validationDebounceTimer) {
      clearTimeout(validationDebounceTimer);
    }

    // Clear status and message if input is too short
    if (secretCode.length <= 4) {
      isSecretCodeValid = false;
      orderFormMessage.textContent = '';
      clearStatus();
      updateOrderSubmitBtn();
      return;
    }

    if (!productId) {
      orderFormMessage.textContent = 'Selecione um produto primeiro';
      orderFormMessage.style.color = '#00ccff';
      clearStatus();
      return;
    }

    // Show instant feedback that we're preparing to validate
    orderFormMessage.textContent = 'Preparando validação...';
    orderFormMessage.style.color = '#fff';
    showSpinner();

    // Debounce the validation
    validationDebounceTimer = setTimeout(async () => {
      orderFormMessage.textContent = 'Validando código...';
      
      try {
        const result = await validateSecretCode(productId, secretCode);
        
        if (result.status === "valid") {
          isSecretCodeValid = true;
          orderFormMessage.textContent = '✓ Código válido! Você pode enviar.';
          orderFormMessage.style.color = '#28c650';
          showCheck();
        } else if (result.status === "used") {
          isSecretCodeValid = false;
          orderFormMessage.textContent = '⚠️ Código já foi utilizado!';
          orderFormMessage.style.color = '#00ccff';
          showWarning();
        } else {
          isSecretCodeValid = false;
          orderFormMessage.textContent = '✗ Código inválido!';
          orderFormMessage.style.color = '#00ccff';
          showWarning();
        }
      } catch (err) {
        if (err.message === 'cancelled') {
          // Request was cancelled, do nothing
          return;
        }
        
        isSecretCodeValid = false;
        if (err.message === 'Timeout') {
          orderFormMessage.textContent = '⏱️ Conexão lenta. Tente novamente.';
        } else {
          orderFormMessage.textContent = '❌ Erro ao validar. Tente novamente.';
        }
        orderFormMessage.style.color = '#00ccff';
        showWarning();
      }
      
      updateOrderSubmitBtn();
    }, VALIDATION_DEBOUNCE_MS);
  });
}

/* ========================================
   Submit Order
======================================== */
if (orderForm) {
  orderForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    // Validasi terakhir sebelum kirim
    if (!orderForm.checkValidity() || !isCPFValid || !isSecretCodeValid) {
      orderForm.reportValidity();
      orderFormMessage.textContent = 'Verifique os campos e tente novamente.';
      orderFormMessage.style.color = '#00ccff';
      orderSubmitBtn.disabled = false;
      return;
    }

    orderSubmitBtn.disabled = true;
    orderFormMessage.textContent = 'Enviando pedido...';
    orderFormMessage.style.color = '#fff';

    const productName = document.getElementById('orderProductName').textContent.trim();
    const productImg = document.getElementById('orderProductImg').src;
    if (!productName) {
      orderFormMessage.textContent = "Erro: Produto não detectado.";
      orderFormMessage.style.color = "#00ccff";
      orderSubmitBtn.disabled = false;
      return;
    }

    const data = {
      productId: document.getElementById('orderProductId').value,
      productName,
      productImg,
      fullName: document.getElementById('fullName').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      zip: document.getElementById('zip').value.trim(),
      state: document.getElementById('state').value,
      city: document.getElementById('city').value,
      address: document.getElementById('address').value.trim(),
      neighborhood: document.getElementById('neighborhood').value.trim(),
      street: document.getElementById('street').value.trim(),
      number: document.getElementById('number').value.trim(),
      platform: document.getElementById('platform').value,
      gameId: document.getElementById('gameId').value.trim(),
      cpf: document.getElementById('cpf').value.trim(),
      secretCode: document.getElementById('secretCode').value.trim()
    };

    try {
      // Add timeout to order submission
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(`${BACKEND_URL}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      const result = await response.json();
      
      if (result.status === 'success') {
        orderFormMessage.textContent = '✓ Pedido enviado com sucesso! Entraremos em contato em breve.';
        orderFormMessage.style.color = '#28c650';
        
        // Clear cache for this code since it's now used
        const cachedKey = `${data.productId}:${data.secretCode}`;
        validationCache.delete(cachedKey);
        
        setTimeout(() => {
          orderModal.classList.remove('active');
          orderForm.reset();
          orderSubmitBtn.disabled = true;
          orderFormMessage.textContent = '';
          isSecretCodeValid = false;
          isCPFValid = false;
          clearStatus();
        }, 2500);
      } else {
        orderFormMessage.textContent = result.message || 'Erro ao enviar pedido. Tente novamente.';
        orderFormMessage.style.color = '#00ccff';
        orderSubmitBtn.disabled = false;
      }
    } catch (err) {
      console.error('Erro ao enviar pedido:', err);
      if (err.name === 'AbortError') {
        orderFormMessage.textContent = '⏱️ Tempo esgotado. Verifique sua conexão e tente novamente.';
      } else {
        orderFormMessage.textContent = '❌ Erro ao enviar. Verifique sua conexão.';
      }
      orderFormMessage.style.color = '#00ccff';
      orderSubmitBtn.disabled = false;
    }
  });
}

function updateOrderSubmitBtn() {
  if (orderSubmitBtn && orderForm) {
    orderSubmitBtn.disabled = !(orderForm.checkValidity() && isCPFValid && isSecretCodeValid);
  }
}

/* ========================================
   DOM READY SETUP
======================================== */
document.addEventListener('DOMContentLoaded', () => {
  platformSelect = document.getElementById('platform');
  gameIdInput = document.getElementById('gameId');

  // Setup CPF validation
  const cpfInput = document.getElementById('cpf');
  if (cpfInput) {
    function validateAndUpdateCPF() {
      if (!validateCPF(cpfInput.value)) {
        isCPFValid = false;
        orderFormMessage.textContent = 'CPF inválido!';
        orderFormMessage.style.color = '#00ccff';
      } else {
        isCPFValid = true;
        if (orderFormMessage.textContent === 'CPF inválido!') {
          orderFormMessage.textContent = '';
          orderFormMessage.style.color = '';
        }
      }
      updateOrderSubmitBtn();
    }
    
    cpfInput.addEventListener('blur', validateAndUpdateCPF);
    cpfInput.addEventListener('input', validateAndUpdateCPF);
  }

  // Setup platform and game ID validation
  if (platformSelect) {
    platformSelect.addEventListener('change', () => {
      applyGameIdRules();
      updateOrderSubmitBtn();
    });
  }

  if (gameIdInput) {
    gameIdInput.addEventListener('input', () => {
      validateGameId();
      updateOrderSubmitBtn();
    });
  }

  // Initialize game ID rules
  applyGameIdRules();
  
  // Load catalog
  loadCatalog();
});

/* ========================================
   PERFORMANCE OPTIMIZATIONS
======================================== */
// Throttle scroll events for better performance
let ticking = false;
function updateOnScroll() {
  // Add any scroll-based animations here
  ticking = false;
}

document.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(updateOnScroll);
    ticking = true;
  }
});

// Preload critical images
const criticalImages = [
  'https://i.ibb.co/BHYkmXfs/Whatsapp-Transparent.gif',
  'https://i.ibb.co/s9x87GHJ/Telegram-logo.gif'
];

criticalImages.forEach(src => {
  const img = new Image();
  img.src = src;
});
