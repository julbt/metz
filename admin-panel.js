/* ===================================
   Admin Panel - Main JavaScript
   Connecté à l'API Shopify
   ================================ */

const API_URL = 'https://myflowers-shop.fr/api';

// Admin user data (from Shopify login)
let adminUser = null;

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    verifyAdminSession().then(valid => {
        if (valid) {
            document.body.style.display = '';
            initAdminPanel();
        }
    }).catch(error => {
        console.error('Admin session verification error:', error);
        // Show page with error message instead of blank page
        document.body.style.display = '';
        document.body.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; text-align: center; padding: 2rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
                <h1 style="color: #1f2937; margin-bottom: 0.5rem;">Erreur de connexion</h1>
                <p style="color: #6b7280; margin-bottom: 1.5rem;">Impossible de vérifier votre session admin.<br>Le serveur backend est peut-être hors ligne.</p>
                <div style="display: flex; gap: 1rem;">
                    <button onclick="location.reload()" style="padding: 0.75rem 1.5rem; background: #5B1013; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem;">
                        <i class="fas fa-redo"></i> Réessayer
                    </button>
                    <a href="compte.html" style="padding: 0.75rem 1.5rem; background: #6b7280; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; text-decoration: none;">
                        <i class="fas fa-arrow-left"></i> Retour
                    </a>
                </div>
            </div>
        `;
    });
});

// Verify admin session - check if user is logged in and is admin
async function verifyAdminSession() {
    // Check if user is logged in via Shopify
    const userStr = localStorage.getItem('fleuriste_user');
    if (!userStr) {
        window.location.replace('compte.html');
        return false;
    }
    
    try {
        const user = JSON.parse(userStr);
        
        // Verify with backend that this email is an admin
        const response = await fetch(`${API_URL}/admin/check-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email })
        });
        
        if (!response.ok) {
            window.location.replace('compte.html');
            return false;
        }
        
        const data = await response.json();
        if (!data.isAdmin) {
            // Not an admin - redirect to home
            window.location.replace('index.html');
            return false;
        }
        
        // User is admin
        adminUser = user;
        return true;
        
    } catch (error) {
        console.error('Session verification failed:', error);
        window.location.replace('compte.html');
        return false;
    }
}

// Admin logout function - just clear Shopify session
function adminLogout() {
    localStorage.removeItem('fleuriste_user');
    window.location.href = 'compte.html';
}

function initAdminPanel() {
    // Navigation
    setupNavigation();
    
    // Header interactions
    setupHeader();
    
    // Dashboard
    loadDashboardData();
    
    // Orders
    loadOrders();
}

// ===================================
// NAVIGATION
// ===================================

function setupNavigation() {
    const navItems = document.querySelectorAll('.admin-nav-item[data-section]');
    const sections = document.querySelectorAll('.admin-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            const sectionId = item.getAttribute('data-section');
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show corresponding section
            sections.forEach(section => section.classList.remove('active'));
            const targetSection = document.getElementById(sectionId + 'Section');
            if (targetSection) {
                targetSection.classList.add('active');
                
                // Load data for the section if needed
                if (sectionId === 'orders') {
                    loadOrders();
                } else if (sectionId === 'collections') {
                    // Collections are loaded by collections-manager.js
                } else if (sectionId === 'products') {
                    // Products are loaded by products-manager.js
                }
            }
        });
    });

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('adminSidebar');
    const adminLayout = document.querySelector('.admin-layout');

    // Sidebar open/close helpers
    function openSidebarFn() {
        sidebar.classList.add('active');
        sidebar.classList.remove('collapsed');
    }

    function closeSidebarFn() {
        sidebar.classList.remove('active');
    }

    sidebarToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sidebar.classList.contains('active')) {
            closeSidebarFn();
        } else {
            openSidebarFn();
        }
    });

    // Overlay click closes sidebar
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebarFn);
    }

    // Close sidebar when clicking on nav items (mobile)
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeSidebarFn();
            }
        });
    });

    // Close sidebar when clicking outside on mobile (with delay to avoid same-click conflict)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && sidebar.classList.contains('active')) {
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                closeSidebarFn();
            }
        }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            closeSidebarFn();
        }
    });

    // View all links in dashboard
    document.querySelectorAll('.view-all[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionNav = document.querySelector(`.admin-nav-item[data-section="${link.dataset.section}"]`);
            sectionNav?.click();
        });
    });

    // Show dashboard by default
    document.querySelector('.admin-nav-item[data-section="dashboard"]')?.classList.add('active');
    document.getElementById('dashboardSection')?.classList.add('active');
}

// ===================================
// HEADER
// ===================================

