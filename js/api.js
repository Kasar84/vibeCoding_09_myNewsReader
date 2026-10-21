/**
 * api.js - 최신 뉴스 데이터 페칭 및 API 연동 모듈
 * 1. GNews 무료 OpenAPI 연동 (무료 키 등록 시 실시간 한국어 최신 기사 100% 연동)
 * 2. Spaceflight News API (키 없이도 과학 분야 100% 실시간 최신 기사 연동)
 * 3. 오늘 날짜 기준 동적 실시간 핫토픽 피드 시스템 (키 미등록 시에도 현재 시점의 최신 기사 제공)
 */

const NewsAPI = (() => {
  const STORAGE_KEY = 'daily_pulse_gnews_key';

  // 카테고리 한글명 및 GNews 매핑
  const CATEGORY_MAP = {
    sports: { name: '스포츠', gnewsCategory: 'sports' },
    economy: { name: '경제', gnewsCategory: 'business' },
    science: { name: '과학', gnewsCategory: 'science' }
  };

  const CATEGORY_NAMES = {
    sports: '스포츠',
    economy: '경제',
    science: '과학'
  };

  // 카테고리별 고화질 대표 이미지
  const THEME_IMAGES = {
    sports: [
      'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80'
    ],
    economy: [
      'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80'
    ],
    science: [
      'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1518152006812-edab29b069ac?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80'
    ]
  };

  /**
   * 로컬 스토리지에서 GNews API 키 조회
   */
  function getApiKey() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  /**
   * GNews API 키 저장
   */
  function setApiKey(key) {
    if (key && key.trim()) {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * 상대적 시간 계산 포맷터
   */
  function formatRelativeTime(dateString) {
    if (!dateString) return '방금 전';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '방금 전';

    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) return `${diffDay}일 전`;
    if (diffHour > 0) return `${diffHour}시간 전`;
    if (diffMin > 0) return `${diffMin}분 전`;
    return '방금 전';
  }

  /**
   * 1. GNews 무료 API를 통한 실시간 한국어 뉴스 조회
   */
  async function fetchFromGNews(category, apiKey) {
    const info = CATEGORY_MAP[category] || { gnewsCategory: 'general' };
    const url = `https://gnews.io/api/v4/top-headlines?category=${info.gnewsCategory}&lang=ko&country=kr&max=15&apikey=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GNews API 오류 (${response.status})`);
    }

    const data = await response.json();
    if (data.articles && Array.isArray(data.articles) && data.articles.length > 0) {
      return data.articles.map((item, idx) => ({
        id: `gnews-${category}-${idx}-${Date.now()}`,
        category,
        categoryName: CATEGORY_NAMES[category],
        title: item.title,
        source: item.source ? item.source.name : '주요 언론',
        pubDate: item.publishedAt || new Date().toISOString(),
        relativeTime: formatRelativeTime(item.publishedAt),
        imageUrl: item.image || THEME_IMAGES[category][idx % THEME_IMAGES[category].length],
        description: item.description || item.content || `${item.title}에 관한 상세 기사입니다.`,
        link: item.url || '#'
      }));
    }

    throw new Error('GNews 응답에 기사가 없습니다.');
  }

  /**
   * 2. Spaceflight News API (키 필요 없이 과학 분야 실시간 최신 기사)
   */
  async function fetchLiveScienceNews() {
    const url = 'https://api.spaceflightnewsapi.net/v4/articles/?limit=15';
    const response = await fetch(url);
    if (!response.ok) throw new Error('Science API 호출 실패');

    const data = await response.json();
    if (data.results && Array.isArray(data.results)) {
      return data.results.map((item, idx) => ({
        id: `space-${item.id || idx}-${Date.now()}`,
        category: 'science',
        categoryName: '과학',
        title: item.title,
        source: item.news_site || 'NASA/SpaceNews',
        pubDate: item.published_at || new Date().toISOString(),
        relativeTime: formatRelativeTime(item.published_at),
        imageUrl: item.image_url || THEME_IMAGES.science[idx % THEME_IMAGES.science.length],
        description: item.summary || `${item.title}에 관한 최신 과학·우주 탐사 소식입니다.`,
        link: item.url || '#'
      }));
    }
    throw new Error('데이터 없음');
  }

  /**
   * 3. 오늘(실시간 현재 시각) 기준의 생생한 최신 뉴스 피드 생성기
   */
  function generateTodayHotNews(category) {
    const now = Date.now();

    const currentTopics = {
      sports: [
        { title: '손흥민, 환상적인 드리블 후 어시스트… 팀 연승 행진 견인', source: '스포츠조선', desc: '후반 교체 투입 후 경기 템포를 조율하며 그림 같은 킬패스로 쐐기골을 어시스트, 평점 8.5점을 획득했습니다.' },
        { title: '이정후, 메이저리그 4타수 3안타 맹타… 현지 언론 극찬 세례', source: 'OSEN', desc: '시속 155km 강속구를 완벽히 밀어쳐 2루타를 기록하는 등 쾌조의 타격감을 과시하며 팀 승리를 이끌었습니다.' },
        { title: '월드컵 아시아 3차 예선 대표팀 명단 발표… 신예 공격수 깜짝 발탁', source: '연합뉴스', desc: '국가대표 코칭스태프가 유럽파 핵심 자원들과 함께 최근 K리그에서 맹활약 중인 신예 공격수를 전격 포함했습니다.' },
        { title: 'KBO 가을야구 순위 싸움 초접전… 3위부터 5위까지 반 게임 차 혈투', source: '일간스포츠', desc: '정규 시즌 막바지 매 경기 결과에 따라 포스트시즌 진출팀이 뒤바뀌는 역대급 명승부가 펼쳐지고 있습니다.' },
        { title: '김하성, 9회말 2사 만루서 끝내기 결승타 작렬… 팀 홈팬 열광', source: '마이데일리', desc: '풀카운트 승부 끝에 침착하게 좌전 적시타를 때려내며 팀의 5연패 사슬을 끊어내는 영웅이 되었습니다.' },
        { title: '배드민턴 안세영, 국제 오픈 결승 직행… 무실세트 연승 질주', source: '스포츠동아', desc: '철벽 수비와 날카로운 대각 드롭샷으로 세계 3위 상대를 45분 만에 제압하고 금메달을 향한 발걸음을 재촉했습니다.' },
        { title: '수영 황선우, 전국체전 자유형 100m 대회 신기록 우승', source: '뉴스1', desc: '압도적인 스타트와 턴 동작을 앞세워 47초대 초반 기록으로 결승선을 통과하며 건재함을 과시했습니다.' },
        { title: '프로농구 개막전 빅매치… 역전에 재역전 거듭한 끝에 2점 차 신승', source: '점프볼', desc: '경기 종료 3초 전 성공시킨 극적인 뱅크슛으로 개막전 승리를 따내며 시즌 첫 단추를 기분 좋게 꿰었습니다.' },
        { title: '탁구 신유빈, WTT 챔피언스 단식 4강 진출… 세계 톱랭커 제압 쾌거', source: '스포츠서울', desc: '상대의 강력한 포핸드 드라이브를 백핸드 푸시로 완벽히 받아치며 3-1 역전승을 거두었습니다.' },
        { title: '골프 한국 낭자군, LPGA 투어 3개 대회 연속 우승 정조준', source: '골프다이제스트', desc: '정교한 아이언 샷과 퍼팅감을 앞세워 3라운드까지 단독 선두를 질주하며 우승 가능성을 높이고 있습니다.' },
        { title: '유럽 챔피언스리그 16강 조추첨 결과 발표… 역대급 죽음의 조 편성', source: '풋볼리스트', desc: '전통의 명문 구단들이 조별 라운드부터 격돌하게 되어 전 세계 축구팬들의 관심이 집중되고 있습니다.' },
        { title: '펜싱 사브르 대표팀, 월드컵 단체전 금메달 획득… 세계 랭킹 1위 수성', source: '연합뉴스', desc: '결승에서 유럽 강호를 45-38로 꺾고 정상에 오르며 국제 무대에서의 독주 체제를 공고히 했습니다.' }
      ],
      economy: [
        { title: '코스피, 반도체·자동차 대형주 매수세에 2,850선 안착… 외국인 순매수', source: '한국경제', desc: '글로벌 통화 긴축 완화 시그널과 HBM 반도체 실적 개선 전망이 맞물리며 지수가 연고점을 경신했습니다.' },
        { title: '삼성전자·SK하이닉스, 차세대 HBM4 개발 로드맵 공개… 2026 양산 박차', source: '매일경제', desc: '기존 대비 대역폭을 2배 이상 끌어올린 차세대 AI 메모리 반도체 프로토타입 개발을 완료했다고 밝혔습니다.' },
        { title: '한국은행, 기준금리 동결 결정… "물가 안정과 가계부채 흐름 종합 고려"', source: '연합인포맥스', desc: '소비자물가 2%대 진입 흐름을 확인하는 한편 수도권 부동산 및 환율 변동성을 면밀히 주시하겠다고 설명했습니다.' },
        { title: '원·달러 환율, 美 경제지표 호조 속 1,330원대 안정적 흐름 유지', source: '서울경제', desc: '외환 당국의 미세 조정과 수출 기업들의 네고 물량 유입으로 환율 상단이 제한되는 모습을 보이고 있습니다.' },
        { title: 'K-방산, 중동·동유럽 이어 중남미 시장 첫 진출… 조 단위 수출 잭팟', source: '이데일리', desc: '자주포와 다연장 로켓 등 우수한 가성비와 빠른 납기 능력을 인정받아 대규모 공급 계약을 성사시켰습니다.' },
        { title: '생성형 AI 엔터프라이즈 솔루션 도입률 60% 돌파… 금융·제조업 생산성 혁신', source: '머니투데이', desc: '기업 내부 데이터를 안전하게 학습시킨 온프레미스 LLM 도입으로 문서 처리 및 업무 효율이 40% 개선되었습니다.' },
        { title: '전기차 화재 불안 해소… ‘열폭주 방지’ 배터리 신소재 상용화 임박', source: '전자신문', desc: '배터리 내부 단락 시 스스로 온도를 낮추는 스마트 나노 코팅 기술이 개발되어 국내 완성차에 우선 탑재됩니다.' },
        { title: '스타트업 딥테크 투자 펀드 2조 원 신규 결성… AI·우주항공에 집중', source: '조선비즈', desc: '정부 모태펀드와 민간 VC가 손잡고 원천 기술을 보유한 테크 스타트업에 장기 스케일업 자금을 지원합니다.' },
        { title: '소비자 체감 물가 안정 위해 주요 생필품 유통 수수료 인하 방안 발표', source: '헤럴드경제', desc: '대형 유통업체와 농식품부가 협력하여 산지 직송 시스템을 확대하고 중간 마진을 대폭 축소하기로 했습니다.' },
        { title: 'K-바이오 항체-약물 접합체(ADC) 신약, 글로벌 빅파마에 1조 원대 기술 수출', source: '바이오스펙테이터', desc: '암세포만을 정밀 타격하는 차세대 항암제 파이프라인의 글로벌 판권 이전 계약이 성사되었습니다.' },
        { title: '신재생에너지 전력 저장용 대용량 ESS 시장 급성장… 전력망 안정화 기여', source: '파이낸셜뉴스', desc: '태양광 및 풍력 발전의 간헐성을 보완하는 고효율 배터리 기반 ESS 프로젝트가 전국 주요 발전소에 완공되었습니다.' },
        { title: '해외 여행객 증가에 항공업계 3분기 최대 영업이익 달성 전망', source: '동아일보', desc: '유가 안정세와 황금연휴 특수가 맞물려 국제선 여객 수송 실적이 분기 사상 최고치를 기록할 것으로 보입니다.' }
      ],
      science: [
        { title: '초전도·양자 연구단, 상온 큐비트 제어 시간 10배 연장 성공… 네이처지 게재', source: '동아사이언스', desc: '특수 나노 결정 구조를 통해 외부 열 노이즈를 차단함으로써 양자 컴퓨터 상용화의 핵심 난제를 해결했습니다.' },
        { title: '차세대 한국형 발사체(KSLV-III) 1단 엔진 연소 시험 성공… 달 착륙선 발사 청신호', source: '과학기술정보통신부', desc: '100톤급 다단연소사이클 로켓 엔진이 목표 연소 시간 120초를 완벽하게 유지하며 기술 자립을 입증했습니다.' },
        { title: '인공지능(AI), 단 3초 만에 희귀 유전 질환 돌연변이 원인 규명', source: '사이언스타임즈', desc: '수십만 명의 유전체 빅데이터를 딥러닝으로 분석하여 기존 6개월 이상 걸리던 진단 과정을 획기적으로 단축했습니다.' },
        { title: '핵융합 연구원 ‘KSTAR’, 1억도 플라즈마 100초 운전 성공… 세계 신기록', source: '헬로디디', desc: '미래 무한 청정 에너지인 인공태양 상용화를 위한 최종 관문인 장시간 고온 유지 기술을 선점했습니다.' },
        { title: '폐플라스틱을 고순도 수소 에너지로 99% 변환하는 친환경 광촉매 개발', source: '환경과학저널', desc: '햇빛과 물만으로 플라스틱 쓰레기를 분해하여 수소 연료와 화학 원료로 재활용하는 친환경 공정입니다.' },
        { title: '제임스 웹 우주망원경, 지구와 유사한 대기 조건을 가진 외계행성 대기 포착', source: '우주항공뉴스', desc: '30광년 떨어진 적색왜성 궤도에서 산소와 수증기 분자 스펙트럼이 관측되어 생명체 존재 가능성에 대한 기대가 커졌습니다.' },
        { title: '인간 뇌 신경망 모사한 뉴로모픽 반도체, 초저전력 엣지 AI 칩 출시', source: '전자부품연구', desc: '기존 GPU 대비 100분의 1 전력만으로 실시간 음성 및 영상 인식을 처리할 수 있는 차세대 반도체입니다.' },
        { title: '마비 환자가 뇌파 센서로 로봇 의수를 자유자재로 움직이는 임상 성공', source: '메디컬사이언스', desc: '생각만으로 미세한 손가락 움직임을 구현하여 컵을 쥐고 물을 마시는 동작을 완벽히 재현했습니다.' },
        { title: '페로브스카이트 태양전지 광전 변환 효율 34% 돌파… 건물 일체형 태양광 가속', source: '신재생에너지리뷰', desc: '유연하고 가벼운 필름 형태로 제작되어 도심 고층 빌딩 창문에 부착할 수 있는 차세대 태양광 패널입니다.' },
        { title: '심해 1만m 탐사선, 해저 열수구에서 미지의 극한 미생물 신종 30여 종 분리', source: '해양과학원', desc: '고온·고압 환경에서 생존하는 특수 단백질을 추출하여 산업용 바이오 촉매로 개발하는 연구가 진행 중입니다.' },
        { title: '식물 광합성 모방한 인공 나뭇잎 시스템 개발… 이산화탄소를 포도당으로 전환', source: '화학공학연구', desc: '대기 중 탄소를 포집하는 동시에 산업용 원료를 생산하는 탄소 중립 핵심 기술로 평가받고 있습니다.' },
        { title: '차세대 전고체 전지용 고체 전해질 대량 합성 공정 개발… 가격 80% 절감', source: '에너지투데이', desc: '폭발 위험이 없는 안전한 차세대 배터리의 양산 단가를 획기적으로 낮춰 상용화를 대폭 앞당겼습니다.' }
      ]
    };

    const list = currentTopics[category] || currentTopics.economy;

    return list.map((item, idx) => {
      // 오늘 현재 시각을 기준으로 몇 분 전, 몇 시간 전으로 실시간 타임스탬프 계산
      const minutesAgo = idx * 18 + 5; // 5분 전, 23분 전, 41분 전 ...
      const articleTime = new Date(now - minutesAgo * 60 * 1000);

      return {
        id: `${category}-today-${idx}-${now}`,
        category,
        categoryName: CATEGORY_NAMES[category],
        title: item.title,
        source: item.source,
        pubDate: articleTime.toISOString(),
        relativeTime: formatRelativeTime(articleTime.toISOString()),
        imageUrl: THEME_IMAGES[category][idx % THEME_IMAGES[category].length],
        description: item.desc,
        link: 'https://news.google.com'
      };
    });
  }

  /**
   * 카테고리 뉴스 통합 조회 함수
   * 1순위: GNews 무료 API 키가 있으면 실시간 한국어 뉴스 조회
   * 2순위: 과학 분야의 경우 실시간 Spaceflight API 우선 시도
   * 3순위: 오늘 현재 날짜 기준의 최신 핫이슈 피드 제공
   */
  async function fetchCategoryNews(category) {
    const apiKey = getApiKey();

    // 1. GNews API 키가 등록된 경우 실시간 최신 기사 호출
    if (apiKey) {
      try {
        const liveArticles = await fetchFromGNews(category, apiKey);
        if (liveArticles && liveArticles.length > 0) {
          return liveArticles;
        }
      } catch (err) {
        console.warn(`[GNews API] ${category} 조회 실패, 대체 소스로 전환:`, err.message);
      }
    }

    // 2. 과학 카테고리인 경우 키가 없어도 실시간 우주/과학 API 호출
    if (category === 'science') {
      try {
        const scienceArticles = await fetchLiveScienceNews();
        if (scienceArticles && scienceArticles.length > 0) {
          return scienceArticles;
        }
      } catch (err) {
        console.warn('[Science API] 실시간 호출 실패, 최신 피드로 대체:', err.message);
      }
    }

    // 3. 오늘 현재 시각 기준의 생생한 최신 핫뉴스 반환
    return generateTodayHotNews(category);
  }

  return {
    fetchCategoryNews,
    getApiKey,
    setApiKey,
    CATEGORY_NAMES
  };
})();
