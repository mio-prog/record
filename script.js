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

async function loadAppData() {
    try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) throw new Error('データ読み込み失敗');
        const allData = await response.json();
        
        // シートから取得した全データを、type列を見て振り分ける
        booksData = allData.filter(item => item.type === 'book');
        moviesData = allData.filter(item => item.type === 'movie');

        updateDisplay('books');
        updateDisplay('movies');
        setupFilters();
    } catch (error) {
        console.error("Error:", error);
    }
}

// 星の生成（CSSで塗りつぶす賢い方法）
function generateStars(rating) {
    const r = parseFloat(rating);
    // 5段階評価のうち、何パーセント分を金色にするか計算します
    const percentage = (r / 5) * 100 -0.5;
    
    return `
        <div class="rating-container">
            ★★★★★
            <div class="rating-fill" style="width: ${percentage}%">★★★★★</div>
        </div>
    `;
}
// 画面描画
function updateDisplay(type) {
    const data = type === 'books' ? booksData : moviesData;
    const grid = document.getElementById(`${type}Grid`);
    const searchBox = document.getElementById(`searchBox${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const tagFilter = document.getElementById(`tagFilter${type.charAt(0).toUpperCase() + type.slice(1)}`);
    
    if (!searchBox || !tagFilter) return;

    const searchVal = searchBox.value.toLowerCase();
    const tagVal = tagFilter.value;
    
    let filtered = data.filter(item => {
        const text = (item.title + (item.author || item.director) + (item.tags || "")).toLowerCase();
        const matchesSearch = text.includes(searchVal);
        const matchesTag = tagVal === "" || (item.tags || "").split(',').map(t => t.trim()).includes(tagVal);
        return matchesSearch && matchesTag;
    });

    const sortInfo = currentSort[type];
    filtered.sort((a, b) => {
        let valA = a[sortInfo.key === 'date' ? (type === 'books' ? 'finishedDate' : 'watchedDate') : sortInfo.key] || "";
        let valB = b[sortInfo.key === 'date' ? (type === 'books' ? 'finishedDate' : 'watchedDate') : sortInfo.key] || "";
        return sortInfo.asc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    const orderEl = document.getElementById(`${sortInfo.key}Order${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (orderEl) orderEl.textContent = sortInfo.asc ? '↑' : '↓';

    grid.innerHTML = filtered.map(item => `
        <div class="book-card" onclick="openModal('${type}', '${item.title.replace(/'/g, "\\'")}')">
            <img src="img/${type === 'books' ? 'book' : 'movie'}/${item.coverUrl || item.posterUrl}" class="book-cover" onerror="this.src='img/no-image.png'">
            <div class="book-info">
                <div class="book-title">${item.title}</div>
                <div class="book-author">${item.author || item.director}</div>
                <div class="book-date">${item.finishedDate || item.watchedDate}</div>
                <div class="book-rating">${generateStars(item.rating)}</div>
            </div>
        </div>
    `).join('');

    const noRes = document.getElementById(`noResults${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (noRes) noRes.style.display = filtered.length === 0 ? 'block' : 'none';
}

// モーダルを開く（感想・あらすじ反映）
function openModal(type, title) {
    const data = type === 'books' ? booksData : moviesData;
    const item = data.find(d => d.title === title);
    if (!item) return;

    document.getElementById('modalTitle').textContent = item.title;
    document.getElementById('modalAuthor').textContent = item.author || item.director;
    document.getElementById('modalDate').textContent = item.finishedDate || item.watchedDate;
    document.getElementById('modalRating').innerHTML = generateStars(item.rating);
    document.getElementById('modalReview').innerHTML = (item.review || "").replace(/\n/g, '<br>');
    document.getElementById('modalSynopsis').textContent = item.synopsis || "記載なし";
    document.getElementById('modalTags').innerHTML = (item.tags || "").split(',').map(t => {
    const tag = t.trim();
    // クリック時に filterByTag 関数を呼ぶ
    return `<span class="tag-badge" onclick="filterByTag('${type}', '${tag}')" style="cursor:pointer;">${tag}</span>`;
}).join('');
    document.getElementById('modalCover').innerHTML = `<img src="img/${type === 'books' ? 'book' : 'movie'}/${item.coverUrl || item.posterUrl}" class="book-cover" onerror="this.src='img/no-image.png'">`;
    document.getElementById('modal').classList.add('active');
}

// タグフィルター設定
function setupFilters() {
    ['Books', 'Movies'].forEach(type => {
        const select = document.getElementById(`tagFilter${type}`);
        if (!select) return;
        const allTags = new Set();
        (type === 'Books' ? booksData : moviesData).forEach(item => {
            (item.tags || "").split(',').forEach(t => { if(t.trim()) allTags.add(t.trim()); });
        });
        allTags.forEach(tag => {
            const opt = document.createElement('option');
            opt.value = tag; opt.textContent = tag;
            select.appendChild(opt);
        });
        select.onchange = () => updateDisplay(type.toLowerCase());
    });
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

function filterByTag(type, tagName) {
    // 1. フィルターのセレクトボックスをタグの名前に合わせる
    const select = document.getElementById(`tagFilter${type.charAt(0).toUpperCase() + type.slice(1)}`);
    select.value = tagName;
    
    // 2. モーダルを閉じる
    document.getElementById('modal').classList.remove('active');
    
    // 3. 表示を更新
    updateDisplay(type);
    
    // 4. もし別のタブがアクティブなら切り替える（必要であれば）
    // （今は同じタブ内で動く前提でOKです）
}