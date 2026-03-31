/**
 * 読書・映画記録 完全版（グラフ描画・連動対応）
 */
let booksData = [];
let moviesData = [];
let currentSort = { 
    books: { key: 'date', asc: false }, 
    movies: { key: 'date', asc: false } 
};
let genreChart = null; 
let myYearlyChart = null; // 棒グラフ用
let currentYear = "all"; 

const genreColors = {
    "ビジネス": "#a3c4f3",
    "自然科学": "#90dbf4",
    "小説": "#ffcfd2",
    "アニメ": "#cfbaf0",
    "ヒューマンドラマ": "#f1c0e8",
    "未分類": "#e2e2e2"
};
const extraColors = ['#b9fbc0', '#fbf8cc', '#fde4cf', '#ffcfd2', '#f1c0e8', '#cfbaf0', '#a3c4f3', '#90dbf4', '#8eecf5', '#98f5e1'];

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbw3_O5HjDqZQ-3DbHn3WiiRmDWVRu8cwI2A4fIb2xUsLHEbRGWqHaXPolNmwcUWsYer/exec';

// --- 1. 統計・グラフ描画関数 ---

function changeYear(direction) {
    const allData = [...booksData, ...moviesData];
    const availableYears = [...new Set(allData.map(item => new Date(item.date).getFullYear()))].sort();
    
    if (currentYear === "all") {
        currentYear = direction > 0 ? availableYears[0] : availableYears[availableYears.length - 1];
    } else {
        let index = availableYears.indexOf(currentYear);
        index += direction;
        
        if (index < 0 || index >= availableYears.length) {
            currentYear = "all";
        } else {
            currentYear = availableYears[index];
        }
    }
    updateStats(); 
    renderStats(); // 年変更に合わせて棒グラフも更新
}

function updateStats() {
    const totalBooksEl = document.getElementById('totalBooks');
    const totalMoviesEl = document.getElementById('totalMovies');
    const avgRatingEl = document.getElementById('avgRating');
    const yearDisplayEl = document.getElementById('currentYearDisplay');

    const allDataRaw = [...booksData, ...moviesData];
    const displayData = currentYear === "all" 
        ? allDataRaw 
        : allDataRaw.filter(item => new Date(item.date).getFullYear() === currentYear);

    if (yearDisplayEl) {
        yearDisplayEl.textContent = currentYear === "all" ? "全期間" : `${currentYear}年`;
    }
    
    const filteredBooks = displayData.filter(d => d.type === 'book');
    const filteredMovies = displayData.filter(d => d.type === 'movie');

    if (totalBooksEl) totalBooksEl.textContent = filteredBooks.length;
    if (totalMoviesEl) totalMoviesEl.textContent = filteredMovies.length;
    
    const totalRating = displayData.reduce((sum, item) => sum + (parseFloat(item.rating) || 0), 0);
    const avg = displayData.length > 0 ? (totalRating / displayData.length).toFixed(1) : "0.0";
    if (avgRatingEl) avgRatingEl.textContent = avg;

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
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: backgroundColors
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

    const legendContainer = document.getElementById('customLegend');
    if (legendContainer) {
        legendContainer.innerHTML = ''; 
        labels.forEach((label, index) => {
            const color = backgroundColors[index];
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `<span class="legend-box" style="background:${color}"></span><span class="legend-text">${label}</span>`;
            legendContainer.appendChild(item);
        });
    }
}

// 棒グラフの描画
function renderStats() {
    const yearlyCtx = document.getElementById('yearlyChart');
    if (!yearlyCtx) return;

    if (myYearlyChart) myYearlyChart.destroy();

    const selectedYear = parseInt(currentYear);

    // 「すべて」の時は棒グラフを非表示にする
    if (currentYear === "all" || isNaN(selectedYear)) {
        yearlyCtx.parentElement.style.display = 'none';
        return; 
    } else {
        yearlyCtx.parentElement.style.display = 'block';
    }

    const monthlyLabels = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    const monthlyBookData = new Array(12).fill(0);
    const monthlyMovieData = new Array(12).fill(0);

    const allData = [...booksData, ...moviesData];
    allData.forEach(item => {
        const d = new Date(item.date);
        if (d.getFullYear() === selectedYear) {
            const monthIdx = d.getMonth();
            if (item.type === 'book') monthlyBookData[monthIdx]++;
            else monthlyMovieData[monthIdx]++;
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
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            },
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: `${selectedYear}年 月別記録` }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const monthIdx = elements[0].index;
                    showMonthlyDetail(selectedYear, monthIdx);
                }
            }
        }
    });
}

function showMonthlyDetail(year, monthIdx) {
    const monthName = monthIdx + 1 + "月";
    const allData = [...booksData, ...moviesData];
    const targets = allData.filter(item => {
        const d = new Date(item.date);
        return d.getFullYear() === year && d.getMonth() === monthIdx;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    if (targets.length === 0) return;

    const listText = targets.map(item => {
        const icon = item.type === 'book' ? '📖' : '🎬';
        return `${icon} ${item.title}`;
    }).join('\n');

    alert(`--- ${year}年 ${monthName} の記録 ---\n\n${listText}`);
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
    const sBox = document.getElementById(`searchBox${typeUpper}`);
    const gFilter = document.getElementById(`genreFilter${typeUpper}`);
    if(sBox) sBox.value = '';
    if(gFilter) gFilter.value = '';
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

function renderTimeline() {
    const container = document.getElementById('timelineContainer');
    const allData = [...booksData, ...moviesData].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let lastMonth = null;
    let html = '';

    allData.forEach((item, index) => {
        const itemDate = new Date(item.date);
        const currentMonth = `${itemDate.getFullYear()}年${itemDate.getMonth() + 1}月`;
        const type = item.type;

        if (currentMonth !== lastMonth) {
            html += `<div class="timeline-month-wrapper"><div class="timeline-month-label">${currentMonth}</div></div>`;
            lastMonth = currentMonth;
        }

        let extraMargin = 20; 
        if (index > 0) {
            const prevDate = new Date(allData[index - 1].date);
            const diffDays = (prevDate - itemDate) / (1000 * 60 * 60 * 24);
            extraMargin = Math.min(20 + (diffDays * 8), 150);
        }

        const onClick = `openModal('${type === 'book' ? 'books' : 'movies'}', '${item.title.replace(/'/g, "\\'")}')`;
        const coverPath = `img/${type === 'book' ? 'book' : 'movie'}/${item.coverUrl}`;

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
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const targetTab = btn.dataset.tab;
            document.getElementById(`${targetTab}Tab`).classList.add('active');
            
            if (targetTab === 'timeline') {
                renderTimeline();
            } else if (targetTab === 'stats') {
                updateStats(); 
                renderStats(); 
            } else {
                clearFilters(targetTab);
            }
        };
    });
    
    ['Books', 'Movies'].forEach(type => {
        const el = document.getElementById(`searchBox${type}`);
        if(el) el.oninput = () => updateDisplay(type.toLowerCase());
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
