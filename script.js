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
let currentYear = "all"; 
// ジャンルごとの固定色設定（中間トーンの明るめくすみカラー）
const genreColors = {
    "ビジネス": "#a3c4f3",        // 爽やかなブルー
    "自然科学": "#90dbf4",        // 透明感のある水色
    "小説": "#ffcfd2",           // 優しいピンク
    "アニメ": "#cfbaf0",         // 落ち着いたラベンダー
    "ヒューマンドラマ": "#f1c0e8", // 華やかなピンクパープル
    "未分類": "#e2e2e2"          // 控えめなグレー
};

// 上記以外のジャンルが出てきた時用の予備色（同じトーンで揃えています）
const extraColors = ['#b9fbc0', '#fbf8cc', '#fde4cf', '#ffcfd2', '#f1c0e8', '#cfbaf0', '#a3c4f3', '#90dbf4', '#8eecf5', '#98f5e1'];

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbw3_O5HjDqZQ-3DbHn3WiiRmDWVRu8cwI2A4fIb2xUsLHEbRGWqHaXPolNmwcUWsYer/exec';

// --- 1. 統計・グラフ描画関数 ---
function changeYear(direction) {
    const allData = [...booksData, ...moviesData];
    // データ内にある年を重複なく取り出してソート（[2024, 2025, 2026]）
    const availableYears = [...new Set(allData.map(item => new Date(item.date).getFullYear()))].sort();
    
    if (currentYear === "all") {
        // 「すべて」から移動する場合
        currentYear = direction > 0 ? availableYears[0] : availableYears[availableYears.length - 1];
    } else {
        let index = availableYears.indexOf(currentYear);
        index += direction;
        
        if (index < 0 || index >= availableYears.length) {
            currentYear = "all"; // 範囲外は「すべて」へ
        } else {
            currentYear = availableYears[index];
        }
    }
    updateStats(); 
}

function updateStats() {
    const totalBooksEl = document.getElementById('totalBooks');
    const totalMoviesEl = document.getElementById('totalMovies');
    const avgRatingEl = document.getElementById('avgRating');
    const yearDisplayEl = document.getElementById('currentYearDisplay');

    // 表示データの絞り込み
    const allDataRaw = [...booksData, ...moviesData];
    const displayData = currentYear === "all" 
        ? allDataRaw 
        : allDataRaw.filter(item => new Date(item.date).getFullYear() === currentYear);

    // 見出しの更新
    if (yearDisplayEl) {
        yearDisplayEl.textContent = currentYear === "all" ? "全期間" : `${currentYear}年`;
    }
    
    // 数値の更新
    const filteredBooks = displayData.filter(d => d.type === 'book');
    const filteredMovies = displayData.filter(d => d.type === 'movie');

    if (totalBooksEl) totalBooksEl.textContent = filteredBooks.length;
    if (totalMoviesEl) totalMoviesEl.textContent = filteredMovies.length;
    
    const totalRating = displayData.reduce((sum, item) => sum + (parseFloat(item.rating) || 0), 0);
    const avg = displayData.length > 0 ? (totalRating / displayData.length).toFixed(1) : "0.0";
    if (avgRatingEl) avgRatingEl.textContent = avg;

    // グラフ描画に関数を渡す
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

    // ラベルに合わせて色を固定する
    const backgroundColors = labels.map((label, index) => {
        return genreColors[label] || extraColors[index % extraColors.length];
    });

    if (genreChart !== null) {
        genreChart.destroy();
    }

    genreChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: backgroundColors // 固定された色を使用
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#333',
                    bodyColor: '#333',
                    borderColor: '#ddd',
                    borderWidth: 1,
                    callbacks: {
                        // label を表示しないように変更
                        label: function(context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return ` ${value}件 (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '50%'
        }
    });

    // 凡例の描画（ここも自動的に固定された色が反映されます）
    const legendContainer = document.getElementById('customLegend');
    if (legendContainer) {
        legendContainer.innerHTML = ''; 
        labels.forEach((label, index) => {
            const color = backgroundColors[index]; // 固定色
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <span class="legend-box" style="background:${color}"></span>
                <span class="legend-text">${label}</span>
            `;
            legendContainer.appendChild(item);
        });
    }
}

let myYearlyChart = null;
let myDailyChart = null;

