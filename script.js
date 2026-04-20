// JavaScript Document
// 読書・映画記録 完全版 //

let booksData = [];
let moviesData = [];
let wishlistData = [];
let currentSort = {
    books: { key: 'date', asc: false },
    movies: { key: 'date', asc: false }
};
let favoriteFilter = { books: false, movies: false };
let genreChart = null; 
let myYearlyChart = null; 
let currentYear = "all"; 

// Wishlistから昇格する際の一時保存用変数
let currentTargetType = "";
let currentTargetCreator = "";

// 新規追加フォーム用：選択した候補の一時保存
let selectedCandidate = null;
let addLogType = "book";

// 編集モード用：現在編集中のアイテム
let editingItem = null;
let editingType = "";

const BOOK_GENRES = ["ビジネス","自己啓発","小説","ミステリー","SF","ファンタジー","歴史","自然科学","テクノロジー","デザイン","エッセイ","マンガ"];
const MOVIE_GENRES = ["アニメ","アクション","コメディ","ドラマ","ホラー","SF","ファンタジー","ミステリー","サスペンス","青春","ドキュメンタリー"];

const genreColors = {
    "ビジネス": "#a3c4f3",
    "自然科学": "#90dbf4",
    "小説": "#ffcfd2",
    "アニメ": "#cfbaf0",
    "ドラマ": "#f1c0e8",
    "未分類": "#e2e2e2"
};
const extraColors = ['#b9fbc0', '#fbf8cc', '#fde4cf', '#ffcfd2', '#f1c0e8', '#cfbaf0', '#a3c4f3', '#90dbf4', '#8eecf5', '#98f5e1'];

// あなたのGAS URL
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwRewChtzrow2WHE1PjgZc-ofEOowhbh6Ko64YD0hLbZUzNGb-sZNs4adV-W874K6WS/exec';

// デバウンス：連続入力の最後から指定ms後に関数を実行する
function debounce(fn, ms) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

// ============================================================
// 1. 統計・グラフ描画関数
// ============================================================

function changeYear(direction) {
    const allData = [...booksData, ...moviesData];
    const availableYears = [...new Set(allData.map(item => new Date(item.date).getFullYear()))].sort();
    if (currentYear === "all") {
        currentYear = direction > 0 ? availableYears[0] : availableYears[availableYears.length - 1];
    } else {
        let index = availableYears.indexOf(currentYear);
        index += direction;
        if (index < 0 || index >= availableYears.length) currentYear = "all";
        else currentYear = availableYears[index];
    }
    updateStats(); 
    renderStats();
}

function updateStats() {
    const allDataRaw = [...booksData, ...moviesData];
    const displayData = currentYear === "all" 
        ? allDataRaw 
        : allDataRaw.filter(item => new Date(item.date).getFullYear() === currentYear);

    const yearDisplayEl = document.getElementById('currentYearDisplay');
    if (yearDisplayEl) yearDisplayEl.textContent = currentYear === "all" ? "全期間" : `${currentYear}年`;
    
    const totalBooksEl = document.getElementById('totalBooks');
    const totalMoviesEl = document.getElementById('totalMovies');
    const avgRatingEl = document.getElementById('avgRating');
    if (totalBooksEl) totalBooksEl.textContent = displayData.filter(d => d.type === 'book').length;
    if (totalMoviesEl) totalMoviesEl.textContent = displayData.filter(d => d.type === 'movie').length;
    
    const totalRating = displayData.reduce((sum, item) => sum + (parseFloat(item.rating) || 0), 0);
    if (avgRatingEl) avgRatingEl.textContent = displayData.length > 0 ? (totalRating / displayData.length).toFixed(1) : "0.0";

    drawGenreChart(displayData);
}

function drawGenreChart(dataForChart) {
    const canvas = document.getElementById('genreChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const counts = {};
    dataForChart.forEach(item => {
        const g = item.genre || "未分類";
        counts[g] = (counts[g] || 0) + 1;
    });
    const labels = Object.keys(counts);
    const values = Object.values(counts);
    const backgroundColors = labels.map((label, index) => genreColors[label] || extraColors[index % extraColors.length]);
    if (genreChart !== null) genreChart.destroy();
    genreChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: backgroundColors }] },
        options: {
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(255,255,255,0.9)', titleColor: '#333', bodyColor: '#333',
                    borderColor: '#ddd', borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            return ` ${value}件 (${((value / total) * 100).toFixed(1)}%)`;
                        }
                    }
                }
            },
            cutout: '50%'
        }
    });
    const legendContainer = document.getElementById('customLegend');
    if (legendContainer) {
        legendContainer.innerHTML = '';
        labels.forEach((label, index) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `<span class="legend-box" style="background:${backgroundColors[index]}"></span><span class="legend-text">${label}</span>`;
            legendContainer.appendChild(item);
        });
    }
}

function renderStats() {
    const yearlyCtx = document.getElementById('yearlyChart');
    if (!yearlyCtx) return;
    if (myYearlyChart) myYearlyChart.destroy();
    const selectedYear = parseInt(currentYear);
    if (currentYear === "all" || isNaN(selectedYear)) {
        yearlyCtx.parentElement.style.display = 'none';
        return;
    }
    yearlyCtx.parentElement.style.display = 'block';
    const monthlyLabels = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
    const monthlyBookData = new Array(12).fill(0);
    const monthlyMovieData = new Array(12).fill(0);
    [...booksData, ...moviesData].forEach(item => {
        const d = new Date(item.date);
        if (d.getFullYear() === selectedYear) {
            const idx = d.getMonth();
            if (item.type === 'book') monthlyBookData[idx]++;
            else if (item.type === 'movie') monthlyMovieData[idx]++;
        }
    });
    myYearlyChart = new Chart(yearlyCtx, {
        type: 'bar',
        data: {
            labels: monthlyLabels,
            datasets: [
                { label: '本 📖', data: monthlyBookData, backgroundColor: '#a3c4f3', borderRadius: 4 },
                { label: '映画 🎬', data: monthlyMovieData, backgroundColor: '#ffd1dc', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, min: 0, max: 5, ticks: { stepSize: 1 } } },
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: `${selectedYear}年 月別記録` }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) showMonthlyDetail(selectedYear, elements[0].index);
            }
        }
    });
}

