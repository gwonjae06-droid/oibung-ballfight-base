/* 시작점: 베팅은 선택 사항이며 기본은 무료 플레이입니다. */
document.getElementById('wager-input').value = '0';
const economyHelp = document.querySelector('.economy-card .economy-help');
if (economyHelp) economyHelp.textContent = '베팅 없이 경기 시작을 눌러 바로 플레이할 수 있습니다. 베팅하려면 캐릭터를 고르고 금액을 입력하세요. 1vs1은 2배, 1vs1vs1은 3배를 받습니다.';
reRollMatch();
setEconomyMessage('베팅 없이 바로 시작할 수 있습니다. [경기 시작]을 눌러주세요.');
gameLoop();