function setupHeader() {
    // User menu - toggle active on PARENT container (CSS uses .admin-user-menu.active)
    const userMenuContainer = document.querySelector('.admin-user-menu');
    const userMenuBtn = document.querySelector('.user-menu-btn');
    const userMenuDropdown = document.querySelector('.user-menu-dropdown');

    if (userMenuBtn && userMenuContainer) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenuContainer.classList.toggle('active');
            
            // Close notifications if open
            const notifContainer = document.querySelector('.admin-notifications');
            if (notifContainer) {
                notifContainer.classList.remove('active');
            }
        });
    }

    // Prevent closing when clicking inside user menu dropdown
    if (userMenuDropdown) {
        userMenuDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Notifications - toggle active on PARENT container (CSS uses .admin-notifications.active)
    const notifContainer = document.querySelector('.admin-notifications');
    const notifBtn = document.querySelector('.notifications-btn');
    const notifDropdown = document.querySelector('.notifications-dropdown');

    if (notifBtn && notifContainer) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifContainer.classList.toggle('active');
            
            // Close user menu if open
            if (userMenuContainer) {
                userMenuContainer.classList.remove('active');
            }
        });
    }

    // Prevent closing when clicking inside notifications dropdown
    if (notifDropdown) {
        notifDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (userMenuContainer && !userMenuContainer.contains(e.target) && userMenuContainer.classList.contains('active')) {
            userMenuContainer.classList.remove('active');
        }
        if (notifContainer && !notifContainer.contains(e.target) && notifContainer.classList.contains('active')) {
            notifContainer.classList.remove('active');
        }
    });


    // View site button
    document.getElementById('viewSiteBtn')?.addEventListener('click', () => {
        window.open('index.html', '_blank');
    });

    document.getElementById('viewSiteBtnMenu')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('index.html', '_blank');
    });

    // Click on logo or 'My Flowers' branding: go to public homepage
    document.getElementById('adminBrandingHome')?.addEventListener('click', () => {
        window.open('index.html', '_blank');
    });

    // Logout
    document.getElementById('adminLogout')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            adminLogout();
        }
    });

    // Load admin name
    loadAdminInfo();
}

function loadAdminInfo() {
    // Use admin user from session, not fleuriste_user
    const user = adminUser || JSON.parse(localStorage.getItem('admin_user') || '{}');
    const adminName = document.getElementById('adminUserName');
    if (adminName) {
        adminName.textContent = user.name || user.email || 'Admin';
    }
}

// ===================================
// DASHBOARD
// ===================================

async function loadDashboardData() {
    // Load stats from Shopify
    await loadStats();
    
    // Load recent orders from Shopify
    await loadRecentOrders();
    
    // Load real notifications & alerts from Shopify data
    await loadNotifications();
    await loadDashboardAlerts();
    
    // Quick actions
    setupQuickActions();
}