//棒グラフ
function renderStats() {
    const yearlyCtx = document.getElementById('yearlyChart');
    const dailyCtx = document.getElementById('dailyChart');
    if (!yearlyCtx || !dailyCtx) return;

    if (myYearlyChart) myYearlyChart.destroy();
    if (myDailyChart) myDailyChart.destroy();

    // currentYearを数値に変換（"all" の場合は NaN になる）
    const selectedYear = parseInt(currentYear);

    if (currentYear === "all" || isNaN(selectedYear)) {
        yearlyCtx.parentElement.style.display = 'none';
        dailyCtx.parentElement.style.display = 'none';
        return; 
    } else {
        yearlyCtx.parentElement.style.display = 'block';
        dailyCtx.parentElement.style.display = 'block';
    }

    const monthlyLabels = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    const monthlyBookData = new Array(12).fill(0);
    const monthlyMovieData = new Array(12).fill(0);

    const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
    const dayBookData = new Array(7).fill(0);
    const dayMovieData = new Array(7).fill(0); // ここ修正: 以前 dailyMovieData になっていました

    const allData = [...booksData, ...moviesData];
    allData.forEach(item => {
        const d = new Date(item.date);
        // 数値同士で比較
        if (d.getFullYear() === selectedYear) {
            // 月別
            const monthIdx = d.getMonth();
            if (item.type === 'book') monthlyBookData[monthIdx]++;
            else monthlyMovieData[monthIdx]++;

            // 曜日別
            const dayIdx = d.getDay();
            if (item.type === 'book') dayBookData[dayIdx]++;
            else dayMovieData[dayIdx]++;
        }
    });

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
        },
        plugins: { legend: { position: 'bottom' } }
    };

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
            ...commonOptions,
            plugins: { ...commonOptions.plugins, title: { display: true, text: `${selectedYear}年 月別記録` } }
        }
    });

    myDailyChart = new Chart(dailyCtx, {
        type: 'bar',
        data: {
            labels: dayLabels,
            datasets: [
                { label: '本 📖', data: dayBookData, backgroundColor: '#a3c4f3', borderRadius: 4 },
                { label: '映画 🎬', data: dayMovieData, backgroundColor: '#ffd1dc', borderRadius: 4 }
            ]
        },
        options: {
            ...commonOptions,
            plugins: { ...commonOptions.plugins, title: { display: true, text: `${selectedYear}年 曜日別の傾向` } }
        }
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
	renderStats();
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

//タイムライン
function renderTimeline() {
    const container = document.getElementById('timelineContainer');
    const allData = [...booksData, ...moviesData].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let lastMonth = null;
    let html = '';

    allData.forEach((item, index) => {
        const itemDate = new Date(item.date);
        const currentMonth = `${itemDate.getFullYear()}年${itemDate.getMonth() + 1}月`;
        const type = item.type; // type も取得

        // 月が変わったら「〇月」ラベルを挿入
        if (currentMonth !== lastMonth) {
            html += `<div class="timeline-month-wrapper">
                        <div class="timeline-month-label">${currentMonth}</div>
                     </div>`;
            lastMonth = currentMonth;
        }

        // 時間軸に応じた余白（マージン）の計算
        let extraMargin = 20; 
        if (index > 0) {
            const prevDate = new Date(allData[index - 1].date);
            const diffDays = (prevDate - itemDate) / (1000 * 60 * 60 * 24);
            extraMargin = Math.min(20 + (diffDays * 8), 150);
        }

        const onClick = `openModal('${type === 'book' ? 'books' : 'movies'}', '${item.title.replace(/'/g, "\\'")}')`;
        const coverPath = `img/${type === 'book' ? 'book' : 'movie'}/${item.coverUrl}`; // カバーパスもここで取得

        html += `
            <div class="timeline-card" onclick="${onClick}" style="margin-bottom: ${extraMargin}px;">
                <div class="card-content">
                    <div class="card-header">
                        <small>${formatJSTDate(item.date)}</small>
                        <img src="${coverPath}" class="card-thumbnail" onerror="this.src='img/no-image.png'" alt="${item.title}のサムネイル">
                    </div>
                    <h4>${item.title}</h4>
                    <div class="star-rating">${generateStars(item.rating)}</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// --- 4. 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    loadAppData();
    
    // タブ切り替え処理
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const targetTab = btn.dataset.tab;
            document.getElementById(`${targetTab}Tab`).classList.add('active');
            
            // タイムラインタブが開かれたら描画する
            if (targetTab === 'timeline') {
				renderTimeline();}
			else if (targetTab === 'stats') {
			// 統計タブが開かれたら、数字の更新とすべてのグラフを描画する
				updateStats(); 
				renderStats(); }
			else {
				clearFilters(targetTab);}
        };
    });
    
    // 以下、検索やモーダルなどの設定はそのまま
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

