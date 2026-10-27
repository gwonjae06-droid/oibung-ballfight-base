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

function loadPhoto(key, src) {
  const img = new Image();
  img.src = src;
  CHARACTER_PHOTOS[key] = img;
}
