/**
 *  読書・映画記録 (データ合体版)
 */



// --- 2. 描画ロジック (fetchを使わない) ---
function initApp() {
    // JSON読み込みの代わりに、上の appData をそのまま使う
    renderGrid('books', appData.books);
    renderGrid('movies', appData.movies);
}

function renderGrid(type, data) {
    const grid = document.getElementById(`${type}Grid`);
    if (!grid) return;

    grid.innerHTML = data.map(item => `
        <div class="book-card" onclick="openModal('${type}', '${item.title}')">
            <img src="${item.coverUrl || item.posterUrl}" class="book-cover" loading="lazy">
            <div class="book-info">
                <div class="book-title">${item.title}</div>
                <div class="book-author">${item.author || item.director}</div>
                <div class="book-date">${item.finishedDate || item.watchedDate}</div>
                <div class="book-rating">${generateStars(item.rating)}</div>
            </div>
        </div>
    `).join('');
}

// 星の生成やモーダル開閉の関数（さっきと同じ）はそのまま下に続ける...

document.addEventListener('DOMContentLoaded', initApp);

/**
 * 3. グリッド表示の生成
 */
function renderGrid(type, data) {
    const grid = document.getElementById(`${type}Grid`);
    if (!grid) return;

    grid.innerHTML = data.map(item => `
        <div class="book-card" onclick="openModal('${type}', '${item.title}')">
            <img src="${item.coverUrl || item.posterUrl}" class="book-cover" loading="lazy">
            <div class="book-info">
                <div class="book-title">${item.title}</div>
                <div class="book-author">${item.author || item.director}</div>
                <div class="book-date">${item.finishedDate || item.watchedDate}</div>
                <div class="book-rating">${generateStars(item.rating)}</div>
            </div>
        </div>
    `).join('');
}

/**
 * 4. 星評価の生成 (0.5単位対応)
 */
function generateStars(rating) {
    const r = parseFloat(rating);
    const fullStars = Math.floor(r);
    const hasHalfStar = r % 1 !== 0;
    const emptyStars = 5 - Math.ceil(r);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '<span class="star-full">★</span>';
    if (hasHalfStar) stars += '<span class="star-half">★</span>';
    for (let i = 0; i < emptyStars; i++) stars += '<span class="star-empty">★</span>';
    return stars;
}

/**
 * 5. モーダルの制御
 */
function openModal(type, title) {
    const dataList = type === 'books' ? booksData : moviesData;
    const item = dataList.find(d => d.title === title);
    if (!item) return;

    document.getElementById('modalTitle').textContent = item.title;
    document.getElementById('modalAuthor').textContent = item.author || item.director;
    document.getElementById('modalDate').textContent = item.finishedDate || item.watchedDate;
    document.getElementById('modalRating').innerHTML = generateStars(item.rating);
    document.getElementById('modalReview').innerHTML = item.review.replace(/\n/g, '<br>');
    document.getElementById('modalSynopsis').textContent = item.synopsis || "記載なし";
    
    const coverContainer = document.getElementById('modalCover');
    if (coverContainer) {
        coverContainer.innerHTML = `<img src="${item.coverUrl || item.posterUrl}">`;
    }
    
    document.getElementById('modal').classList.add('active');
}

/**
 * 6. 初期化処理
 */
document.addEventListener('DOMContentLoaded', () => {
    loadAppData();

    // モーダルを閉じる設定
    const modal = document.getElementById('modal');
    const closeBtn = document.getElementById('modalClose');
    
    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.remove('active');
    }
    
    window.onclick = (event) => {
        if (event.target == modal) modal.classList.remove('active');
    };
});