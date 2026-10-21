/**
 * ui.js - UI 컴포넌트 렌더링, 모달 상호작용 및 시각 효과 관리
 */

const UI = (() => {
  // DOM Elements Cache
  const newsGrid = document.getElementById('news-grid');
  const articleCounter = document.getElementById('article-counter');
  const activeTagsContainer = document.getElementById('active-tags');
  const modalOverlay = document.getElementById('article-modal-overlay');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalBtnDismiss = document.getElementById('modal-btn-dismiss');
  const modalCategoryBadge = document.getElementById('modal-category-badge');
  const modalSource = document.getElementById('modal-source');
  const modalDate = document.getElementById('modal-date');
  const modalTitle = document.getElementById('modal-title');
  const modalImage = document.getElementById('modal-image');
  const modalContentText = document.getElementById('modal-content-text');
  const modalOriginalLink = document.getElementById('modal-original-link');
  const toastContainer = document.getElementById('toast-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  const endOfFeed = document.getElementById('end-of-feed');

  // Fallback placeholder image when loading fails
  const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&auto=format&fit=crop&q=80';

  /**
   * 뉴스 카드 HTML 템플릿 생성 (요구사항 3 & 5)
   */
  function createCardElement(article) {
    const card = document.createElement('article');
    card.className = 'news-card';
    card.setAttribute('role', 'article');
    card.dataset.id = article.id;

    // 카테고리별 클래스
    const categoryClass = article.category || 'economy';

    card.innerHTML = `
      <div class="card-image-box">
        <span class="card-category-badge ${categoryClass}">${article.categoryName}</span>
        <img 
          src="${article.imageUrl || DEFAULT_IMAGE}" 
          alt="${escapeHtml(article.title)}" 
          class="card-img" 
          loading="lazy"
        >
      </div>
      <div class="card-content">
        <div class="card-meta">
          <span class="card-source">${escapeHtml(article.source)}</span>
          <span class="card-time">${article.relativeTime}</span>
        </div>
        <h3 class="card-title" title="${escapeHtml(article.title)}">${escapeHtml(article.title)}</h3>
        <p class="card-description">${escapeHtml(article.description)}</p>
        <div class="card-footer">
          <button type="button" class="btn-read" aria-label="${escapeHtml(article.title)} 상세 기사 읽기">
            <span>읽기</span>
            <span class="read-arrow">→</span>
          </button>
        </div>
      </div>
    `;

    // 이미지 로드 실패 시 대체 이미지로 안전하게 전환
    const imgEl = card.querySelector('.card-img');
    imgEl.addEventListener('error', function () {
      this.src = DEFAULT_IMAGE;
    });

    // '읽기' 버튼 클릭 시 모달 열기 (요구사항 3)
    const readBtn = card.querySelector('.btn-read');
    readBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(article);
    });

    // 카드 자체를 클릭해도 편안하게 모달을 열 수 있도록 UX 강화
    card.addEventListener('click', () => {
      openModal(article);
    });

    return card;
  }

  /**
   * HTML 특수문자 이스케이프 (XSS 방지)
   */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 기사 카드 목록 렌더링
   * @param {Array} articles - 렌더링할 기사 목록
   * @param {boolean} append - 기존 카드에 덧붙일지 여부 (무한 스크롤 시 true)
   */
  function renderArticles(articles, append = false) {
    if (!append) {
      newsGrid.innerHTML = '';
    }

    if (!articles || articles.length === 0) {
      if (!append) {
        showEmptyState('선택하신 주제의 뉴스가 없습니다. 다른 주제를 선택해보세요.');
      }
      return;
    }

    const fragment = document.createDocumentFragment();
    articles.forEach(article => {
      const cardEl = createCardElement(article);
      fragment.appendChild(cardEl);
    });

    newsGrid.appendChild(fragment);
  }

  /**
   * 기사 본문 상세 모달 열기 (요구사항 3)
   */
  function openModal(article) {
    if (!article) return;

    modalCategoryBadge.textContent = article.categoryName;
    modalCategoryBadge.className = `modal-category-badge ${article.category || 'economy'}`;
    modalSource.textContent = article.source || '주요 언론';
    modalDate.textContent = article.relativeTime ? `발행: ${article.relativeTime}` : '';
    modalTitle.textContent = article.title;
    modalImage.src = article.imageUrl || DEFAULT_IMAGE;
    modalImage.onerror = () => { modalImage.src = DEFAULT_IMAGE; };

    // 본문 내용 채우기
    modalContentText.textContent = article.description || '상세 본문 내용이 제공되지 않는 기사입니다. 원문 기사 보러가기 링크를 통해 전체 기사를 확인하실 수 있습니다.';

    // 원문 링크
    if (article.link && article.link !== '#') {
      modalOriginalLink.href = article.link;
      modalOriginalLink.style.display = 'inline-flex';
    } else {
      modalOriginalLink.style.display = 'none';
    }

    // 모달 활성화 및 바디 스크롤 방지
    modalOverlay.classList.add('open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    // 접근성 초점 관리
    modalCloseBtn.focus();
  }

  /**
   * 모달 닫기
   */
  function closeModal() {
    modalOverlay.classList.remove('open');
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  /**
   * 초기 로딩 스켈레톤 카드 표시
   */
  function showSkeleton(count = 6) {
    newsGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton-card';
      skeleton.innerHTML = `
        <div class="skeleton-image"></div>
        <div class="skeleton-body">
          <div class="skeleton-line title"></div>
          <div class="skeleton-line title-sub"></div>
          <div class="skeleton-line desc"></div>
          <div class="skeleton-line desc-short"></div>
        </div>
      `;
      fragment.appendChild(skeleton);
    }

    newsGrid.appendChild(fragment);
  }

  /**
   * 빈 피드 상태 표시
   */
  function showEmptyState(message = '표시할 뉴스가 없습니다.') {
    newsGrid.innerHTML = `
      <div class="empty-feed">
        <span class="empty-icon">📂</span>
        <h3>뉴스를 찾을 수 없습니다</h3>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  /**
   * 기사 수 및 태그 바 업데이트
   */
  function updateFeedStats(totalCount, selectedCategories) {
    if (articleCounter) {
      articleCounter.textContent = `총 ${totalCount}개의 기사 표시 중`;
    }

    if (activeTagsContainer) {
      activeTagsContainer.innerHTML = '';
      selectedCategories.forEach(cat => {
        const tag = document.createElement('span');
        tag.className = `active-tag ${cat}`;
        tag.textContent = `#${NewsAPI.CATEGORY_NAMES[cat] || cat}`;
        activeTagsContainer.appendChild(tag);
      });
    }
  }

  /**
   * 하단 무한 스크롤 로딩 인디케이터 제어 (요구사항 4)
   */
  function setScrollLoading(isLoading) {
    if (loadingIndicator) {
      loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    }
  }

  /**
   * 모든 기사를 다 불러왔을 때 피드 종료 알림 표시
   */
  function setEndOfFeed(isEnd) {
    if (endOfFeed) {
      endOfFeed.style.display = isEnd ? 'block' : 'none';
    }
  }

  /**
   * 토스트 알림 표시
   */
  function showToast(message, duration = 3000) {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>🔔</span><span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 300);
    }, duration);
  }

  // 모달 이벤트 바인딩
  modalCloseBtn.addEventListener('click', closeModal);
  modalBtnDismiss.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('open')) {
      closeModal();
    }
  });

  return {
    renderArticles,
    openModal,
    closeModal,
    showSkeleton,
    showEmptyState,
    updateFeedStats,
    setScrollLoading,
    setEndOfFeed,
    showToast
  };
})();