async function loadStats() {
    try {
        // Fetch orders from Shopify
        const response = await fetch(`${API_URL}/orders?limit=250`);
        const data = await response.json();
        
        if (data.orders) {
            const orders = data.orders;
            
            // Calculate stats
            let totalRevenue = 0;
            let orderCount = orders.length;
            
            orders.forEach(order => {
                if (order.financial_status === 'paid') {
                    totalRevenue += parseFloat(order.total_price || 0);
                }
            });
            
            const avgOrder = orderCount > 0 ? totalRevenue / orderCount : 0;
            
            // Update UI
            document.getElementById('statRevenue').textContent = totalRevenue.toFixed(2) + ' €';
            document.getElementById('statOrders').textContent = orderCount;
            document.getElementById('statAvgOrder').textContent = avgOrder.toFixed(2) + ' €';
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        // Set default values
        document.getElementById('statRevenue').textContent = '0.00 €';
        document.getElementById('statOrders').textContent = '0';
        document.getElementById('statAvgOrder').textContent = '0.00 €';
    }
}

async function loadRecentOrders() {
    const recentOrdersList = document.getElementById('recentOrdersAdmin');
    if (!recentOrdersList) return;

    try {
        const response = await fetch(`${API_URL}/orders?limit=5`);
        const data = await response.json();
        
        if (data.orders && data.orders.length > 0) {
            recentOrdersList.innerHTML = data.orders.map(order => {
                const date = new Date(order.created_at);
                
                // Calcul précis du statut financier
                let status = 'Non payée';
                let statusClass = 'pending';
                if (order.financial_status === 'paid') { status = 'Payée'; statusClass = 'fulfilled'; }
                else if (order.financial_status === 'refunded') { status = 'Remboursée'; statusClass = 'unfulfilled'; }
                else if (order.financial_status === 'partially_refunded') { status = 'Remb. partiel'; statusClass = 'unfulfilled'; }
                else if (order.financial_status === 'pending') { status = 'En attente'; statusClass = 'pending'; }
                
                return `
                    <tr>
                        <td>#${order.order_number || order.id}</td>
                        <td>${order.customer?.first_name || 'Client'} ${order.customer?.last_name || ''}</td>
                        <td>${date.toLocaleDateString('fr-FR')}</td>
                        <td>${parseFloat(order.total_price || 0).toFixed(2)} €</td>
                        <td><span class="order-status ${statusClass}">${status}</span></td>
                    </tr>
                `;
            }).join('');
        } else {
            recentOrdersList.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280;">
                        Aucune commande récente
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error loading recent orders:', error);
        recentOrdersList.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #ef4444;">
                    Erreur de chargement des commandes
                </td>
            </tr>
        `;
    }
}

function setupQuickActions() {
    // Quick action buttons
    const quickActions = document.querySelectorAll('.quick-action-btn[data-action]');
    
    quickActions.forEach(action => {
        action.addEventListener('click', (e) => {
            e.preventDefault();
            const actionType = action.dataset.action;
            
            switch(actionType) {
                case 'new-category':
                case 'new-collection':
                    document.getElementById('addCollectionBtn')?.click();
                    break;
                case 'manage-categories':
                case 'manage-collections':
                    document.querySelector('.admin-nav-item[data-section="collections"]')?.click();
                    break;
                case 'process-orders':
                case 'view-orders':
                    document.querySelector('.admin-nav-item[data-section="orders"]')?.click();
                    break;
                case 'shopify-admin':
                    window.open('https://admin.shopify.com/store/myflowers-secours', '_blank');
                    break;
            }
        });
    });
}

// ===================================
// NOTIFICATIONS (real data from Shopify)
// ===================================

async function loadNotifications() {
    const notifList = document.getElementById('notificationsList');
    const notifBadge = document.getElementById('notifBadge');
    if (!notifList) return;

    try {
        // Fetch recent orders and products in parallel
        const [ordersRes, productsRes] = await Promise.all([
            fetch(`${API_URL}/orders?limit=10`).then(r => r.json()).catch(() => ({ orders: [] })),
            fetch(`${API_URL}/products?limit=100`).then(r => r.json()).catch(() => ({ products: [] }))
        ]);

        const orders = ordersRes.orders || [];
        const products = productsRes.products || [];
        const notifications = [];

        // Generate notifications from recent orders
        orders.slice(0, 5).forEach(order => {
            const date = new Date(order.created_at);
            notifications.push({
                icon: 'fa-shopping-bag',
                title: `Commande #${order.order_number || order.id}`,
                text: `${order.customer?.first_name || 'Client'} ${order.customer?.last_name || ''} - ${parseFloat(order.total_price || 0).toFixed(2)}€`,
                time: timeAgo(date),
                type: 'order'
            });
        });

        // Generate notifications from low-stock products
        products.forEach(product => {
            (product.variants || []).forEach(variant => {
                const qty = variant.inventory_quantity;
                if (qty !== undefined && qty !== null && qty <= 5 && qty >= 0) {
                    notifications.push({
                        icon: 'fa-exclamation-triangle',
                        title: 'Stock faible',
                        text: `${product.title}${variant.title !== 'Default Title' ? ' - ' + variant.title : ''} : ${qty} unité${qty > 1 ? 's' : ''} restante${qty > 1 ? 's' : ''}`,
                        time: '',
                        type: 'warning'
                    });
                }
            });
        });

        // Unfulfilled orders notifications
        const unfulfilled = orders.filter(o => !o.fulfillment_status || o.fulfillment_status === 'unfulfilled');
        if (unfulfilled.length > 0) {
            notifications.push({
                icon: 'fa-clock',
                title: 'Commandes non expédiées',
                text: `${unfulfilled.length} commande${unfulfilled.length > 1 ? 's' : ''} en attente d'expédition`,
                time: '',
                type: 'info'
            });
        }

        // Update badge
        if (notifBadge) {
            if (notifications.length > 0) {
                notifBadge.textContent = notifications.length > 9 ? '9+' : notifications.length;
                notifBadge.style.display = 'flex';
            } else {
                notifBadge.style.display = 'none';
            }
        }

        // Render
        if (notifications.length === 0) {
            notifList.innerHTML = `
                <div style="text-align:center;padding:2rem;color:#6b7280;">
                    <i class="fas fa-check-circle" style="font-size:1.5rem;margin-bottom:0.5rem;display:block;color:#22c55e;"></i>
                    <p>Aucune notification</p>
                </div>
            `;
        } else {
            notifList.innerHTML = notifications.map(n => `
                <div class="notification-item unread">
                    <i class="fas ${n.icon}"></i>
                    <div>
                        <strong>${n.title}</strong>
                        <p>${n.text}</p>
                        ${n.time ? `<span class="notification-time">${n.time}</span>` : ''}
                    </div>
                </div>
            `).join('');
        }

        // Mark all read button
        document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
            notifList.querySelectorAll('.notification-item').forEach(item => {
                item.classList.remove('unread');
            });
            if (notifBadge) notifBadge.style.display = 'none';
        });

    } catch (error) {
        console.error('Error loading notifications:', error);
        notifList.innerHTML = `
            <div style="text-align:center;padding:2rem;color:#6b7280;">
                <p>Impossible de charger les notifications</p>
            </div>
        `;
    }
}

