/**
 *  読書・映画記録 完全版
 */

let booksData = [];
let moviesData = [];
let currentSort = { books: { key: 'date', asc: false }, movies: { key: 'date', asc: false } };

// 1. データ読み込み
async function loadAppData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('JSON読み込み失敗');
        const data = await response.json();
        
        booksData = data.books || [];
        moviesData = data.movies || [];

        // 初期表示
        updateDisplay('books');
        updateDisplay('movies');
        setupFilters(); // タグ選択肢の作成
    } catch (error) {
        console.error("Error:", error);
    }
}

// 2. 星の生成（記号を直接返す版）
function generateStars(rating) {
    const r = parseFloat(rating);
    const full = Math.floor(r);
    const half = (r % 1 !== 0) ? 1 : 0;
    const empty = 5 - full - half;
    
    // 記号を直接返すと、innerHTML で渡したときにブラウザが正しく「★」として描画します
    return '★'.repeat(full) + 
           (half ? '☆' : '') + 
           '☆'.repeat(empty);
}

// 3. 画面描画とソート/タグの反映
function updateDisplay(type) {
    const data = type === 'books' ? booksData : moviesData;
    const grid = document.getElementById(`${type}Grid`);
    const searchVal = document.getElementById(`searchBox${type.charAt(0).toUpperCase() + type.slice(1)}`).value.toLowerCase();
    const tagVal = document.getElementById(`tagFilter${type.charAt(0).toUpperCase() + type.slice(1)}`).value;
    
    // 検索＆タグフィルタリング
    let filtered = data.filter(item => {
        const text = (item.title + (item.author || item.director) + (item.tags || "")).toLowerCase();
        const matchesSearch = text.includes(searchVal);
        const matchesTag = tagVal === "" || (item.tags || "").split(',').map(t => t.trim()).includes(tagVal);
        return matchesSearch && matchesTag;
    });

    // ソート処理と矢印更新
    const sortInfo = currentSort[type];
    filtered.sort((a, b) => {
        let valA = a[sortInfo.key === 'date' ? (type === 'books' ? 'finishedDate' : 'watchedDate') : sortInfo.key];
        let valB = b[sortInfo.key === 'date' ? (type === 'books' ? 'finishedDate' : 'watchedDate') : sortInfo.key];
        return sortInfo.asc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    // 矢印の更新
    document.getElementById(`${sortInfo.key}Order${type.charAt(0).toUpperCase() + type.slice(1)}`).textContent = sortInfo.asc ? '↑' : '↓';

    // 描画
    grid.innerHTML = filtered.map(item => `
        <div class="book-card" onclick="openModal('${type}', '${item.title.replace(/'/g, "\\'")}')">
            <img src="${item.coverUrl || item.posterUrl}" class="book-cover">
            <div class="book-info">
                <div class="book-title">${item.title}</div>
                <div class="book-author">${item.author || item.director}</div>
                <div class="book-date">${item.finishedDate || item.watchedDate}</div>
                <div class="book-rating">${generateStars(item.rating)}</div>
            </div>
        </div>
    `).join('');

    document.getElementById(`noResults${type.charAt(0).toUpperCase() + type.slice(1)}`).style.display = filtered.length === 0 ? 'block' : 'none';
}

// 4. モーダル（詳細）を開く
function openModal(type, title) {
    const data = type === 'books' ? booksData : moviesData;
    const item = data.find(d => d.title === title);
    if (!item) return;

    document.getElementById('modalTitle').textContent = item.title;
    // 星のコードを変換して表示（ここで処理！）
    document.getElementById('modalRating').innerHTML = generateStars(item.rating);
    // ... (他の要素はそのまま)
    document.getElementById('modalTags').innerHTML = (item.tags || "").split(',').map(t => `<span class="tag-badge">${t.trim()}</span>`).join('');
    document.getElementById('modal').classList.add('active');
}

// タグフィルターの自動生成
function setupFilters() {
    ['Books', 'Movies'].forEach(type => {
        const select = document.getElementById(`tagFilter${type}`);
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

// 5. イベント設定
document.addEventListener('DOMContentLoaded', () => {
    loadAppData();

    // タブ切り替え
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}Tab`).classList.add('active');
        };
    });

    // 検索入力
    ['Books', 'Movies'].forEach(type => {
        document.getElementById(`searchBox${type}`).oninput = () => updateDisplay(type.toLowerCase());
    });

    // 並び替えボタン
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.type;
            const sortKey = btn.dataset.sort;
            currentSort[type].asc = !currentSort[type].asc;
            currentSort[type].key = sortKey;
            
            document.querySelectorAll(`.sort-btn[data-type="${type}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateDisplay(type);
        };
    });

    // モーダル閉じる
    document.getElementById('modalClose').onclick = () => document.getElementById('modal').classList.remove('active');
});

// タグフィルターのセットアップ（必要であれば）
function setupFilters() {}