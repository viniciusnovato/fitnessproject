// Supabase Configuration
// IMPORTANT: Replace with your actual Supabase credentials
const SUPABASE_URL = 'https://plzeupkalmswkbfjpdhn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2aljxwxnI0xMqxiep6NwVg_STNEu0Oj';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Format date in Brazilian Portuguese
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format number with thousands separator
function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR').format(num || 0);
}

// Load Dashboard Statistics
async function loadStats() {
    try {
        // Total Users
        const { count: usersCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
        document.getElementById('total-users').textContent = formatNumber(usersCount);

        // Total Meals
        const { count: mealsCount } = await supabase
            .from('meals')
            .select('*', { count: 'exact', head: true });
        document.getElementById('total-meals').textContent = formatNumber(mealsCount);

        // Total Recipes
        const { count: recipesCount } = await supabase
            .from('recipes')
            .select('*', { count: 'exact', head: true });
        document.getElementById('total-recipes').textContent = formatNumber(recipesCount);

        // Total Ingredients
        const { count: ingredientsCount } = await supabase
            .from('ingredients')
            .select('*', { count: 'exact', head: true });
        document.getElementById('total-ingredients').textContent = formatNumber(ingredientsCount);

        // AI Cache Count
        const { count: cacheCount } = await supabase
            .from('ai_cache')
            .select('*', { count: 'exact', head: true });
        document.getElementById('ai-cache-count').textContent = formatNumber(cacheCount);

        // Meal Plans Count
        const { count: plansCount } = await supabase
            .from('meal_plans')
            .select('*', { count: 'exact', head: true });
        document.getElementById('meal-plans-count').textContent = formatNumber(plansCount);

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load Recent Users
async function loadUsers() {
    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        const tbody = document.getElementById('users-tbody');

        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="loading">Nenhum usuário encontrado</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => {
            let goalBadge = '';
            if (user.goal) {
                const badgeClass = user.goal.includes('ganhar') ? 'badge-info' :
                    user.goal.includes('perder') ? 'badge-warning' : 'badge-success';
                goalBadge = `<span class="badge ${badgeClass}">${user.goal}</span>`;
            } else {
                goalBadge = '<span class="badge">Não definido</span>';
            }

            return `
                <tr>
                    <td style="font-weight: 500">${user.email || 'N/A'}</td>
                    <td>${formatDate(user.created_at)}</td>
                    <td>${goalBadge}</td>
                    <td style="font-weight: 600; color: var(--primary)">${user.daily_calories ? user.daily_calories + ' kcal' : 'N/A'}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('users-tbody').innerHTML =
            '<tr><td colspan="4" class="loading">Erro ao carregar usuários</td></tr>';
    }
}

// Load Recent Meals
async function loadMeals() {
    try {
        const { data: meals, error } = await supabase
            .from('meals')
            .select(`
                *,
                profiles!inner(email)
            `)
            .order('created_at', { ascending: false })
            .limit(15);

        if (error) throw error;

        const tbody = document.getElementById('meals-tbody');

        if (!meals || meals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading">Nenhuma refeição encontrada</td></tr>';
            return;
        }

        tbody.innerHTML = meals.map(meal => `
            <tr>
                <td style="font-weight: 500">${meal.profiles?.email || 'N/A'}</td>
                <td style="color: var(--text)">${meal.name || 'Sem nome'}</td>
                <td style="font-weight: 600; color: var(--text)">${meal.calories || 0} <span style="font-weight: 400; color: var(--text-secondary)">kcal</span></td>
                <td style="font-weight: 600; color: var(--primary)">${meal.protein || 0}<span style="font-weight: 400; color: var(--text-secondary)">g</span></td>
                <td>${formatDate(meal.created_at)}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading meals:', error);
        document.getElementById('meals-tbody').innerHTML =
            '<tr><td colspan="5" class="loading">Erro ao carregar refeições</td></tr>';
    }
}

// Load Cache Statistics
async function loadCacheStats() {
    try {
        const { data: cacheData, error } = await supabase
            .from('ai_cache')
            .select('request_type, hit_count, last_hit_at')
            .order('last_hit_at', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('cache-tbody');

        if (!cacheData || cacheData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="loading">Nenhum cache encontrado</td></tr>';
            return;
        }

        // Group by request type
        const grouped = cacheData.reduce((acc, item) => {
            if (!acc[item.request_type]) {
                acc[item.request_type] = {
                    count: 0,
                    totalHits: 0,
                    lastHit: item.last_hit_at
                };
            }
            acc[item.request_type].count++;
            acc[item.request_type].totalHits += item.hit_count || 0;
            if (item.last_hit_at > acc[item.request_type].lastHit) {
                acc[item.request_type].lastHit = item.last_hit_at;
            }
            return acc;
        }, {});

        tbody.innerHTML = Object.entries(grouped).map(([type, stats]) => `
            <tr>
                <td>${type}</td>
                <td>${formatNumber(stats.count)}</td>
                <td>${stats.totalHits > 0 ? formatNumber(stats.totalHits) : '0'} hits</td>
                <td>${stats.lastHit ? formatDate(stats.lastHit) : 'N/A'}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading cache stats:', error);
        document.getElementById('cache-tbody').innerHTML =
            '<tr><td colspan="4" class="loading">Erro ao carregar cache</td></tr>';
    }
}

// Refresh all data
async function refreshData() {
    document.getElementById('last-update').textContent = formatDate(new Date().toISOString());
    await Promise.all([
        loadStats(),
        loadUsers(),
        loadMeals(),
        loadCacheStats()
    ]);
}

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
    refreshData();
    // Auto-refresh every 30 seconds
    setInterval(refreshData, 30000);
});
