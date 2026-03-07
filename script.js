/**
 * 読書・映画記録 完全版
 */
let booksData = [];
let moviesData = [];
let currentSort = { 
    books: { key: 'date', asc: false }, 
    movies: { key: 'date', asc: false } 
};

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbw3_O5HjDqZQ-3DbHn3WiiRmDWVRu8cwI2A4fIb2xUsLHEbRGWqHaXPolNmwcUWsYer/exec';

// --- データ読み込み＆キャッシュ処理 ---
async function loadAppData() {
    const CACHE_KEY = 'appData_cache';
    const TIME_KEY = 'appData_time';
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(TIME_KEY);
    const isExpired = !cachedTime || (Date.now() - cachedTime > 60000);

    if (cachedData && !isExpired) {
        renderData(JSON.parse(cachedData));
    } else {
        try {
            const response = await fetch(SHEET_URL);
            const allData = await response.json();
            localStorage.setItem(CACHE_KEY, JSON.stringify(allData));
            localStorage.setItem(TIME_KEY, Date.now().toString());
            renderData(allData);
        } catch (e) {
            if (cachedData) renderData(JSON.parse(cachedData));
        }
    }
}

// --- 表示処理 ---
function renderData(allData) {
    booksData = allData.filter(item => item.type === 'book');
    moviesData = allData.filter(item => item.type === 'movie');
    updateDisplay('books');
    updateDisplay('movies');
    setupFilters();
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
        return text.includes(searchVal) && (genreVal === "" || (item.genre || "") === genreVal);
    });

    const sortInfo = currentSort[type];
    filtered.sort((a, b) => {
        let valA = a[sortInfo.key] || "";
        let valB = b[sortInfo.key] || "";
        return sortInfo.asc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    // ここから先がカード生成の完全なコードです
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

// --- フィルター・ユーティリティ ---
function setupFilters() {
    ['Books', 'Movies'].forEach(type => {
        const select = document.getElementById(`genreFilter${type}`);
        if (!select) return;
        const allGenres = new Set();
        (type === 'Books' ? booksData : moviesData).forEach(item => { if (item.genre) allGenres.add(item.genre); });
        select.innerHTML = '<option value="">すべてのジャンル</option>';
        allGenres.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g; opt.textContent = g;
            select.appendChild(opt);
        });
        select.onchange = () => updateDisplay(type.toLowerCase());
    });
}

function clearFilters(type) {
    const typeUpper = type.charAt(0).toUpperCase() + type.slice(1);
    document.getElementById(`searchBox${typeUpper}`).value = '';
    document.getElementById(`genreFilter${typeUpper}`).value = '';
    updateDisplay(type);
}

function filterByTag(type, tagName) {
    const typeUpper = type.charAt(0).toUpperCase() + type.slice(1);
    document.getElementById(`searchBox${typeUpper}`).value = tagName;
    document.getElementById('modal').classList.remove('active');
    updateDisplay(type);
}

function generateStars(rating) {
    const r = parseFloat(rating) || 0;
    return `<div class="rating-container">★★★★★<div class="rating-fill" style="width: ${(r / 5) * 100 - 0.5}%">★★★★★</div></div>`;
}

// --- モーダル表示処理（HTMLの全ての項目に対応） ---
function openModal(type, title) {
    const data = type === 'books' ? booksData : moviesData;
    const item = data.find(d => d.title === title);
    if (!item) return;

    // ヘッダー情報
    document.getElementById('modalTitle').textContent = item.title;
    document.getElementById('modalAuthor').textContent = item.creator || "";
    document.getElementById('modalDate').textContent = (item.date || "").split('T')[0];
    document.getElementById('modalRating').innerHTML = generateStars(item.rating);
    
    // カバー画像
    document.getElementById('modalCover').innerHTML = `<img src="img/${type === 'books' ? 'book' : 'movie'}/${item.coverUrl}" class="book-cover" onerror="this.src='img/no-image.png'">`;

    // 本文・あらすじ・タグ
    document.getElementById('modalReview').innerHTML = (item.review || "").replace(/\n/g, '<br>');
    document.getElementById('modalSynopsis').textContent = item.synopsis || "記載なし";
    
    document.getElementById('modalTags').innerHTML = (item.tags || "").split(',').map(t => {
        const tag = t.trim();
        return tag ? `<span class="tag-badge" onclick="filterByTag('${type}', '${tag}')" style="cursor:pointer;">${tag}</span>` : "";
    }).join('');

    // モーダルを表示
    document.getElementById('modal').classList.add('active');
}

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    loadAppData();
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const targetTab = btn.dataset.tab;
            document.getElementById(`${targetTab}Tab`).classList.add('active');
            clearFilters(targetTab);
        };
    });
    ['Books', 'Movies'].forEach(type => {
        document.getElementById(`searchBox${type}`).oninput = () => updateDisplay(type.toLowerCase());
    });
    document.getElementById('modalClose').onclick = () => document.getElementById('modal').classList.remove('active');
	
	// --- ソートボタンのイベント設定（矢印切り替え対応） ---
document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.type; // books か movies
        const sortKey = btn.dataset.sort; // date, title, rating
        
        // 1. ソート状態を更新
        currentSort[type].key = sortKey;
        currentSort[type].asc = !currentSort[type].asc; // 昇順/降順を反転
        
        // 2. 矢印を切り替える（現在の asc が true なら ↑, false なら ↓）
        const arrow = btn.querySelector('span');
        if (arrow) {
            arrow.textContent = currentSort[type].asc ? '↑' : '↓';
        }
        
        // 3. ボタンの見た目（active）を更新
        document.querySelectorAll(`.sort-btn[data-type="${type}"]`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // 4. 表示を更新
        updateDisplay(type);
    });
});
	
});