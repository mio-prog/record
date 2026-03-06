/**
 *  読書・映画記録 (JSON読み込み版)
 */

let booksData = [];
let moviesData = [];

// 1. データを読み込む関数
async function loadAppData() {
    try {
        // 同じ場所にある data.json を読みに行く
        const response = await fetch('data.json');
        
        if (!response.ok) throw new Error('JSONが読み込めませんでした');
        
        const data = await response.json();
        
        booksData = data.books || [];
        moviesData = data.movies || [];

        // 読み込み終わったら画面を作る
        renderGrid('books', booksData);
        renderGrid('movies', moviesData);

    } catch (error) {
        console.error("Error:", error);
        // エラーが出たら画面に表示（デバッグ用）
        document.body.insertAdjacentHTML('afterbegin', `<p style="color:red">エラー: ${error.message}</p>`);
    }
}

// 2. グリッドを表示する関数
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

// 3. 星評価を作る関数
function generateStars(rating) {
    const r = parseFloat(rating);
    const fullStars = Math.floor(r);
    const hasHalfStar = r % 1 !== 0;
    const emptyStars = 5 - Math.ceil(r);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '★';
    if (hasHalfStar) stars += '☆'; // ここはCSSで半分に見せる工夫もできますが、まずはシンプルに
    for (let i = 0; i < emptyStars; i++) stars += '☆';
    return stars;
}

// 4. モーダルを開く関数
function openModal(type, title) {
    const dataList = type === 'books' ? booksData : moviesData;
    const item = dataList.find(d => d.title === title);
    if (!item) return;

    document.getElementById('modalTitle').textContent = item.title;
    document.getElementById('modalAuthor').textContent = item.author || item.director;
    document.getElementById('modalDate').textContent = item.finishedDate || item.watchedDate;
    document.getElementById('modalRating').textContent = generateStars(item.rating);
    document.getElementById('modalReview').innerHTML = item.review.replace(/\n/g, '<br>');
    document.getElementById('modalSynopsis').textContent = item.synopsis || "記載なし";
    
    const coverContainer = document.getElementById('modalCover');
    if (coverContainer) {
        coverContainer.innerHTML = `<img src="${item.coverUrl || item.posterUrl}">`;
    }
    
    document.getElementById('modal').classList.add('active');
}

// 5. 起動時の処理
document.addEventListener('DOMContentLoaded', () => {
    loadAppData();

    // モーダルを閉じる処理
    const modal = document.getElementById('modal');
    const closeBtn = document.getElementById('modalClose');
    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.remove('active');
    }
    window.onclick = (event) => {
        if (event.target == modal) modal.classList.remove('active');
    };
});