/* 캐릭터 사진 자리. 이 저장소에는 사진이 들어 있지 않아서, 사진이 없으면 캐릭터 색 원 + 이름 첫 글자로 그려집니다.
   사진을 쓰려면 assets/ 폴더(.gitignore로 커밋 제외)에 파일을 넣고 아래처럼 등록하세요.

     loadPhoto('bae', 'assets/bae.jpg');
     loadPhoto('oh-boin', 'assets/oh-boin.jpg');
     loadPhoto('oh-menhera', 'assets/oh-menhera.jpg');
     loadPhoto('lee', 'assets/lee.jpg');
     loadPhoto('park', 'assets/park.jpg');
     loadPhoto('choi', 'assets/choi.jpg');
*/
const CHARACTER_PHOTOS = {};
// Five default champions have opt-in portrait slots; no friend's likeness is
// synthesized. Photos can be registered only after receiving permission.
const CHAMPION_PORTRAITS=Object.freeze({bae:'배서준',lee:'이권재',park:'박성원',choi:'최규원',oh:'오슬우'});
function championPortrait(id){return CHARACTER_PHOTOS[id]||null;}
if(typeof window!=='undefined')window.CHAMPION_PORTRAITS=CHAMPION_PORTRAITS;

function loadPhoto(key, src) {
  const img = new Image();
  img.src = src;
  CHARACTER_PHOTOS[key] = img;
}

const CHAMPION_IDENTITY=Object.freeze({
 bae:{title:'흡혈 러시',intro:'반동을 이용해 접근하고 결정적인 순간에 체력을 회수합니다.'},
 lee:{title:'변칙 룰렛',intro:'전투 도중 전술을 바꾸며 기회를 만들어냅니다.'},
 park:{title:'공중 강하',intro:'점프와 착지로 대결의 높낮이를 바꿉니다.'},
 choi:{title:'한 방의 승부',intro:'충돌과 타이밍을 끝까지 노립니다.'},
 oh:{title:'심리전',intro:'예측하기 어려운 타이밍으로 상대를 흔듭니다.'}
});
if(typeof window!=='undefined')window.CHAMPION_IDENTITY=CHAMPION_IDENTITY;