async function loadDashboardAlerts() {
    const alertsContainer = document.getElementById('dashboardAlerts');
    if (!alertsContainer) return;

    try {
        const [ordersRes, productsRes] = await Promise.all([
            fetch(`${API_URL}/orders?limit=250`).then(r => r.json()).catch(() => ({ orders: [] })),
            fetch(`${API_URL}/products?limit=100`).then(r => r.json()).catch(() => ({ products: [] }))
        ]);

        const orders = ordersRes.orders || [];
        const products = productsRes.products || [];
        const alerts = [];

        // Low stock products
        let lowStockCount = 0;
        const lowStockProducts = [];
        products.forEach(product => {
            (product.variants || []).forEach(variant => {
                const qty = variant.inventory_quantity;
                if (qty !== undefined && qty !== null && qty <= 10 && qty >= 0) {
                    lowStockCount++;
                    if (lowStockProducts.length < 3) {
                        lowStockProducts.push(`${product.title} (${qty})`);
                    }
                }
            });
        });

        if (lowStockCount > 0) {
            alerts.push({
                type: 'warning',
                icon: 'fa-exclamation-triangle',
                title: 'Stock faible',
                text: `${lowStockCount} produit${lowStockCount > 1 ? 's ont' : ' a'} un stock inférieur à 10 unités`
                    + (lowStockProducts.length > 0 ? ` : ${lowStockProducts.join(', ')}` : '')
            });
        }

        // Unfulfilled orders
        const unfulfilled = orders.filter(o => !o.fulfillment_status || o.fulfillment_status === 'unfulfilled');
        if (unfulfilled.length > 0) {
            alerts.push({
                type: 'info',
                icon: 'fa-clock',
                title: 'Commandes en attente',
                text: `${unfulfilled.length} commande${unfulfilled.length > 1 ? 's attendent' : ' attend'} d'être traitée${unfulfilled.length > 1 ? 's' : ''}`
            });
        }

        // Unpaid orders
        const unpaid = orders.filter(o => o.financial_status === 'pending' || o.financial_status === 'unpaid');
        if (unpaid.length > 0) {
            alerts.push({
                type: 'warning',
                icon: 'fa-credit-card',
                title: 'Paiements en attente',
                text: `${unpaid.length} commande${unpaid.length > 1 ? 's' : ''} en attente de paiement`
            });
        }

        // Revenue milestone
        const paidOrders = orders.filter(o => o.financial_status === 'paid');
        const totalRevenue = paidOrders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);
        if (totalRevenue > 0) {
            alerts.push({
                type: 'success',
                icon: 'fa-chart-line',
                title: 'Chiffre d\'affaires',
                text: `${totalRevenue.toFixed(2)}€ de CA total sur ${paidOrders.length} commande${paidOrders.length > 1 ? 's' : ''} payée${paidOrders.length > 1 ? 's' : ''}`
            });
        }

        // All good
        if (alerts.length === 0) {
            alerts.push({
                type: 'success',
                icon: 'fa-check-circle',
                title: 'Tout va bien !',
                text: 'Aucune alerte pour le moment'
            });
        }

        alertsContainer.innerHTML = alerts.map(a => `
            <div class="alert-item ${a.type}">
                <i class="fas ${a.icon}"></i>
                <div>
                    <strong>${a.title}</strong>
                    <p>${a.text}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading alerts:', error);
        alertsContainer.innerHTML = `
            <div class="alert-item info">
                <i class="fas fa-info-circle"></i>
                <div>
                    <strong>Chargement impossible</strong>
                    <p>Vérifiez que le serveur backend est démarré</p>
                </div>
            </div>
        `;
    }
}

function timeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'À l\'instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR');
}

// ===================================
// ORDERS
// ===================================

let allOrders = [];
let currentFilter = 'all';

async function loadOrders() {
    const ordersTableBody = document.getElementById('ordersTableBody');
    if (!ordersTableBody) return;

    // Show loading
    ordersTableBody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 2rem;">
                <i class="fas fa-spinner fa-spin"></i> Chargement des commandes...
            </td>
        </tr>
    `;

    try {
        const response = await fetch(`${API_URL}/orders?limit=100`);
        const data = await response.json();
        
        if (data.orders) {
            allOrders = data.orders;
            renderOrders();
            setupOrderFilters();
            setupOrderSearch();
        } else {
            throw new Error('Pas de commandes reçues');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #ef4444;">
                    Erreur de chargement des commandes. Vérifiez que le serveur backend est démarré.
                </td>
            </tr>
        `;
    }
}

function renderOrders(orders = null) {
    const ordersTableBody = document.getElementById('ordersTableBody');
    if (!ordersTableBody) return;

    const ordersToRender = orders || allOrders;

    if (ordersToRender.length === 0) {
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #6b7280;">
                    Aucune commande trouvée
                </td>
            </tr>
        `;
        return;
    }

    ordersTableBody.innerHTML = ordersToRender.map(order => {
        const date = new Date(order.created_at);
        
        // Statut financier amélioré pour inclure "Remboursée"
        let financialStatus = 'Non payée';
        let financialClass = 'pending';
        if (order.financial_status === 'paid') { financialStatus = 'Payée'; financialClass = 'fulfilled'; }
        else if (order.financial_status === 'refunded') { financialStatus = 'Remboursée'; financialClass = 'unfulfilled'; }
        else if (order.financial_status === 'partially_refunded') { financialStatus = 'Remb. partiel'; financialClass = 'unfulfilled'; }
        else if (order.financial_status === 'pending') { financialStatus = 'En attente'; financialClass = 'pending'; }

        const fulfillmentStatus = order.fulfillment_status === 'fulfilled' ? 'Expédiée' :
                                 order.fulfillment_status === 'partial' ? 'Partielle' :
                                 'Non expédiée';
        
        const productsList = (order.line_items || []).map(item => item.title || item.name).join(', ') || '-';
        const productsDisplay = productsList.length > 40 ? productsList.substring(0, 40) + '...' : productsList;
        
        return `
            <tr>
                <td>#${order.order_number || order.id}</td>
                <td>${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</td>
                <td>${order.customer?.first_name || 'Client'} ${order.customer?.last_name || ''}</td>
                <td title="${productsList}">${productsDisplay}</td>
                <td>${parseFloat(order.total_price || 0).toFixed(2)} €</td>
                <td><span class="order-status ${financialClass}">${financialStatus}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn" title="Voir le détail" onclick="viewOrderDetail('${order.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function setupOrderFilters() {
    const filterButtons = document.querySelectorAll('.filter-chip[data-status]');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Filter orders
            currentFilter = button.dataset.status;
            filterOrders();
        });
    });
}

function setupOrderSearch() {
    const searchInput = document.getElementById('orderSearch');
    
    searchInput?.addEventListener('input', (e) => {
        filterOrders(e.target.value);
    });
}

function filterOrders(searchTerm = '') {
    let filtered = [...allOrders];
    
    // Apply status filter
    if (currentFilter !== 'all') {
        filtered = filtered.filter(order => {
            if (currentFilter === 'unfulfilled') {
                return !order.fulfillment_status || order.fulfillment_status === 'unfulfilled';
            } else if (currentFilter === 'fulfilled') {
                return order.fulfillment_status === 'fulfilled';
            }
            return true;
        });
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(order => {
            const orderNumber = String(order.order_number || order.id).toLowerCase();
            const customerName = `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.toLowerCase();
            return orderNumber.includes(term) || customerName.includes(term);
        });
    }
    
    renderOrders(filtered);
}

// View order detail
async function viewOrderDetail(orderId) {
    const order = allOrders.find(o => String(o.id) === String(orderId));
    if (!order) return;
    
    const modal = document.getElementById('orderDetailsModal');
    const content = document.getElementById('orderDetailsContent');
    
    const date = new Date(order.created_at);
    
    // Products with variant details - Filter out useless properties
    const uselessProps = ['_YmqEVariantIds', '_YmqParentId', '_instoreAppId', '_sku', 'sku'];
    const items = (order.line_items || []).map(item => {
        const variantInfo = item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title : '';
        const sku = item.sku ? `<div style="font-size:0.75rem;color:#9ca3af;margin-top:0.25rem;"><i class="fas fa-barcode"></i> SKU: ${item.sku}</div>` : '';
        
        // Filter out useless properties - exclude anything starting with "_" or in uselessProps list
        const properties = (item.properties || [])
            .filter(p => p.name && p.value && !uselessProps.includes(p.name) && !p.name.startsWith('_'))
            .map(p => `
                <div style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;background:#f9fafb;padding:0.5rem 0.75rem;border-radius:6px;border-left:3px solid #d4a574;">
                    <strong style="color:#1f2937;display:block;margin-bottom:0.25rem;">📝 ${p.name}</strong> 
                    <span style="display:block;word-break:break-word;white-space:pre-wrap;">${p.value}</span>
                </div>
            `).join('');
        
        return `
            <tr>
                <td style="min-width:200px;">
                    <div style="font-weight:600;color:#1f2937;font-size:0.95rem;">${item.title || item.name}</div>
                    ${variantInfo ? `<div style="font-size:0.85rem;color:#d4a574;margin-top:0.25rem;">🎨 ${variantInfo}</div>` : ''}
                    ${sku}
                    ${properties}
                </td>
                <td style="text-align:center;font-weight:600;">${item.quantity}</td>
                <td style="text-align:right;">${parseFloat(item.price || 0).toFixed(2)} €</td>
                <td style="text-align:right;font-weight:600;">${(parseFloat(item.price || 0) * item.quantity).toFixed(2)} €</td>
            </tr>
        `;
    }).join('');
    
    // Shipping address
    const shipping = order.shipping_address;
    const shippingHTML = shipping ? `
        <div>
            <h4 style="margin-bottom:0.5rem;color:#1f2937;"><i class="fas fa-truck" style="margin-right:0.5rem;color:#d4a574;"></i>Adresse de livraison</h4>
            <div style="background:#f9fafb;padding:0.75rem 1rem;border-radius:8px;font-size:0.9rem;line-height:1.6;">
                <strong>${shipping.first_name || ''} ${shipping.last_name || ''}</strong><br>
                ${shipping.company ? shipping.company + '<br>' : ''}
                ${shipping.address1 || ''}<br>
                ${shipping.address2 ? shipping.address2 + '<br>' : ''}
                ${shipping.zip || ''} ${shipping.city || ''}<br>
                ${shipping.country || ''}
                ${shipping.phone ? `<br><i class="fas fa-phone" style="font-size:0.8rem;"></i> <a href="tel:${shipping.phone}" style="color:#d4a574;">${shipping.phone}</a>` : ''}
            </div>
        </div>
    ` : '<div><h4>Adresse de livraison</h4><p style="color:#9ca3af;">Non renseignée</p></div>';
    
    // Customer info
    const customer = order.customer;
    const customerPhone = customer?.phone || order.phone || shipping?.phone || '';
    const customerHTML = `
        <div>
            <h4 style="margin-bottom:0.5rem;color:#1f2937;"><i class="fas fa-user" style="margin-right:0.5rem;color:#d4a574;"></i>Client</h4>
            <div style="background:#f9fafb;padding:0.75rem 1rem;border-radius:8px;font-size:0.9rem;line-height:1.6;">
                <strong>${customer?.first_name || ''} ${customer?.last_name || ''}</strong><br>
                ${customer?.email ? `<i class="fas fa-envelope" style="font-size:0.8rem;"></i> <a href="mailto:${customer.email}" style="color:#d4a574;">${customer.email}</a><br>` : ''}
                ${customerPhone ? `<i class="fas fa-phone" style="font-size:0.8rem;"></i> <a href="tel:${customerPhone}" style="color:#d4a574;">${customerPhone}</a>` : ''}
            </div>
        </div>
    `;
    
    // Order notes
    const noteHTML = order.note ? `
        <div style="background:#fffbeb;border:1px solid #fcd34d;padding:0.75rem 1rem;border-radius:8px;margin-bottom:1.5rem;">
            <h4 style="margin-bottom:0.25rem;color:#92400e;"><i class="fas fa-sticky-note" style="margin-right:0.5rem;"></i>Note du client</h4>
            <p style="margin:0;color:#78350f;white-space:pre-wrap;">${order.note}</p>
        </div>
    ` : '';
    
    // Shipping method
    const shippingLine = (order.shipping_lines || [])[0];
    const shippingMethodHTML = shippingLine ? `
        <div style="font-size:0.9rem;color:#6b7280;margin-bottom:1rem;">
            <i class="fas fa-shipping-fast" style="margin-right:0.5rem;"></i>
            <strong>Mode de livraison:</strong> ${shippingLine.title}
            ${shippingLine.price && parseFloat(shippingLine.price) > 0 ? ` (${parseFloat(shippingLine.price).toFixed(2)} €)` : ' (Gratuite)'}
        </div>
    ` : '';
    
    // Detect delivery type
    const isPickup = shippingLine && (shippingLine.title.toLowerCase().includes('retrait') || shippingLine.title.toLowerCase().includes('pickup'));
    const isDelivery = !isPickup;
    
    // Get delivery date from order note (format: "... | Date souhaitée: samedi 8 mars 2026 | ...")
    let deliveryDateHTML = '';
    if(order.note) {
        const dateMatch = order.note.match(/Date souhaitée:\s*(.+?)(?:\s*\||$)/);
        if(dateMatch) {
            const dateStr = dateMatch[1].trim();
            deliveryDateHTML = `
                <div style="background:#e8f5e9;border:1px solid #4caf50;padding:0.75rem 1rem;border-radius:8px;margin-bottom:1rem;font-size:0.95rem;">
                    <i class="fas fa-calendar-check" style="color:#4caf50;margin-right:0.5rem;"></i>
                    ${isPickup ? '<strong>Date de retrait sélectionnée:</strong>' : '<strong>Date de livraison sélectionnée:</strong>'} 
                    ${dateStr}
                </div>
            `;
        }
    }
    
    // Action buttons based on order status
    let actionButtons = '';
    if(isPickup) {
        // Pickup actions
        if(order.fulfillment_status !== 'fulfilled') {
            actionButtons += `
                <button onclick="markOrderAsReadyForPickup('${order.id}')" style="padding:0.75rem 1rem;background:#4caf50;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:background 0.2s;">
                    <i class="fas fa-check-circle"></i> Prêt pour le retrait
                </button>
            `;
        }
        if(order.fulfillment_status === 'fulfilled' || order.fulfillment_status === 'partial') {
            actionButtons += `
                <button onclick="markOrderAsPickedUp('${order.id}')" style="padding:0.75rem 1rem;background:#2196f3;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:background 0.2s;">
                    <i class="fas fa-box-open"></i> Marquer comme retiré
                </button>
            `;
        }
    } else if(isDelivery) {
        // Delivery actions
        if(order.fulfillment_status !== 'fulfilled') {
            actionButtons += `
                <button onclick="printShippingLabel('${order.id}')" style="padding:0.75rem 1rem;background:#ff9800;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:background 0.2s;">
                    <i class="fas fa-print"></i> Imprimer le bordereau
                </button>
            `;
            actionButtons += `
                <button onclick="markOrderAsProcessed('${order.id}')" style="padding:0.75rem 1rem;background:#4caf50;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:background 0.2s;">
                    <i class="fas fa-check-double"></i> Marquer comme traité
                </button>
            `;
        }
    }
    
    const actionButtonsHTML = actionButtons ? `
        <div class="order-action-buttons">
            ${actionButtons}
        </div>
    ` : '';
    
    // Discount codes
    const discounts = (order.discount_codes || []).map(d => `${d.code} (-${parseFloat(d.amount).toFixed(2)} €)`).join(', ');
    
    // Mises à jour des statuts financiers et badges
    let financialStatusText = 'Non payée';
    let financialBadgeClass = 'od-badge-danger';
    
    if (order.financial_status === 'paid') {
        financialStatusText = 'Payée';
        financialBadgeClass = 'od-badge-success';
    } else if (order.financial_status === 'refunded') {
        financialStatusText = 'Remboursée';
        financialBadgeClass = 'od-badge-warning'; // Orange/Jaune pour marquer un remboursement
    } else if (order.financial_status === 'partially_refunded') {
        financialStatusText = 'Remboursée partiel.';
        financialBadgeClass = 'od-badge-warning';
    } else if (order.financial_status === 'pending') {
        financialStatusText = 'En attente';
        financialBadgeClass = 'od-badge-warning';
    }

    const fulfillmentStatus = order.fulfillment_status === 'fulfilled' ? 'Expédiée' :
                             order.fulfillment_status === 'partial' ? 'Partielle' : 'Non expédiée';
    
    content.innerHTML = `
        <style>
            @media (max-width: 768px) {
                .order-action-buttons { flex-direction: column !important; gap: 0.75rem !important; }
                .order-action-buttons button { width: 100% !important; flex: unset !important; }
                .od-info-grid { grid-template-columns: 1fr !important; gap: 1rem !important; }
                .od-table-wrap th, .od-table-wrap td { padding: 0.5rem 0.3rem !important; font-size: 0.8rem !important; }
                #orderDetailsModal .modal-content,
                #orderDetailsModal .modal-content.large { padding-left: 1rem !important; padding-right: 1rem !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
            }
        </style>
        <div class="od-header">
            <h2 class="od-title">Commande #${order.order_number || order.id}</h2>
            <div class="od-badges">
                <span class="od-badge ${financialBadgeClass}">
                    💳 ${financialStatusText}
                </span>
                <span class="od-badge ${order.fulfillment_status === 'fulfilled' ? 'od-badge-success' : 'od-badge-warning'}">
                    📦 ${fulfillmentStatus}
                </span>
            </div>
            <p class="od-date">📅 ${date.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})} à ${date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</p>
        </div>
        
        ${noteHTML}
        
        ${deliveryDateHTML}
        
        <div class="od-info-grid">
            ${customerHTML}
            ${shippingHTML}
        </div>
        
        ${shippingMethodHTML}
        
        ${actionButtonsHTML}
        
        <div class="od-products">
            <h4 class="od-section-title"><i class="fas fa-box" style="margin-right:0.5rem;color:#d4a574;"></i>📦 Produits à préparer</h4>
            <div class="od-table-wrap">
                <table class="data-table" style="margin-bottom:0;">
                    <thead>
                        <tr>
                            <th style="text-align:left;">Produit</th>
                            <th style="text-align:center;">Qté</th>
                            <th style="text-align:right;">Prix unit.</th>
                            <th style="text-align:right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>${items || '<tr><td colspan="4" style="text-align:center;">Aucun produit</td></tr>'}</tbody>
                </table>
            </div>
        </div>
        
        <div class="od-totals">
            <div class="od-total-row">
                <span>Sous-total</span>
                <span class="od-total-value">${parseFloat(order.subtotal_price || order.total_price || 0).toFixed(2)} €</span>
            </div>
            ${discounts ? `<div class="od-total-row od-discount">
                <span><i class="fas fa-tag"></i> ${discounts}</span>
                <span class="od-total-value">-${parseFloat(order.total_discounts || 0).toFixed(2)} €</span>
            </div>` : ''}
            ${shippingLine ? `<div class="od-total-row">
                <span>Livraison (${shippingLine.title})</span>
                <span class="od-total-value">${parseFloat(shippingLine.price || 0).toFixed(2)} €</span>
            </div>` : ''}
            ${order.total_tax && parseFloat(order.total_tax) > 0 ? `<div class="od-total-row">
                <span>Taxes</span>
                <span class="od-total-value">${parseFloat(order.total_tax).toFixed(2)} €</span>
            </div>` : ''}
            <div class="od-total-row od-grand-total">
                <span>TOTAL</span>
                <span>${parseFloat(order.total_price || 0).toFixed(2)} €</span>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
    
    modal.querySelector('.modal-close')?.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    modal.querySelector('.modal-overlay')?.addEventListener('click', () => {
        modal.classList.remove('active');
    });
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `admin-notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===================================
// ORDER ACTIONS
// ===================================

async function markOrderAsReadyForPickup(orderId) {
    try {
        showNotification('⏳ Mise à jour en cours...', 'info');
        await doFulfillOrder(orderId);
        showNotification('✅ Commande marquée comme prête pour le retrait', 'success');
        document.getElementById('orderDetailsModal').classList.remove('active');
        loadOrders();
    } catch(error) {
        console.error('Erreur:', error);
        showNotification('❌ ' + error.message, 'error');
    }
}

async function markOrderAsPickedUp(orderId) {
    try {
        showNotification('⏳ Mise à jour en cours...', 'info');
        const order = allOrders.find(o => String(o.id) === String(orderId));
        if(!order) throw new Error('Commande introuvable');
        const timestamp = new Date().toLocaleString('fr-FR');
        const newNote = (order.note ? order.note + '\n' : '') + `[RETRAIT EFFECTUÉ - ${timestamp}]`;
        await fetch('/api/orders/' + orderId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: { note: newNote } })
        });
        showNotification('✅ Commande marquée comme retirée', 'success');
        document.getElementById('orderDetailsModal').classList.remove('active');
        loadOrders();
    } catch(error) {
        console.error('Erreur:', error);
        showNotification('❌ ' + error.message, 'error');
    }
}