function showMonthlyDetail(year, monthIdx) {
    const allData = [...booksData, ...moviesData];
    const targets = allData.filter(item => {
        const d = new Date(item.date);
        return d.getFullYear() === year && d.getMonth() === monthIdx;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (targets.length === 0) return;

    const titleEl = document.getElementById('monthlyModalTitle');
    if (titleEl) titleEl.textContent = `${year}年 ${monthIdx + 1}月 の記録`;
    const container = document.getElementById('monthlyListContainer');
    if (!container) return;
    container.innerHTML = targets.map(item => {
        const dataType = item.type === 'book' ? 'books' : 'movies';
        const escapedTitle = item.title.replace(/'/g, "\\'");
        return `
            <div class="mini-item-card" onclick="
                document.getElementById('monthlyModal').classList.remove('active'); 
                const tabBtn = document.querySelector('.tab-btn[data-tab=\\'${dataType}\\']');
                if(tabBtn) tabBtn.click();
                openModal('${dataType}', '${escapedTitle}');
            ">
                <img src="${item.coverUrl}" class="mini-item-thumb" onerror="this.src='img/no-image.png'">
                <div class="mini-item-title">${item.title}</div>
            </div>`;
    }).join('');
    document.getElementById('monthlyModal').classList.add('active');
}

// ============================================================
// 2. データ読み込み＆表示処理
// ============================================================

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
    const logs = allData.logs || [];
    wishlistData = allData.wishlist || [];
    booksData = logs.filter(item => item.type === 'book');
    moviesData = logs.filter(item => item.type === 'movie');
    updateDisplay('books');
    updateDisplay('movies');
    setupFilters();
    updateStats();
    renderStats();
    renderWishlist();
}

// ============================================================
// 3. 共通・連動関数
// ============================================================

function updateDisplay(type) {
    const data = type === 'books' ? booksData : moviesData;
    const grid = document.getElementById(`${type}Grid`);
    const typeUpper = type.charAt(0).toUpperCase() + type.slice(1);
    const searchBox = document.getElementById(`searchBox${typeUpper}`);
    const genreFilter = document.getElementById(`genreFilter${typeUpper}`);
    if (!grid || !searchBox || !genreFilter) return;

    const searchVal = searchBox.value.toLowerCase();
    const genreVal = genreFilter.value;
    let filtered = data.filter(item => {
        const text = (item.title + (item.creator || "") + (item.tags || "")).toLowerCase();
        return text.includes(searchVal) && (genreVal === "" || (item.genre || "") === genreVal);
    });
    if (favoriteFilter[type]) filtered = filtered.filter(item => item.favorite);
    const sortInfo = currentSort[type];
    filtered.sort((a, b) => {
        let valA = a[sortInfo.key] || "";
        let valB = b[sortInfo.key] || "";
        return sortInfo.asc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
    const favBtn = document.getElementById(`favFilter${typeUpper}`);
    if (favBtn) favBtn.classList.toggle('active', favoriteFilter[type]);
    grid.innerHTML = filtered.map(item => {
        const escapedTitle = item.title.replace(/'/g, "\\'");
        const isFav = !!item.favorite;
        return `
        <div class="book-card" onclick="openModal('${type}', '${escapedTitle}')">
            <button class="fav-btn" onclick="toggleFavoriteItem('${type}','${escapedTitle}',${isFav},event)" title="${isFav ? 'お気に入り解除' : 'お気に入りに追加'}"><svg viewBox="0 0 24 24" width="14" height="14" fill="${isFav ? '#e0698a' : 'none'}" stroke="${isFav ? '#e0698a' : '#aaa'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></button>
            <img src="${item.coverUrl}" class="book-cover" onerror="this.src='img/no-image.png'">
            <div class="book-info">
                <div class="book-title">${item.title}</div>
                <div class="book-author">${item.creator || ""}</div>
                <div class="book-date">${formatJSTDate(item.date)}</div>
                <div class="book-rating">${generateStars(item.rating)}</div>
            </div>
        </div>`;
    }).join('');
    const noRes = document.getElementById(`noResults${typeUpper}`);
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
    const sBox = document.getElementById(`searchBox${typeUpper}`);
    const gFilter = document.getElementById(`genreFilter${typeUpper}`);
    if(sBox) sBox.value = '';
    if(gFilter) gFilter.value = '';
    favoriteFilter[type] = false;
    updateDisplay(type);
}

function toggleFavFilter(type) {
    favoriteFilter[type] = !favoriteFilter[type];
    updateDisplay(type);
}

async function toggleFavoriteItem(type, title, currentVal, event) {
    event.stopPropagation();
    const newVal = !currentVal;
    const data = type === 'books' ? booksData : moviesData;
    const item = data.find(i => i.title === title);
    if (!item) return;
    item.favorite = newVal;
    updateDisplay(type);
    try {
        const response = await fetch(SHEET_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'toggleFavorite', title, favorite: newVal })
        });
        if (response.ok) {
            localStorage.removeItem('appData_cache');
            localStorage.removeItem('appData_time');
        }
    } catch(e) {
        item.favorite = currentVal;
        updateDisplay(type);
    }
}

function filterByTag(type, tagName) {
    const targetTab = type.endsWith('s') ? type : type + 's';
    document.querySelector(`.tab-btn[data-tab="${targetTab}"]`)?.click();
    const typeUpper = targetTab.charAt(0).toUpperCase() + targetTab.slice(1);
    const sBox = document.getElementById(`searchBox${typeUpper}`);
    if(sBox) {
        sBox.value = tagName;
        document.getElementById('modal').classList.remove('active');
        updateDisplay(targetTab);
    }
}

function filterByAuthor(type, authorName) {
    const targetTab = type.endsWith('s') ? type : type + 's';
    document.querySelector(`.tab-btn[data-tab="${targetTab}"]`)?.click();
    const typeUpper = targetTab.charAt(0).toUpperCase() + targetTab.slice(1);
    const searchBox = document.getElementById(`searchBox${typeUpper}`);
    if (searchBox) {
        searchBox.value = authorName;
        document.getElementById('modal').classList.remove('active');
        updateDisplay(targetTab);
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
    if (isNaN(date.getTime())) return dateString;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ============================================================
// 4. 詳細モーダル（表示 + 編集モード切替）
// ============================================================

function openModal(type, title) {
    const data = type === 'books' ? booksData : moviesData;
    const item = data.find(d => d.title === title);
    if (!item) return;
    editingItem = item;
    editingType = type;
    renderModalViewMode(item, type);
    document.getElementById('modal').classList.add('active');
}

function renderModalViewMode(item, type) {
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
    document.getElementById('modalCover').innerHTML = `<img src="${item.coverUrl}" class="book-cover" onerror="this.src='img/no-image.png'">`;
    document.getElementById('modalReview').innerHTML = (item.review || "").replace(/\n/g, '<br>');
    document.getElementById('modalSynopsis').textContent = item.synopsis || "記載なし";
    document.getElementById('modalTags').innerHTML = (item.tags || "").split(',').map(t => {
        const tag = t.trim();
        return tag ? `<span class="tag-badge" onclick="filterByTag('${type}', '${tag}')" style="cursor:pointer;">${tag}</span>` : "";
    }).join('');
    document.getElementById('modalEditBtn').style.display = 'inline-flex';
    document.getElementById('modalSaveBtn').style.display = 'none';
    document.getElementById('modalDeleteBtn').style.display = 'inline-flex';
    document.getElementById('deleteConfirmArea').style.display = 'none';
    setModalEditMode(false);
}

function setModalEditMode(isEdit) {
    // 中身の要素を切り替え
    ['modalDate','modalRating','modalReview','modalSynopsis'].forEach(id => {
        document.getElementById(id).style.display = isEdit ? 'none' : 'block';
    });
    document.getElementById('modalTags').style.display = isEdit ? 'none' : 'flex';

    // 感想・あらすじ・タグのセクション（見出し含む）をまとめて切り替え
    document.querySelectorAll('#modal .modal-section').forEach(section => {
        section.style.display = isEdit ? 'none' : 'block';
    });

    document.getElementById('editFieldsArea').style.display = isEdit ? 'block' : 'none';
    document.getElementById('modalEditBtn').style.display = isEdit ? 'none' : 'inline-flex';
    document.getElementById('modalSaveBtn').style.display = isEdit ? 'inline-flex' : 'none';
}

function openEditMode() {
    if (!editingItem) return;
    const item = editingItem;
    const genreList = editingType === 'books' ? BOOK_GENRES : MOVIE_GENRES;
    const genreOptions = genreList.map(g =>
        `<option value="${g}" ${g === item.genre ? 'selected' : ''}>${g}</option>`
    ).join('');

    document.getElementById('editFieldsArea').innerHTML = `
        <div class="edit-field-group">
            <label class="edit-label">📅 日付</label>
            <input type="date" id="editDate" class="edit-input" value="${formatJSTDate(item.date)}">
        </div>
        <div class="edit-field-group">
            <label class="edit-label">⭐ 評価</label>
            <div style="display:flex; align-items:center; gap:12px;">
                <input type="range" id="editRating" min="0" max="5" step="0.5" value="${item.rating || 0}"
                       style="flex:1; accent-color:#ffca28;"
                       oninput="document.getElementById('editRatingValue').textContent = parseFloat(this.value).toFixed(1)">
                <span id="editRatingValue" style="font-weight:bold; color:#ffca28; font-size:1.3rem; min-width:32px;">
                    ${parseFloat(item.rating || 0).toFixed(1)}
                </span>
            </div>
        </div>
        <div class="edit-field-group">
            <label class="edit-label">🏷️ タグ <span class="edit-hint">カンマ区切りで入力</span></label>
            <input type="text" id="editTags" class="edit-input" value="${item.tags || ''}" placeholder="タグ1, タグ2, タグ3">
        </div>
        <div class="edit-field-group">
            <label class="edit-label">📂 ジャンル</label>
            <select id="editGenre" class="edit-input">${genreOptions}</select>
        </div>
        <div class="edit-field-group">
            <label class="edit-label">📝 感想</label>
            <textarea id="editReview" class="edit-input edit-textarea" rows="5">${item.review || ''}</textarea>
        </div>
    `;
    setModalEditMode(true);
}

async function saveEditedItem() {
    if (!editingItem) return;
    const saveBtn = document.getElementById('modalSaveBtn');
    saveBtn.textContent = '保存中...';
    saveBtn.disabled = true;
    const data = {
        action: 'updateLog',
        originalTitle: editingItem.title,
        type: editingType === 'books' ? 'book' : 'movie',
        date: document.getElementById('editDate').value.replace(/-/g, '/'),
        rating: document.getElementById('editRating').value,
        tags: document.getElementById('editTags').value,
        genre: document.getElementById('editGenre').value,
        review: document.getElementById('editReview').value
    };
    await sendToGAS(data, saveBtn, '💾 保存');
}

function openDeleteConfirm() {
    // 編集モードを閉じて削除確認を表示
    setModalEditMode(false);
    document.getElementById('editFieldsArea').style.display = 'none';
    document.getElementById('modalEditBtn').style.display = 'none';
    document.getElementById('modalDeleteBtn').style.display = 'none';

    document.getElementById('deleteConfirmTitle').textContent = `「${editingItem.title}」`;
    document.getElementById('deleteConfirmArea').style.display = 'block';

    // modal-bodyも隠す
    document.querySelector('#modal .modal-body').style.display = 'none';
}

function cancelDelete() {
    document.getElementById('deleteConfirmArea').style.display = 'none';
    document.getElementById('modalEditBtn').style.display = 'inline-flex';
    document.getElementById('modalDeleteBtn').style.display = 'inline-flex';
    document.querySelector('#modal .modal-body').style.display = 'block';
}

async function executeDelete() {
    if (!editingItem) return;
    const btn = document.getElementById('deleteExecuteBtn');
    btn.textContent = '削除中...';
    btn.disabled = true;
    const data = {
        action: 'deleteLog',
        title: editingItem.title,
        type: editingType === 'books' ? 'book' : 'movie'
    };
    await sendToGAS(data, btn, '削除する');
}

// ============================================================
// Wishlist追加モーダル：検索補完
// ============================================================

let wishSelectedCandidate = null;

function openAddWishModal() {
    wishSelectedCandidate = null;
    document.getElementById('wishTypeBook').checked = true;
    document.getElementById('wishSearchInput').value = '';
    document.getElementById('wishCreatorInput').value = '';
    document.getElementById('wishSearchStatus').style.display = 'none';
    document.getElementById('wishCandidates').innerHTML = '';
    document.getElementById('newMemo').value = '';
    document.getElementById('newLink').value = '';
    document.getElementById('newMemoManual').value = '';
    document.getElementById('newLinkManual').value = '';
    document.getElementById('newTitleManual').value = '';
    document.getElementById('newCreatorManual').value = '';
    document.getElementById('addWishStep1').style.display = 'block';
    document.getElementById('addWishStep2').style.display = 'none';
    document.getElementById('addWishStep2Manual').style.display = 'none';
    document.getElementById('addWishModal').classList.add('active');

    // Enterキー検索 + インクリメンタルサーチ（1秒デバウンス）
    const input = document.getElementById('wishSearchInput');
    const creatorInput = document.getElementById('wishCreatorInput');
    const doSearch = debounce(() => executeWishSearch(), 1000);
    input.onkeydown = (e) => { if (e.key === 'Enter') executeWishSearch(); };
    input.oninput = doSearch;
    // 著者名欄の変更でも再検索
    creatorInput.onkeydown = (e) => { if (e.key === 'Enter') executeWishSearch(); };
    creatorInput.oninput = doSearch;
}

async function executeWishSearch() {
    const query = document.getElementById('wishSearchInput').value.trim();
    if (!query) return;
    const type = document.querySelector('input[name="wishType"]:checked').value;
    const creator = document.getElementById('wishCreatorInput').value.trim();
    const statusEl = document.getElementById('wishSearchStatus');
    const candidatesEl = document.getElementById('wishCandidates');

    statusEl.innerHTML = '<span class="search-spinner"></span> 検索中...';
    statusEl.style.display = 'block';
    candidatesEl.innerHTML = '';

    try {
        const creatorParam = creator ? `&creator=${encodeURIComponent(creator)}` : '';
        const url = `${SHEET_URL}?action=search&type=${encodeURIComponent(type)}&q=${encodeURIComponent(query)}${creatorParam}`;
        const res = await fetch(url);
        const data = await res.json();
        const results = data.results || [];

        if (results.length === 0) {
            statusEl.textContent = '候補が見つかりませんでした。著者名を加えて再検索するか、直接入力で追加できます。';
            return;
        }
        statusEl.style.display = 'none';
        candidatesEl.innerHTML = results.map(c =>
            buildCandidateCard(c, `selectWishCandidate(${JSON.stringify(c).replace(/"/g, '&quot;')})`)
        ).join('');
    } catch (err) {
        statusEl.textContent = '検索に失敗しました。直接入力でも追加できます。';
    }
}

function selectWishCandidate(candidate) {
    wishSelectedCandidate = candidate;
    document.getElementById('addWishStep1').style.display = 'none';
    document.getElementById('addWishStep2').style.display = 'block';
    const selectedEl = document.getElementById('wishSelectedInfo');
    if (selectedEl) selectedEl.innerHTML = buildSelectedInfo(candidate);
}

function showWishManualInput() {
    // 検索ボックスに入力中のタイトルをそのまま手動入力欄に引き継ぐ
    const typed = document.getElementById('wishSearchInput').value.trim();
    document.getElementById('newTitleManual').value = typed;
    document.getElementById('addWishStep1').style.display = 'none';
    document.getElementById('addWishStep2Manual').style.display = 'block';
}

// Wishlist削除確認
let wishDeleteTargetTitle = "";

function openWishDeleteConfirm(title) {
    wishDeleteTargetTitle = title;
    document.getElementById('wishDeleteTitle').textContent = `「${title}」`;
    document.getElementById('wishDeleteModal').classList.add('active');
}

async function executeWishDelete() {
    const btn = document.getElementById('wishDeleteExecuteBtn');
    btn.textContent = '削除中...';
    btn.disabled = true;
    await sendToGAS(
        { action: 'deleteWishlist', title: wishDeleteTargetTitle },
        btn, '削除する'
    );
}

// ============================================================
// 5. モーダル操作系（Wishlist）
// ============================================================

function openWishDoneModal(title, type, creator, coverUrl, externalId) {
    currentTargetType = type;
    currentTargetCreator = creator;

    // Wishlist追加時に保存済みの情報があればそのまま使う
    if (coverUrl || externalId) {
        selectedCandidate = {
            title,
            creator,
            coverUrl:   coverUrl || '',
            externalId: externalId || ''
        };
    } else {
        selectedCandidate = null;
    }

    document.getElementById('wishDoneItemName').textContent = title;
    document.getElementById('doneDate').value = new Date().toLocaleDateString('sv-SE');
    document.getElementById('doneMemo').value = '';
    const ratingRange = document.getElementById('ratingRange');
    if (ratingRange) { ratingRange.value = "3.0"; updateStarsRange("3.0"); }

    // 保存済み画像があれば表示、なければ検索
    const selectedEl  = document.getElementById('wishDoneSelectedInfo');
    const statusEl    = document.getElementById('wishDoneSearchStatus');
    const candidatesEl = document.getElementById('wishDoneCandidates');
    candidatesEl.innerHTML = '';

    if (selectedCandidate && selectedCandidate.coverUrl) {
        statusEl.style.display = 'none';
        selectedEl.innerHTML = buildSelectedInfo(selectedCandidate);
        selectedEl.style.display = 'block';
    } else {
        selectedEl.style.display = 'none';
        statusEl.textContent = '🔍 作品情報を検索中...';
        statusEl.style.display = 'block';
        searchCandidatesForWishDone(title, type);
    }

    document.getElementById('wishDoneModal').classList.add('active');
}

function updateStarsRange(val) {
    const el = document.getElementById('starValueRange');
    if (el) el.textContent = parseFloat(val).toFixed(1);
}

// ============================================================
// 6. タイトル検索・候補表示（GAS経由）
// ============================================================

function buildCandidateCard(candidate, onClickFn) {
    const noImg = 'img/no-image.png';
    const meta = [
        candidate.publisher,
        candidate.publishedDate ? candidate.publishedDate + '年' : '',
        candidate.pageCount ? candidate.pageCount + 'p' : ''
    ].filter(Boolean).join(' ／ ');
    return `
        <div class="candidate-card" onclick="${onClickFn}">
            <img src="${candidate.coverUrl || noImg}" class="candidate-cover" onerror="this.src='${noImg}'">
            <div class="candidate-info">
                <div class="candidate-title">${candidate.title}</div>
                <div class="candidate-creator">${candidate.creator || ''}</div>
                ${meta ? `<div class="candidate-meta">${meta}</div>` : ''}
            </div>
        </div>`;
}

function buildSelectedInfo(candidate) {
    const noImg = 'img/no-image.png';
    return `
        <div class="selected-info-inner">
            <img src="${candidate.coverUrl || noImg}" class="selected-cover" onerror="this.src='${noImg}'">
            <div>
                <div class="selected-title">✅ ${candidate.title}</div>
                <div class="candidate-creator">${candidate.creator || ''}</div>
                ${candidate.publishedDate ? `<div class="candidate-meta">${candidate.publishedDate}年</div>` : ''}
            </div>
        </div>`;
}

function resetWishDoneSearchArea() {
    selectedCandidate = null;
    const statusEl = document.getElementById('wishDoneSearchStatus');
    const candidatesEl = document.getElementById('wishDoneCandidates');
    const selectedEl = document.getElementById('wishDoneSelectedInfo');
    if (statusEl) { statusEl.textContent = '🔍 作品情報を検索中...'; statusEl.style.display = 'block'; }
    if (candidatesEl) candidatesEl.innerHTML = '';
    if (selectedEl) selectedEl.style.display = 'none';
}

async function searchCandidatesForWishDone(title, type) {
    const statusEl = document.getElementById('wishDoneSearchStatus');
    const candidatesEl = document.getElementById('wishDoneCandidates');
    try {
        const url = `${SHEET_URL}?action=search&type=${encodeURIComponent(type)}&q=${encodeURIComponent(title)}`;
        const res = await fetch(url);
        const data = await res.json();
        const results = data.results || [];
        if (results.length === 0) {
            if (statusEl) statusEl.textContent = '候補が見つかりませんでした。そのまま保存します。';
            return;
        }
        if (statusEl) statusEl.style.display = 'none';
        if (results.length === 1) { selectWishDoneCandidate(results[0]); return; }
        if (candidatesEl) {
            candidatesEl.innerHTML = results.map(c =>
                buildCandidateCard(c, `selectWishDoneCandidate(${JSON.stringify(c).replace(/"/g, '&quot;')})`)
            ).join('');
        }
    } catch (err) {
        console.error('WishDone検索エラー:', err);
        if (statusEl) statusEl.textContent = '検索に失敗しました。そのまま保存します。';
    }
}

function selectWishDoneCandidate(candidate) {
    selectedCandidate = candidate;
    currentTargetCreator = candidate.creator || currentTargetCreator;
    const candidatesEl = document.getElementById('wishDoneCandidates');
    const selectedEl = document.getElementById('wishDoneSelectedInfo');
    const statusEl = document.getElementById('wishDoneSearchStatus');
    if (candidatesEl) candidatesEl.innerHTML = '';
    if (statusEl) statusEl.style.display = 'none';
    if (selectedEl) { selectedEl.innerHTML = buildSelectedInfo(candidate); selectedEl.style.display = 'block'; }
}

function openAddLogModal(type) {
    addLogType = type;
    selectedCandidate = null;
    const titleEl = document.getElementById('addLogTitle');
    if (titleEl) titleEl.textContent = type === 'book' ? '📚 本を追加' : '🎬 映画を追加';
    document.getElementById('addLogSearchInput').value = '';
    document.getElementById('addLogCreatorInput').value = '';
    document.getElementById('addLogSearchStatus').style.display = 'none';
    document.getElementById('addLogCandidates').innerHTML = '';
    document.getElementById('addLogRating').value = '3.0';
    document.getElementById('addLogRatingValue').textContent = '3.0';
    document.getElementById('addLogDate').value = new Date().toLocaleDateString('sv-SE');
    document.getElementById('addLogReview').value = '';
    document.getElementById('addLogStep1').style.display = 'block';
    document.getElementById('addLogStep2').style.display = 'none';
    document.getElementById('addLogModal').classList.add('active');

    // Enterキー検索 + インクリメンタルサーチ（1秒デバウンス）
    const input = document.getElementById('addLogSearchInput');
    const creatorInput = document.getElementById('addLogCreatorInput');
    const doSearch = debounce(() => executeAddLogSearch(), 1000);
    input.onkeydown = (e) => { if (e.key === 'Enter') executeAddLogSearch(); };
    input.oninput = doSearch;
    // 著者名欄の変更でも再検索
    creatorInput.onkeydown = (e) => { if (e.key === 'Enter') executeAddLogSearch(); };
    creatorInput.oninput = doSearch;
}

async function executeAddLogSearch() {
    const query = document.getElementById('addLogSearchInput').value.trim();
    if (!query) return;
    const creator = document.getElementById('addLogCreatorInput').value.trim();
    const statusEl = document.getElementById('addLogSearchStatus');
    const candidatesEl = document.getElementById('addLogCandidates');
    statusEl.innerHTML = '<span class="search-spinner"></span> 検索中...';
    statusEl.style.display = 'block';
    candidatesEl.innerHTML = '';
    try {
        const creatorParam = creator ? `&creator=${encodeURIComponent(creator)}` : '';
        const url = `${SHEET_URL}?action=search&type=${encodeURIComponent(addLogType)}&q=${encodeURIComponent(query)}${creatorParam}`;
        const res = await fetch(url);
        const data = await res.json();
        const results = data.results || [];
        if (results.length === 0) {
            statusEl.textContent = '候補が見つかりませんでした。著者名を加えて再検索してみてください。';
            return;
        }
        statusEl.style.display = 'none';
        candidatesEl.innerHTML = results.map(c =>
            buildCandidateCard(c, `selectAddLogCandidate(${JSON.stringify(c).replace(/"/g, '&quot;')})`)
        ).join('');
    } catch (err) {
        console.error('AddLog検索エラー:', err);
        statusEl.textContent = '検索に失敗しました。時間をおいて再試行してください。';
    }
}

function selectAddLogCandidate(candidate) {
    selectedCandidate = candidate;
    document.getElementById('addLogStep1').style.display = 'none';
    document.getElementById('addLogStep2').style.display = 'block';
    const selectedEl = document.getElementById('addLogSelectedInfo');
    if (selectedEl) selectedEl.innerHTML = buildSelectedInfo(candidate);
}

// ============================================================
// 7. 送信・保存処理（GAS連携）
// ============================================================

async function sendToGAS(data, btnElement, originalText) {
    try {
        const response = await fetch(SHEET_URL, { method: 'POST', body: JSON.stringify(data) });
        if (response.ok) {
            alert('保存完了しました！');
            localStorage.removeItem('appData_cache');
            localStorage.removeItem('appData_time');
            location.reload();
        }
    } catch (e) {
        alert('保存に失敗しました。通信環境を確認してください。');
        console.error(e);
        if (btnElement) { btnElement.textContent = originalText; btnElement.disabled = false; }
    }
}

// ============================================================
// 8. Wishlist・Timeline描画
// ============================================================

function renderTimeline() {
    const container = document.getElementById('timelineContainer');
    const allData = [...booksData, ...moviesData].sort((a, b) => new Date(b.date) - new Date(a.date));
    let lastMonth = null;
    let html = '';
    allData.forEach((item, index) => {
        const itemDate = new Date(item.date);
        const currentMonth = `${itemDate.getFullYear()}年${itemDate.getMonth() + 1}月`;
        if (currentMonth !== lastMonth) {
            html += `<div class="timeline-month-wrapper"><div class="timeline-month-label">${currentMonth}</div></div>`;
            lastMonth = currentMonth;
        }
        let extraMargin = 20;
        if (index > 0) {
            const diffDays = (new Date(allData[index - 1].date) - itemDate) / (1000 * 60 * 60 * 24);
            extraMargin = Math.min(20 + (diffDays * 8), 150);
        }
        const type = item.type;
        const onClick = `openModal('${type === 'book' ? 'books' : 'movies'}', '${item.title.replace(/'/g, "\\'")}')`;
        html += `
            <div class="timeline-card" onclick="${onClick}" style="margin-bottom: ${extraMargin}px;">
                <div class="card-content">
                    <div class="card-header">
                        <small>${formatJSTDate(item.date)}</small>
                        <img src="${item.coverUrl}" class="card-thumbnail" onerror="this.src='img/no-image.png'">
                    </div>
                    <h4>${item.title}</h4>
                    <div class="star-rating">${generateStars(item.rating)}</div>
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

function renderWishlist() {
    const container = document.getElementById('wishlistGrid');
    if (!container) return;
    const validData = wishlistData.filter(item => item.title && item.title.trim() !== "");
    if (validData.length === 0) {
        container.innerHTML = '<p style="color:white; text-align:center; grid-column:1/-1;">リストは空です。右下の「＋」から追加してみましょう！</p>';
        return;
    }
    container.innerHTML = validData.map(item => {
        const icon = item.type === 'book' ? '📖' : '🎬';
        const typeLabel = item.type === 'book' ? 'Book' : 'Movie';
        const stickyColor = item.type === 'book' ? '#fff9c4' : '#ffd1dc';
        const safeTitle      = item.title.replace(/'/g, "\\'");
        const safeCreator    = (item.creator || '').replace(/'/g, "\\'");
        const safeCoverUrl   = (item.coverUrl || '').replace(/'/g, "\\'");
        const safeExternalId = String(item.externalId || '').replace(/'/g, "\\'");
        const hasCover = item.coverUrl && item.coverUrl.trim() !== '';

        return `
        <div class="wish-card ${hasCover ? 'wish-card--with-cover' : ''}" style="background: ${stickyColor};">
            <div class="wish-card-actions">
                <div class="wish-done-check" title="記録へ昇格"
                     onclick="event.stopPropagation(); openWishDoneModal('${safeTitle}', '${item.type}', '${safeCreator}', '${safeCoverUrl}', '${safeExternalId}')">✔</div>
                <div class="wish-delete-btn" title="削除"
                     onclick="event.stopPropagation(); openWishDeleteConfirm('${safeTitle}')">✕</div>
            </div>
            ${hasCover ? `
            <div class="wish-card-inner">
                <img src="${item.coverUrl}" class="wish-cover" onerror="this.style.display='none'">
                <div class="wish-card-text">
                    <div class="wish-type-badge">${icon} ${typeLabel}</div>
                    <h4>${item.title}</h4>
                    <div class="creator">${item.creator || ''}</div>
                </div>
            </div>
            ` : `
            <div class="wish-type-badge">${icon} ${typeLabel}</div>
            <h4>${item.title}</h4>
            <div class="creator">${item.creator || ''}</div>
            `}
            ${item.memo ? `<div class="memo">${item.memo.replace(/\n/g, '<br>')}</div>` : ''}
            ${item.link ? `<a href="${item.link}" target="_blank" class="wish-link" onclick="event.stopPropagation()">🔗 リンク</a>` : ''}
        </div>`;
    }).join('');
}

// ============================================================
// 9. 初期化とイベントリスナー
// ============================================================

// ============================================================
// 10. おすすめ機能
// ============================================================

const RECOMMEND_CACHE_KEY = 'recommend_cache';
const RECOMMEND_TIME_KEY  = 'recommend_time';
const RECOMMEND_CACHE_MS  = 24 * 60 * 60 * 1000;

async function loadRecommendations(forceRefresh = false) {
    const cached     = localStorage.getItem(RECOMMEND_CACHE_KEY);
    const cachedTime = localStorage.getItem(RECOMMEND_TIME_KEY);
    const isExpired  = !cachedTime || (Date.now() - cachedTime > RECOMMEND_CACHE_MS);

    if (cached && !isExpired && !forceRefresh) {
        renderRecommendations(JSON.parse(cached));
        return;
    }

    document.getElementById('recommendEmpty').style.display   = 'none';
    document.getElementById('recommendContent').style.display = 'none';
    document.getElementById('recommendLoading').style.display = 'flex';

    try {
        const summaryBooks  = booksData.slice(0, 30).map(b => ({ title: b.title, creator: b.creator, genre: b.genre, tags: b.tags, rating: b.rating }));
        const summaryMovies = moviesData.slice(0, 30).map(m => ({ title: m.title, creator: m.creator, genre: m.genre, tags: m.tags, rating: m.rating }));

        const response = await fetch(SHEET_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getRecommendations', books: summaryBooks, movies: summaryMovies })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        localStorage.setItem(RECOMMEND_CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(RECOMMEND_TIME_KEY, Date.now().toString());
        renderRecommendations(data);
    } catch (e) {
        console.error('おすすめ生成エラー:', e);
        document.getElementById('recommendLoading').style.display = 'none';
        const emptyEl = document.getElementById('recommendEmpty');
        emptyEl.textContent = '生成に失敗しました。しばらく待ってから再試行してください。';
        emptyEl.style.display = 'block';
    }
}

function renderRecommendations(data) {
    document.getElementById('recommendLoading').style.display  = 'none';
    document.getElementById('recommendContent').style.display  = 'block';
    document.getElementById('recommendEmpty').style.display    = 'none';
    renderRecommendSection('recommendForYou',  data.forYou   || []);
    renderRecommendSection('recommendDare',    data.dare     || []);
    renderRecommendSection('recommendTrending',data.trending || []);
}

function renderRecommendSection(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = items.map(item => {
        const typeIcon  = item.type === 'book' ? '📖' : '🎬';
        const typeLabel = item.type === 'book' ? 'Book' : 'Movie';
        const safeTitle   = item.title.replace(/'/g, "\\'");
        const safeCreator = (item.creator || '').replace(/'/g, "\\'");
        return `
        <div class="recommend-card">
            <div class="recommend-card-type">${typeIcon} ${typeLabel}</div>
            <div class="recommend-card-title">${item.title}</div>
            <div class="recommend-card-creator">${item.creator || ''}</div>
            <div class="recommend-card-reason">${item.reason || ''}</div>
            <button class="recommend-wish-btn" onclick="openAddWishFromRecommend('${safeTitle}', '${item.type}', '${safeCreator}')">＋ Wishlistへ</button>
        </div>`;
    }).join('');
}

function openAddWishFromRecommend(title, type, creator) {
    openAddWishModal();
    if (type === 'book') {
        document.getElementById('wishTypeBook').checked = true;
    } else {
        document.getElementById('wishTypeMovie').checked = true;
    }
    const input = document.getElementById('wishSearchInput');
    const creatorInput = document.getElementById('wishCreatorInput');
    input.value = title;
    if (creator) creatorInput.value = creator;
    executeWishSearch();
}

document.addEventListener('DOMContentLoaded', () => {
    loadAppData();

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const targetTab = btn.dataset.tab;
            document.getElementById(`${targetTab}Tab`).classList.add('active');
            if (targetTab === 'timeline') renderTimeline();
            else if (targetTab === 'stats') { updateStats(); renderStats(); }
            else if (targetTab === 'wishlist') renderWishlist();
            else if (targetTab === 'recommend') loadRecommendations();
            else clearFilters(targetTab);
        };
    });

    ['Books', 'Movies'].forEach(type => {
        const el = document.getElementById(`searchBox${type}`);
        if(el) el.oninput = () => updateDisplay(type.toLowerCase());
    });

    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            currentSort[type].key = btn.dataset.sort;
            currentSort[type].asc = !currentSort[type].asc;
            const arrow = btn.querySelector('span');
            if (arrow) arrow.textContent = currentSort[type].asc ? '↑' : '↓';
            document.querySelectorAll(`.sort-btn[data-type="${type}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateDisplay(type);
        });
    });

    // モーダルの閉じるボタン
    document.getElementById('modalClose').onclick = () => {
        document.getElementById('modal').classList.remove('active');
        editingItem = null; editingType = "";
    };
    document.getElementById('monthlyModalClose')?.addEventListener('click', () => document.getElementById('monthlyModal').classList.remove('active'));
    document.getElementById('wishDoneClose')?.addEventListener('click', () => document.getElementById('wishDoneModal').classList.remove('active'));
    document.getElementById('addWishClose')?.addEventListener('click', () => document.getElementById('addWishModal').classList.remove('active'));
    document.getElementById('addLogClose')?.addEventListener('click', () => document.getElementById('addLogModal').classList.remove('active'));

    // Wishlist削除モーダル
    document.getElementById('wishDeleteClose')?.addEventListener('click', () => document.getElementById('wishDeleteModal').classList.remove('active'));
    document.getElementById('wishDeleteCancelBtn')?.addEventListener('click', () => document.getElementById('wishDeleteModal').classList.remove('active'));
    document.getElementById('wishDeleteExecuteBtn')?.addEventListener('click', executeWishDelete);

    // 詳細モーダルの編集・保存・削除ボタン
    document.getElementById('modalEditBtn')?.addEventListener('click', openEditMode);
    document.getElementById('modalSaveBtn')?.addEventListener('click', saveEditedItem);
    document.getElementById('modalDeleteBtn')?.addEventListener('click', openDeleteConfirm);
    document.getElementById('deleteCancelBtn')?.addEventListener('click', cancelDelete);
    document.getElementById('deleteExecuteBtn')?.addEventListener('click', executeDelete);

    // Books/Movies追加ボタン
    document.getElementById('openAddBookBtn')?.addEventListener('click', () => openAddLogModal('book'));
    document.getElementById('openAddMovieBtn')?.addEventListener('click', () => openAddLogModal('movie'));
    document.getElementById('addLogSearchBtn')?.addEventListener('click', executeAddLogSearch);

    document.getElementById('addLogResearchBtn')?.addEventListener('click', () => {
        selectedCandidate = null;
        document.getElementById('addLogStep1').style.display = 'block';
        document.getElementById('addLogStep2').style.display = 'none';
        document.getElementById('addLogCandidates').innerHTML = '';
        document.getElementById('addLogSearchStatus').style.display = 'none';
    });

    document.getElementById('submitAddLogBtn')?.addEventListener('click', async () => {
        const title = selectedCandidate ? selectedCandidate.title : document.getElementById('addLogSearchInput').value.trim();
        if (!title) return alert('タイトルを入力・選択してください');
        const data = {
            action: 'addLog',
            type: addLogType,
            title: title,
            creator: selectedCandidate ? selectedCandidate.creator : '',
            date: document.getElementById('addLogDate').value.replace(/-/g, '/'),
            rating: document.getElementById('addLogRating').value,
            review: document.getElementById('addLogReview').value,
            externalId: selectedCandidate ? selectedCandidate.externalId : ''
        };
        const btn = document.getElementById('submitAddLogBtn');
        btn.textContent = '保存中... (AIが情報を生成しています)';
        btn.disabled = true;
        await sendToGAS(data, btn, '記録に保存する');
    });

    // Wishlist追加ボタン
    document.getElementById('openAddWishBtn')?.addEventListener('click', openAddWishModal);
    document.getElementById('wishSearchBtn')?.addEventListener('click', executeWishSearch);

    // Wishlist追加：選び直し
    document.getElementById('wishResearchBtn')?.addEventListener('click', () => {
        wishSelectedCandidate = null;
        document.getElementById('addWishStep1').style.display = 'block';
        document.getElementById('addWishStep2').style.display = 'none';
        document.getElementById('wishCandidates').innerHTML = '';
        document.getElementById('wishSearchStatus').style.display = 'none';
    });

    // Wishlist追加：手動入力へ
    document.getElementById('wishSkipSearchBtn')?.addEventListener('click', showWishManualInput);

    // Wishlist追加：手動入力から検索に戻る
    document.getElementById('wishBackToSearchBtn')?.addEventListener('click', () => {
        document.getElementById('addWishStep2Manual').style.display = 'none';
        document.getElementById('addWishStep1').style.display = 'block';
    });

    // Wishlist追加：検索経由で送信
    document.getElementById('submitAddWishBtn')?.addEventListener('click', async () => {
        if (!wishSelectedCandidate) return alert('作品を選択してください');
        const data = {
            action:     'addWishlist',
            type:       document.querySelector('input[name="wishType"]:checked').value,
            title:      wishSelectedCandidate.title,
            creator:    wishSelectedCandidate.creator || '',
            memo:       document.getElementById('newMemo').value,
            link:       document.getElementById('newLink').value,
            coverUrl:   wishSelectedCandidate.coverUrl   || '',
            externalId: wishSelectedCandidate.externalId || ''
        };
        const btn = document.getElementById('submitAddWishBtn');
        btn.textContent = '保存中...'; btn.disabled = true;
        await sendToGAS(data, btn, 'Wishlistに追加する');
    });

    // Wishlist追加：手動入力で送信
    document.getElementById('submitAddWishManualBtn')?.addEventListener('click', async () => {
        const title = document.getElementById('newTitleManual').value.trim();
        if (!title) return alert('タイトルを入力してください');
        const data = {
            action: 'addWishlist',
            type: document.querySelector('input[name="wishType"]:checked').value,
            title,
            creator: document.getElementById('newCreatorManual').value,
            memo: document.getElementById('newMemoManual').value,
            link: document.getElementById('newLinkManual').value
        };
        const btn = document.getElementById('submitAddWishManualBtn');
        btn.textContent = '保存中...'; btn.disabled = true;
        await sendToGAS(data, btn, 'Wishlistに追加する');
    });

    document.getElementById('recommendRefreshBtn')?.addEventListener('click', () => loadRecommendations(true));

    document.getElementById('submitDoneBtn')?.addEventListener('click', async () => {
        const data = {
            action: 'promoteToLog',
            title: document.getElementById('wishDoneItemName').textContent,
            type: currentTargetType,
            creator: selectedCandidate ? selectedCandidate.creator : currentTargetCreator,
            date: document.getElementById('doneDate').value.replace(/-/g, '/'),
            rating: document.getElementById('ratingRange').value,
            review: document.getElementById('doneMemo').value,
            externalId: selectedCandidate ? selectedCandidate.externalId : ''
        };
        const btn = document.getElementById('submitDoneBtn');
        btn.textContent = '保存中... (AIが情報を生成しています)'; btn.disabled = true;
        await sendToGAS(data, btn, "この内容で記録に保存する");
    });
});
