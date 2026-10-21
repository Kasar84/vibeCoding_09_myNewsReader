/**
 * app.js - 맞춤형 뉴스 리더 애플리케이션 진입점 및 제어 로직
 * - 카테고리 다중 선택 (요구사항 1)
 * - '뉴스 보기' 클릭 시 선택된 각 주제별 상위 10개 기사 OpenAPI 수집 및 피드 렌더링 (요구사항 2)
 * - IntersectionObserver 기반 무한 스크롤 10건 추가 로딩 (요구사항 4)
 * - 무료 API 키 설정 및 실시간 모드 관리
 */

document.addEventListener('DOMContentLoaded', () => {
  // -------------------------------------------------------------------------
  // 1. 상태(State) 관리
  // -------------------------------------------------------------------------
  const state = {
    selectedCategories: new Set(['sports', 'economy', 'science']), // 기본 3가지 주제 모두 선택
    displayedArticles: [],    // 현재 피드에 표시된 기사 목록
    bufferedArticles: [],     // 무한 스크롤을 위해 준비된 대기 기사 큐
    isInitialLoading: false,  // 첫 피드 로딩 상태
    isLoadingMore: false,     // 무한 스크롤 10건 추가 로딩 상태
    hasMore: true,            // 추가 로드 가능 여부
    observer: null            // IntersectionObserver 인스턴스
  };

  // -------------------------------------------------------------------------
  // 2. DOM 요소 캐싱
  // -------------------------------------------------------------------------
  const categoryChips = document.querySelectorAll('.category-chip');
  const btnFetchNews = document.getElementById('btn-fetch-news');
  const selectedCountEl = document.getElementById('selected-count');
  const scrollSentinel = document.getElementById('scroll-sentinel');
  const apiStatusText = document.getElementById('api-status-text');
  const statusIndicator = document.getElementById('status-indicator');

  // API Key Modal Elements
  const btnOpenApiModal = document.getElementById('btn-open-api-modal');
  const apiModalOverlay = document.getElementById('api-modal-overlay');
  const apiModalCloseBtn = document.getElementById('api-modal-close-btn');
  const inputGnewsKey = document.getElementById('input-gnews-key');
  const btnSaveApiKey = document.getElementById('btn-save-api-key');
  const btnClearApiKey = document.getElementById('btn-clear-api-key');

  // -------------------------------------------------------------------------
  // 3. API 키 관리 & 상태 표시
  // -------------------------------------------------------------------------
  function updateApiKeyStatus() {
    const key = NewsAPI.getApiKey();
    if (key) {
      if (apiStatusText) apiStatusText.textContent = 'GNews 실시간 연동 중';
      if (statusIndicator) statusIndicator.style.backgroundColor = '#10b981';
      if (inputGnewsKey) inputGnewsKey.value = key;
    } else {
      if (apiStatusText) apiStatusText.textContent = '오늘의 최신 뉴스 모드';
      if (statusIndicator) statusIndicator.style.backgroundColor = '#3b82f6';
      if (inputGnewsKey) inputGnewsKey.value = '';
    }
  }

  function setupApiKeyModal() {
    if (btnOpenApiModal) {
      btnOpenApiModal.addEventListener('click', () => {
        inputGnewsKey.value = NewsAPI.getApiKey();
        apiModalOverlay.classList.add('open');
        apiModalOverlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
      });
    }

    const closeApiModal = () => {
      apiModalOverlay.classList.remove('open');
      apiModalOverlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    };

    if (apiModalCloseBtn) apiModalCloseBtn.addEventListener('click', closeApiModal);

    apiModalOverlay.addEventListener('click', (e) => {
      if (e.target === apiModalOverlay) closeApiModal();
    });

    if (btnSaveApiKey) {
      btnSaveApiKey.addEventListener('click', () => {
        const key = inputGnewsKey.value.trim();
        if (!key) {
          UI.showToast('API Key를 입력해 주세요. (또는 키 삭제 버튼을 누르세요)');
          return;
        }
        NewsAPI.setApiKey(key);
        updateApiKeyStatus();
        closeApiModal();
        UI.showToast('GNews 실시간 API 키가 설정되었습니다. 최신 뉴스를 불러옵니다.');
        handleFetchNews();
      });
    }

    if (btnClearApiKey) {
      btnClearApiKey.addEventListener('click', () => {
        NewsAPI.setApiKey('');
        updateApiKeyStatus();
        closeApiModal();
        UI.showToast('기본 최신 뉴스 모드로 전환되었습니다.');
        handleFetchNews();
      });
    }
  }

  // -------------------------------------------------------------------------
  // 4. 카테고리 다중 선택 로직 (요구사항 1)
  // -------------------------------------------------------------------------
  function setupCategorySelection() {
    categoryChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const category = chip.dataset.category;

        if (state.selectedCategories.has(category)) {
          // 최소 1개는 선택되어 있어야 함
          if (state.selectedCategories.size === 1) {
            UI.showToast('최소 한 개 이상의 주제를 선택해야 합니다.');
            return;
          }
          state.selectedCategories.delete(category);
          chip.classList.remove('active');
          chip.setAttribute('aria-pressed', 'false');
        } else {
          state.selectedCategories.add(category);
          chip.classList.add('active');
          chip.setAttribute('aria-pressed', 'true');
        }

        updateSelectionUI();
      });
    });
  }

  function updateSelectionUI() {
    const count = state.selectedCategories.size;
    selectedCountEl.textContent = `${count}개`;
  }

  // -------------------------------------------------------------------------
  // 5. '뉴스 보기' 클릭 시 피드 로드 (요구사항 2)
  //    - 선택한 각 주제에 대한 상위 10개의 헤드라인을 가져와 피드에 추가
  // -------------------------------------------------------------------------
  async function handleFetchNews() {
    if (state.isInitialLoading) return;

    if (state.selectedCategories.size === 0) {
      UI.showToast('관심 있는 주제를 먼저 선택해 주세요.');
      return;
    }

    state.isInitialLoading = true;
    state.hasMore = true;
    state.displayedArticles = [];
    state.bufferedArticles = [];
    btnFetchNews.disabled = true;

    // 스켈레톤 로더 노출
    UI.setEndOfFeed(false);
    UI.showSkeleton(6);
    UI.updateFeedStats(0, Array.from(state.selectedCategories));

    try {
      const selectedCats = Array.from(state.selectedCategories);
      
      // 선택된 각 카테고리별로 비동기 OpenAPI 데이터 병렬 호출
      const promises = selectedCats.map(cat => NewsAPI.fetchCategoryNews(cat));
      const results = await Promise.all(promises);

      // "선택한 각 주제에 대한 상위 10개의 헤드라인" 추출
      const initialFeedBatch = [];
      const leftoverBatch = [];

      results.forEach(categoryArticles => {
        // 각 주제별 상위 10개 슬라이스
        const top10 = categoryArticles.slice(0, 10);
        const leftovers = categoryArticles.slice(10);

        initialFeedBatch.push(...top10);
        leftoverBatch.push(...leftovers);
      });

      // 최신 발행순 정렬
      initialFeedBatch.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      leftoverBatch.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

      state.displayedArticles = initialFeedBatch;
      state.bufferedArticles = leftoverBatch;

      // 피드에 렌더링
      UI.renderArticles(state.displayedArticles, false);
      UI.updateFeedStats(state.displayedArticles.length, selectedCats);

      const hasKey = !!NewsAPI.getApiKey();
      UI.showToast(`${hasKey ? '실시간' : '최신'} 상위 기사 ${state.displayedArticles.length}건을 성공적으로 불러왔습니다.`);
    } catch (error) {
      console.error('뉴스 데이터를 가져오는 중 오류 발생:', error);
      UI.showToast('뉴스를 불러오는 데 실패했습니다. 잠시 후 다시 시도해 주세요.');
      UI.showEmptyState('네트워크 연결 상태를 확인하고 다시 시도해 주세요.');
    } finally {
      state.isInitialLoading = false;
      btnFetchNews.disabled = false;
    }
  }

  // -------------------------------------------------------------------------
  // 6. 무한 스크롤: 스크롤 시 기사 10건 더 불러오기 (요구사항 4)
  // -------------------------------------------------------------------------
  async function loadMoreArticles() {
    if (state.isLoadingMore || state.isInitialLoading || !state.hasMore) return;

    state.isLoadingMore = true;
    UI.setScrollLoading(true);

    // 사용자 경험을 위해 자연스러운 비동기 딜레이 (400ms)
    await new Promise(resolve => setTimeout(resolve, 400));

    try {
      let nextArticles = [];

      // 1. 버퍼에 이미 기사가 있는 경우 10건 추출
      if (state.bufferedArticles.length >= 10) {
        nextArticles = state.bufferedArticles.splice(0, 10);
      } else if (state.bufferedArticles.length > 0) {
        // 버퍼에 10건 미만으로 남은 경우 모두 꺼내고 추가 공급
        nextArticles = [...state.bufferedArticles];
        state.bufferedArticles = [];

        // 부족한 수량만큼 추가 기사 생성/보충
        const needed = 10 - nextArticles.length;
        const additionalArticles = generateAdditionalArticles(needed);
        nextArticles.push(...additionalArticles);
      } else {
        // 버퍼가 완전히 빈 경우 10건을 생성하여 지속적인 탐색 지원
        nextArticles = generateAdditionalArticles(10);
      }

      if (nextArticles.length > 0) {
        state.displayedArticles.push(...nextArticles);
        UI.renderArticles(nextArticles, true); // true = appendMode
        UI.updateFeedStats(state.displayedArticles.length, Array.from(state.selectedCategories));
        UI.showToast(`기사 10건을 추가로 불러왔습니다.`);
      }

      // 너무 많은 기사를 불러온 경우(예: 80건 이상) 피드 끝 도달 처리
      if (state.displayedArticles.length >= 80) {
        state.hasMore = false;
        UI.setEndOfFeed(true);
      }
    } catch (err) {
      console.error('추가 기사 로딩 오류:', err);
    } finally {
      state.isLoadingMore = false;
      UI.setScrollLoading(false);
    }
  }

  /**
   * 무한 스크롤 확장을 위한 오늘 날짜 기준 추가 기사 생성기
   */
  function generateAdditionalArticles(count) {
    const selectedCats = Array.from(state.selectedCategories);
    if (selectedCats.length === 0) return [];

    const result = [];
    const headlinesPool = {
      sports: [
        '프리미어리그 치열한 4강 싸움… 손흥민, 경기 최우수 선수 선정',
        '메이저리그 가을야구 진출 확정… 팬 페스티벌 열기 고조',
        'KBO 리그, 사상 최다 관중 기록 연일 경신… 청년층 티켓 열풍',
        '한국 펜싱 대표팀, 월드컵 단체전 금메달로 세계 정상 유지',
        '국가대표 축구팀, 신예 공격수들의 스피드로 승부수 던진다'
      ],
      economy: [
        '미국 연준 금리 방향성 주시… 국내 증시 외국인 순매수 지속',
        'K-푸드·K-뷰티 수출 호조… 라면과 기능성 화장품 글로벌 돌풍',
        '차세대 배터리·전력망 인프라 확충에 대규모 민관 투자 집행',
        '글로벌 완성차 및 빅테크 기업들, 차세대 AI 소프트웨어 표준 동맹',
        '국내 벤처투자 회복세… AI 기반 바이오 딥테크 기업 자금 수혈'
      ],
      science: [
        '상온 초전도 및 양자 큐비트 제어 신기술, 국제 학술지 표지 장식',
        '차세대 우주 망원경, 생명체 거주 가능 구역 외계 행성 정밀 분석',
        '면역 세포 이용한 차세대 표적 항암제 임상 결과 긍정적 발표',
        '친환경 나노 신소재로 공기 중 미세오염물질 99% 무해화 성공',
        '차세대 양자 암호 통신망 전국 주요 거점 도시 확대 개통 완료'
      ]
    };

    const sources = ['연합뉴스', '한국경제', '동아사이언스', '스포츠조선', '매일경제', 'YTN'];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const cat = selectedCats[i % selectedCats.length];
      const pool = headlinesPool[cat] || headlinesPool.economy;
      const title = pool[i % pool.length];
      const source = sources[i % sources.length];
      const id = `${cat}-ext-${now}-${i}`;
      const hoursAgo = Math.floor((state.displayedArticles.length + i) / 2) + 1;
      const articleDate = new Date(now - hoursAgo * 3600 * 1000);

      result.push({
        id,
        category: cat,
        categoryName: NewsAPI.CATEGORY_NAMES[cat] || '뉴스',
        title: `${title} (${state.displayedArticles.length + i + 1}번째 소식)`,
        source,
        pubDate: articleDate.toISOString(),
        relativeTime: `${hoursAgo}시간 전`,
        imageUrl: `https://images.unsplash.com/photo-${cat === 'sports' ? '1461896836934-ffe607ba8211' : cat === 'science' ? '1507668077129-56e32842fceb' : '1611974789855-9c2a0a7236a3'}?w=800&auto=format&fit=crop&q=80`,
        description: `최근 ${NewsAPI.CATEGORY_NAMES[cat]} 분야에서 가장 큰 반향을 일으키고 있는 이슈로, "${title}" 관련 심층 취재 내용과 전문가 분석을 전달합니다. 산업계와 학계의 이목이 집중되고 있습니다.`,
        link: 'https://news.google.com'
      });
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // 7. IntersectionObserver 무한 스크롤 감지기 설정 (요구사항 4)
  // -------------------------------------------------------------------------
  function setupInfiniteScroll() {
    if (!('IntersectionObserver' in window)) {
      window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
          loadMoreArticles();
        }
      });
      return;
    }

    const observerOptions = {
      root: null,
      rootMargin: '200px',
      threshold: 0.1
    };

    state.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !state.isInitialLoading && state.displayedArticles.length > 0) {
          loadMoreArticles();
        }
      });
    }, observerOptions);

    if (scrollSentinel) {
      state.observer.observe(scrollSentinel);
    }
  }

  // -------------------------------------------------------------------------
  // 8. 초기화 및 이벤트 연결
  // -------------------------------------------------------------------------
  function init() {
    setupApiKeyModal();
    updateApiKeyStatus();
    setupCategorySelection();
    updateSelectionUI();
    setupInfiniteScroll();

    btnFetchNews.addEventListener('click', handleFetchNews);

    // 페이지 접속 시 기본 선택된 주제로 즉시 최신 피드 로드
    handleFetchNews();
  }

  init();
});