async function markOrderAsProcessed(orderId) {
    try {
        showNotification('⏳ Mise à jour en cours...', 'info');
        const order = allOrders.find(o => String(o.id) === String(orderId));
        if(!order) throw new Error('Commande introuvable');
        const timestamp = new Date().toLocaleString('fr-FR');
        const newNote = (order.note ? order.note + '\n' : '') + `[TRAITÉ - ${timestamp}]`;
        await fetch('/api/orders/' + orderId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: { note: newNote } })
        });
        await doFulfillOrder(orderId);
        showNotification('✅ Commande marquée comme traitée — email envoyé au client', 'success');
        document.getElementById('orderDetailsModal').classList.remove('active');
        loadOrders();
    } catch(error) {
        console.error('Erreur:', error);
        showNotification('❌ ' + error.message, 'error');
    }
}

async function doFulfillOrder(orderId) {
    // Get fulfillment orders
    const foResponse = await fetch('/api/orders/' + orderId + '/fulfillment_orders');
    if(!foResponse.ok) throw new Error('Impossible de récupérer les fulfillment orders');
    const foData = await foResponse.json();

    const fulfillmentOrders = (foData.fulfillment_orders || []).filter(
        fo => fo.status === 'open' || fo.status === 'in_progress' || fo.status === 'scheduled' || fo.status === 'unscheduled'
    );
    if(fulfillmentOrders.length === 0) throw new Error('Aucun fulfillment order à traiter (déjà traité ?)');

    const lineItemsByFulfillmentOrder = fulfillmentOrders.map(fo => ({
        fulfillment_order_id: fo.id,
        fulfillment_order_line_items: fo.line_items.map(li => ({ id: li.id, quantity: li.quantity }))
    }));

    const fulfillResponse = await fetch('/api/orders/' + orderId + '/fulfillments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fulfillment: {
                line_items_by_fulfillment_order: lineItemsByFulfillmentOrder
            }
        })
    });

    const fulfillData = await fulfillResponse.json();
    if(!fulfillResponse.ok) throw new Error('Erreur fulfillment: ' + (fulfillData.error || fulfillResponse.status));
}

