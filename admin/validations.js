// Supabase Configuration
// IMPORTANT: Replace with your actual Supabase credentials
const SUPABASE_URL = 'https://plzeupkalmswkbfjpdhn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2aljxwxnI0xMqxiep6NwVg_STNEu0Oj';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentFilter = 'all';
let analysesData = [];

// Format date
function formatDate(dateString) {
    if (!dateString) return 'Data desconhecida';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Load Validations
async function loadValidations() {
    const container = document.getElementById('analyses-container');
    container.innerHTML = '<div class="loading-card">Carregando análises...</div>';

    try {
        // Fetch meal_image requests from ai_cache
        const { data, error } = await supabase
            .from('ai_cache')
            .select('*')
            .eq('request_type', 'meal_image')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        analysesData = data || [];
        updateStats();
        renderAnalyses();

    } catch (error) {
        console.error('Error loading validations:', error);
        container.innerHTML = '<div class="loading-card">Erro ao carregar análises. Verifique o console.</div>';
    }
}

// Update Stats
function updateStats() {
    const total = analysesData.length;
    const approved = analysesData.filter(item => item.response_data._validation_status === 'approved').length;
    const rejected = analysesData.filter(item => item.response_data._validation_status === 'rejected').length;
    const pending = analysesData.filter(item => !item.response_data._validation_status || item.response_data._validation_status === 'pending').length;

    document.getElementById('total-analyses').textContent = total;
    document.getElementById('approved-count').textContent = approved;
    document.getElementById('rejected-count').textContent = rejected;
    document.getElementById('pending-count').textContent = pending;
}

// Filter Analyses
function filterAnalyses(filter) {
    currentFilter = filter;

    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(filter === 'all' ? 'todos' : filter === 'pending' ? 'pendentes' : filter === 'approved' ? 'aprovados' : 'reprovados')) {
            btn.classList.add('active');
        }
    });

    renderAnalyses();
}

// Render Analyses Cards
function renderAnalyses() {
    const container = document.getElementById('analyses-container');

    let filteredData = analysesData;
    if (currentFilter !== 'all') {
        filteredData = analysesData.filter(item => {
            const status = item.response_data._validation_status || 'pending';
            return status === currentFilter;
        });
    }

    if (filteredData.length === 0) {
        container.innerHTML = '<div class="loading-card">Nenhuma análise encontrada com este filtro.</div>';
        return;
    }

    container.innerHTML = filteredData.map(item => {
        const response = item.response_data;
        const params = item.request_params;
        const status = response._validation_status || 'pending';
        const statusLabel = status === 'approved' ? 'Aprovado' : status === 'rejected' ? 'Reprovado' : 'Pendente';

        // Get first image
        let imageUrl = 'placeholder.jpg';
        if (params.images && params.images.length > 0) {
            imageUrl = `data:image/jpeg;base64,${params.images[0]}`;
        }

        return `
            <div class="analysis-card" id="card-${item.id}">
                <img src="${imageUrl}" class="analysis-image" alt="Meal Image">
                <div class="analysis-content">
                    <div class="analysis-header">
                        <span class="analysis-date">${formatDate(item.created_at)}</span>
                        <span class="analysis-status status-${status}">${statusLabel}</span>
                    </div>
                    
                    <div class="analysis-result">
                        <h4>${response.name || 'Sem nome'}</h4>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">
                            ${response.tips || 'Sem dicas'}
                        </p>
                        
                        <div class="macros-grid">
                            <div class="macro-item">
                                <div class="macro-label">Calorias</div>
                                <input type="number" id="cal-${item.id}" class="macro-input" value="${response.calories || 0}">
                            </div>
                            <div class="macro-item">
                                <div class="macro-label">Proteínas</div>
                                <div class="input-group">
                                    <input type="number" id="prot-${item.id}" class="macro-input" value="${response.protein || 0}">
                                    <span>g</span>
                                </div>
                            </div>
                            <div class="macro-item">
                                <div class="macro-label">Carbos</div>
                                <div class="input-group">
                                    <input type="number" id="carb-${item.id}" class="macro-input" value="${response.carbs || 0}">
                                    <span>g</span>
                                </div>
                            </div>
                            <div class="macro-item">
                                <div class="macro-label">Gorduras</div>
                                <div class="input-group">
                                    <input type="number" id="fat-${item.id}" class="macro-input" value="${response.fat || 0}">
                                    <span>g</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="analysis-actions">
                        <button class="action-btn reject-btn" onclick="updateStatus('${item.id}', 'rejected')" ${status === 'rejected' ? 'disabled' : ''}>
                            ❌ Reprovar
                        </button>
                        <button class="action-btn approve-btn" onclick="updateStatus('${item.id}', 'approved')" ${status === 'approved' ? 'disabled' : ''}>
                            ✅ Aprovar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Update Status (Approve/Reject)
async function updateStatus(id, newStatus) {
    try {
        const item = analysesData.find(i => i.id === id);
        if (!item) return;

        // Get current values from inputs (verified ground truth)
        const calories = Number(document.getElementById(`cal-${id}`).value);
        const protein = Number(document.getElementById(`prot-${id}`).value);
        const carbs = Number(document.getElementById(`carb-${id}`).value);
        const fat = Number(document.getElementById(`fat-${id}`).value);

        // Optimistic update
        const oldStatus = item.response_data._validation_status;
        item.response_data._validation_status = newStatus;

        // Update local data with verified values
        item.response_data.calories = calories;
        item.response_data.protein = protein;
        item.response_data.carbs = carbs;
        item.response_data.fat = fat;

        updateStats();
        renderAnalyses();

        // Update in Supabase
        const updatedResponse = {
            ...item.response_data,
            _validation_status: newStatus,
            // Save verified values as the new truth
            calories,
            protein,
            carbs,
            fat,
            _verified_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('ai_cache')
            .update({ response_data: updatedResponse })
            .eq('id', id);

        if (error) {
            // Revert on error
            item.response_data._validation_status = oldStatus;
            updateStats();
            renderAnalyses();
            alert('Erro ao atualizar status: ' + error.message);
        }

    } catch (error) {
        console.error('Error updating status:', error);
        alert('Erro ao atualizar status');
    }
}

// Refresh function
function refreshValidations() {
    loadValidations();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadValidations();
});
