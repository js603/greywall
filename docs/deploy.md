# 배포 (Deploy)

게임은 서버 코드가 없는 정적 웹 페이지라서, 파일을 올릴 수 있는 곳이면 어디든 게시할 수 있다.

| 산출물 | 만드는 법 | 쓰는 곳 |
|---|---|---|
| 정적 사이트 폴더 `dist/` | `npm run build` | 폴더나 ZIP을 올리는 호스팅(GitHub Pages, Netlify, Vercel, Cloudflare Pages, itch.io HTML5 등). HTTPS 주소면 PWA 설치와 오프라인 실행까지 동작한다. |
| 한 파일 `dist-single/greywall.html` (약 17 MB) | `npm run build:single` | HTML 파일 하나만 받는 곳. 그림·글꼴·데이터가 모두 파일 안에 들어 있어 더블클릭으로도 열린다. PWA 설치는 안 된다. |

- 경로는 전부 상대 경로(`base: './'`)라서 하위 폴더에 올려도 된다.
- 진행은 브라우저 `localStorage`에 저장된다. 저장소를 막는 환경(샌드박스 iframe, 사생활 보호 창)에서는 메모리에만
  저장되어 탭을 닫으면 사라진다(`src/storage.js`). 이때는 설정 → 저장 파일 내보내기를 쓴다(다운로드를 막는 환경 제외).
- 확인 창은 브라우저 기본 `confirm()` 대신 게임 안의 창을 쓴다. 샌드박스 iframe에서는 기본 창이 열리지 않기 때문이다.