async function markOrderAsShipped(orderId) {
    try {
        showNotification('⏳ Mise à jour en cours...', 'info');
        
        const order = allOrders.find(o => String(o.id) === String(orderId));
        if(!order) {
            throw new Error('Commande introuvable');
        }
        
        const fulfillmentOrderId = await getOrderFulfillmentOrderId(orderId);
        if(!fulfillmentOrderId) {
            throw new Error('Impossible de récupérer l\'ordre de fulfillment');
        }
        
        // Get all unfulfilled line items
        const response = await fetch('/api/orders/' + orderId + '/fulfillment_orders');
        if(!response.ok) throw new Error('Erreur lors de la récupération des fulfillment orders');
        
        const data = await response.json();
        const fulfillmentOrder = data.fulfillment_orders.find(fo => fo.id == fulfillmentOrderId);
        
        if(!fulfillmentOrder) {
            throw new Error('Fulfillment order non trouvé');
        }
        
        // Create fulfillment with all line items
        const lineItems = fulfillmentOrder.line_items.map(li => ({
            id: li.id,
            quantity: li.quantity
        }));
        
        const fulfillResponse = await fetch('/api/orders/' + orderId + '/fulfillments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fulfillment: {
                    line_items_by_fulfillment_order: [
                        {
                            fulfillment_order_id: fulfillmentOrderId,
                            fulfillment_order_line_items: lineItems
                        }
                    ]
                }
            })
        });
        
        if(fulfillResponse.ok) {
            showNotification('✅ Commande marquée comme expédiée', 'success');
            loadOrders();
            document.getElementById('orderDetailsModal').classList.remove('active');
        } else {
            throw new Error('Erreur lors de la création du fulfillment');
        }
    } catch(error) {
        console.error('Erreur:', error);
        showNotification('❌ Erreur: ' + error.message, 'error');
    }
}

