# 회색성벽 연대기 (Greywall Chronicle)

고정 쿼터뷰에서 느린 평타로 사냥하는 중세 판타지 RPG. Phaser 3 + Vite, 설치 가능한 PWA.

```bash
npm install
npm run dev        # 개발 서버
npm run build      # dist/ + 서비스워커(tools/gen_sw.mjs)
npm test           # 헤드리스 시뮬레이션 테스트 (Node, 브라우저 불필요)
npm run sim        # 지역별 밸런스 리포트
```

URL 옵션: `?dev=1` 개발 모드(별도 저장 칸, `__gw.give/xp/warp`), `?bot=1` 자동 플레이 봇.

## Credits

- 그래픽: agent-sprite-forge `codeart2d`로 코드 드로잉 (이미지 모델 미사용)
- 효과: [pixelfx](https://github.com/patch-gg/pixelfx) (MIT, Patch / Hugo Duprez / rehan-remade), `fx_pixelfx.py`로 렌더
- 글꼴: 갈무리11 (SIL OFL 1.1)
- 음악·효과음: WebAudio 실시간 합성

원본 소스는 소실되어 배포 빌드에서 복원했습니다. [docs/restoration.md](docs/restoration.md) 참고.

문서: [분석·개선·확장 계획](docs/analysis.md) · [에이전트 툴체인](docs/agent-kit.md) · [밸런스 리포트](design/balance/sim-report.md)
