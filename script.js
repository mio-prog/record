/**
 * 読書・映画記録 完全版 (ジャンルフィルター対応・キャッシュ機能付き)
 */
let booksData = [];
let moviesData = [];
let currentSort = { 
    books: { key: 'date', asc: false }, 
    movies: { key: 'date', asc: false } 
};

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbw3_O5HjDqZQ-3DbHn3WiiRmDWVRu8cwI2A4fIb2xUsLHEbRGWqHaXPolNmwcUWsYer/exec';

// データ読み込み＆キャッシュ処理
async function loadAppData() {
    const CACHE_KEY = 'appData_cache';
    const TIME_KEY = 'appData_time';
    
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(TIME_KEY);
    const isExpired = !cachedTime || (Date.now() - cachedTime > 60000); // 1分で期限切れ

    if (cachedData && !isExpired) {
        renderData(JSON.parse(cachedData));
    } else {
        try {
            const response = await fetch(SHEET_URL);
            if (!response.ok) throw new Error('通信エラー');
            const allData = await response.json();
            localStorage.setItem(CACHE_KEY, JSON.stringify(allData));
            localStorage.setItem(TIME_KEY, Date.now().toString());
            renderData(allData);
        } catch (e) {
            if (cachedData) renderData(JSON.parse(cachedData));
        }
    }
}

function renderData(allData) {
    booksData = allData.filter(item => item.type === 'book');
    moviesData = allData.filter(item => item.type === 'movie');
    updateDisplay('books');
    updateDisplay('movies');
    setupFilters();
}

function generateStars(rating) {
    const r = parseFloat(rating) || 0;
    const percentage = (r / 5) * 100 - 0.5;
    return `<div class="rating-container">★★★★★<div class="rating-fill" style="width: ${percentage}%">★★★★★</div></div>`;
}

function updateDisplay(type) {
    const data = type === 'books' ? booksData : moviesData;
    const grid = document.getElementById(`${type}Grid`);
    const searchBox = document.getElementById(`searchBox${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const genreFilter = document.getElementById(`genreFilter${type.charAt(0).toUpperCase() + type.slice(1)}`);
    
    if (!searchBox || !genreFilter) return;

    const searchVal = searchBox.value.toLowerCase();
    const genreVal = genreFilter.value;
    
    let filtered = data.filter(item => {
        const text = (item.title + (item.creator || "") + (item.tags || "")).toLowerCase();
        const matchesSearch = text.includes(searchVal);
        const matchesGenre = genreVal === "" || (item.genre || "") === genreVal;
        return matchesSearch && matchesGenre;
    });

    const sortInfo = currentSort[type];
    filtered.sort((a, b) => {
        let valA = a[sortInfo.key] || "";
        let valB = b[sortInfo.key] || "";
        return sortInfo.asc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    const orderEl = document.getElementById(`${sortInfo.key}Order${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (orderEl) orderEl.textContent = sortInfo.asc ? '↑' : '↓';

    grid.innerHTML = filtered.map(item => `
        <div class="book-card" onclick="openModal('${type}', '${item.title.replace(/'/g, "\\'")}')">
            <img src="img/${type === 'books' ? 'book' : 'movie'}/${item.coverUrl}" class="book-cover" onerror="this.src='img/no-image.png'">
            <div class="book-info">
                <div class="book-title">${item.title}</div>
                <div class="book-author">${item.creator || ""}</div>
                <div class="book-date">${(item.date || "").split('T')[0]}</div>
                <div class="book-rating">${generateStars(item.rating)}</div>
            </div>
        </div>
    `).join('');

    const noRes = document.getElementById(`noResults${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (noRes) noRes.style.display = filtered.length === 0 ? 'block' : 'none';
}

function openModal(type, title) {
    const data = type === 'books' ? booksData : moviesData;
    const item = data.find(d => d.title === title);
    if (!item) return;

    document.getElementById('modalTitle').textContent = item.title;
    document.getElementById('modalAuthor').textContent = item.creator || "";
    document.getElementById('modalDate').textContent = (item.date || "").split('T')[0];
    document.getElementById('modalRating').innerHTML = generateStars(item.rating);
    document.getElementById('modalReview').innerHTML = (item.review || "").replace(/\n/g, '<br>');
    document.getElementById('modalSynopsis').textContent = item.synopsis || "記載なし";
    
    // タグはバッジとして表示（クリックで検索窓に反映させる）
    document.getElementById('modalTags').innerHTML = (item.tags || "").split(',').map(t => {
        const tag = t.trim();
        return tag ? `<span class="tag-badge" onclick="filterByTag('${type}', '${tag}')" style="cursor:pointer;">${tag}</span>` : "";
    }).join('');
    
    document.getElementById('modalCover').innerHTML = `<img src="img/${type === 'books' ? 'book' : 'movie'}/${item.coverUrl}" class="book-cover" onerror="this.src='img/no-image.png'">`;
    document.getElementById('modal').classList.add('active');
}

function setupFilters() {
    ['Books', 'Movies'].forEach(type => {
        const select = document.getElementById(`genreFilter${type}`);
        if (!select) return;
        
        const allGenres = new Set();
        (type === 'Books' ? booksData : moviesData).forEach(item => {
            if (item.genre) allGenres.add(item.genre);
        });

        select.innerHTML = '<option value="">すべてのジャンル</option>';
        allGenres.forEach(genre => {
            const opt = document.createElement('option');
            opt.value = genre; opt.textContent = genre;
            select.appendChild(opt);
        });
        select.onchange = () => updateDisplay(type.toLowerCase());
    });
}

function filterByTag(type, tagName) {
    const searchBox = document.getElementById(`searchBox${type.charAt(0).toUpperCase() + type.slice(1)}`);
    searchBox.value = tagName;
    document.getElementById('modal').classList.remove('active');
    updateDisplay(type);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAppData();
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}Tab`).classList.add('active');
        };
    });

    ['Books', 'Movies'].forEach(type => {
        document.getElementById(`searchBox${type}`).oninput = () => updateDisplay(type.toLowerCase());
    });

    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.type;
            currentSort[type].asc = !currentSort[type].asc;
            currentSort[type].key = btn.dataset.sort;
            document.querySelectorAll(`.sort-btn[data-type="${type}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateDisplay(type);
        };
    });

    document.getElementById('modalClose').onclick = () => document.getElementById('modal').classList.remove('active');
});

// 条件をクリアして表示を更新する関数
function clearFilters(type) {
    document.getElementById(`searchBox${type.charAt(0).toUpperCase() + type.slice(1)}`).value = '';
    document.getElementById(`genreFilter${type.charAt(0).toUpperCase() + type.slice(1)}`).value = '';
    updateDisplay(type);
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        // 既存の切り替え処理
        document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        const targetTab = btn.dataset.tab; // books or movies
        document.getElementById(`${targetTab}Tab`).classList.add('active');
        
        // ★ ここで自動クリアを実行！
        clearFilters(targetTab); 
    };
});