async function getOrderFulfillmentOrderId(orderId) {
    try {
        const response = await fetch('/api/orders/' + orderId + '/fulfillment_orders');
        if(!response.ok) {
            throw new Error('Erreur lors de la récupération des fulfillment orders');
        }
        const data = await response.json();
        if(data.fulfillment_orders && data.fulfillment_orders.length > 0) {
            // Retourner le premier fulfillment order qui n'est pas encore fulfillé
            const unfulfilledOrder = data.fulfillment_orders.find(fo => fo.status === 'unscheduled' || fo.status === 'scheduled');
            return unfulfilledOrder?.id || data.fulfillment_orders[0].id;
        }
    } catch(error) {
        console.error('Erreur lors de la récupération du fulfillment order:', error);
    }
    return null;
}

function printShippingLabel(orderId) {
    try {
        const order = allOrders.find(o => String(o.id) === String(orderId));
        if(!order) return;
        
        // Open Shopify's official shipping label
        const shopifyStoreUrl = 'https://admin.shopify.com';
        const orderPath = `/orders/${orderId}`;
        
        // Open order page in Shopify admin where the label can be printed
        window.open(shopifyStoreUrl + orderPath, '_blank');
        
        showNotification('📄 Ouverture du bordereau Shopify...', 'info');
    } catch(error) {
        console.error('Erreur:', error);
        showNotification('❌ Erreur lors de l\'ouverture du bordereau', 'error');
    }
}
