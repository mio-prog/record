/**
 * 読書・映画記録 完全版（グラフ描画対応）
 */
let booksData = [];
let moviesData = [];
let currentSort = { 
    books: { key: 'date', asc: false }, 
    movies: { key: 'date', asc: false } 
};
let genreChart = null; // グラフを保持する変数

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbw3_O5HjDqZQ-3DbHn3WiiRmDWVRu8cwI2A4fIb2xUsLHEbRGWqHaXPolNmwcUWsYer/exec';

// --- 1. 統計・グラフ描画関数 ---
function updateStats() {
    const totalBooksEl = document.getElementById('totalBooks');
    const totalMoviesEl = document.getElementById('totalMovies');
    const avgRatingEl = document.getElementById('avgRating');
    
    if (totalBooksEl) totalBooksEl.textContent = booksData.length;
    if (totalMoviesEl) totalMoviesEl.textContent = moviesData.length;
    
    const allData = [...booksData, ...moviesData];
    const totalRating = allData.reduce((sum, item) => sum + (parseFloat(item.rating) || 0), 0);
    const avg = allData.length > 0 ? (totalRating / allData.length).toFixed(1) : "0.0";
    if (avgRatingEl) avgRatingEl.textContent = avg;

    // グラフ描画
    drawGenreChart();
}

function drawGenreChart() {
    const canvas = document.getElementById('genreChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const allData = [...booksData, ...moviesData];
    const counts = {};
    allData.forEach(item => {
        const g = item.genre || "未分類";
        counts[g] = (counts[g] || 0) + 1;
    });

    if (genreChart) genreChart.destroy();

    genreChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40']
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

// --- 2. データ読み込み＆表示処理 ---
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

function renderData(allData) {
    booksData = allData.filter(item => item.type === 'book');
    moviesData = allData.filter(item => item.type === 'movie');
    updateDisplay('books');
    updateDisplay('movies');
    setupFilters();
    updateStats(); 
}

// --- 3. その他の共通関数 ---
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

    grid.innerHTML = filtered.map(item => `
        <div class="book-card" onclick="openModal('${type}', '${item.title.replace(/'/g, "\\'")}')">
            <img src="img/${type === 'books' ? 'book' : 'movie'}/${item.coverUrl}" class="book-cover" onerror="this.src='img/no-image.png'">
            <div class="book-info">
                <div class="book-title">${item.title}</div>
                <div class="book-author">${item.creator || ""}</div>
                <div class="book-date">${formatJSTDate(item.date)}</div>
                <div class="book-rating">${generateStars(item.rating)}</div>
            </div>
        </div>
    `).join('');

    const noRes = document.getElementById(`noResults${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (noRes) noRes.style.display = filtered.length === 0 ? 'block' : 'none';
}

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

function filterByAuthor(type, authorName) {
    const typeUpper = type.charAt(0).toUpperCase() + type.slice(1);
    const searchBox = document.getElementById(`searchBox${typeUpper}`);
    if (searchBox) {
        searchBox.value = authorName;
        document.getElementById('modal').classList.remove('active');
        updateDisplay(type);
    }
}

function generateStars(rating) {
    const r = parseFloat(rating) || 0;
    const percent = (r / 5) * 100 + 0.8;
    return `<div class="star-rating"><div class="star-base">★★★★★</div><div class="star-current" style="width: ${percent}%">★★★★★</div></div>`;
}

function formatJSTDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function openModal(type, title) {
    const data = type === 'books' ? booksData : moviesData;
    const item = data.find(d => d.title === title);
    if (!item) return;

    document.getElementById('modalTitle').textContent = item.title;
    const authorName = item.creator || "";
    const modalAuthorEl = document.getElementById('modalAuthor');
    if (authorName) {
        modalAuthorEl.innerHTML = `<span class="clickable-author" onclick="filterByAuthor('${type}', '${authorName.replace(/'/g, "\\'")}')">${authorName}</span>`;
    } else {
        modalAuthorEl.textContent = "";
    }

    document.getElementById('modalDate').textContent = formatJSTDate(item.date);
    document.getElementById('modalRating').innerHTML = generateStars(item.rating);
    document.getElementById('modalCover').innerHTML = `<img src="img/${type === 'books' ? 'book' : 'movie'}/${item.coverUrl}" class="book-cover" onerror="this.src='img/no-image.png'">`;
    document.getElementById('modalReview').innerHTML = (item.review || "").replace(/\n/g, '<br>');
    document.getElementById('modalSynopsis').textContent = item.synopsis || "記載なし";
    document.getElementById('modalTags').innerHTML = (item.tags || "").split(',').map(t => {
        const tag = t.trim();
        return tag ? `<span class="tag-badge" onclick="filterByTag('${type}', '${tag}')" style="cursor:pointer;">${tag}</span>` : "";
    }).join('');

    document.getElementById('modal').classList.add('active');
}

// --- 4. 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    loadAppData();
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const targetTab = btn.dataset.tab;
            document.getElementById(`${targetTab}Tab`).classList.add('active');
            if (targetTab !== 'stats') clearFilters(targetTab);
        };
    });
    
    ['Books', 'Movies'].forEach(type => {
        document.getElementById(`searchBox${type}`).oninput = () => updateDisplay(type.toLowerCase());
    });
    
    document.getElementById('modalClose').onclick = () => document.getElementById('modal').classList.remove('active');
    
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const sortKey = btn.dataset.sort;
            currentSort[type].key = sortKey;
            currentSort[type].asc = !currentSort[type].asc;
            const arrow = btn.querySelector('span');
            if (arrow) arrow.textContent = currentSort[type].asc ? '↑' : '↓';
            document.querySelectorAll(`.sort-btn[data-type="${type}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateDisplay(type);
        });
    });
});