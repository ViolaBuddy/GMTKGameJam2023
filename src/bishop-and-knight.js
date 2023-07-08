"use strict";

var mainBoard;
var alertOverlayDom;

const TIME_BETWEEN_ENEMY_ANIMATIONS = 250;

// for debugging, make these accessible to the console
var tempPiece;
var tempPiece2;

function EnemyAIChooseTarget() {
	// TODO: do something significantly more intelligent than random from moveable squares
	return mainBoard.selectedTileMoveable[Math.floor(Math.random()*mainBoard.selectedTileMoveable.length)];
}

async function runEnemyPhase() {
	let allEnemyTiles = mainBoard.getAllTilesWithUnitsOfThisAlignment(Alignment.Enemy);

	for (let currentTile of allEnemyTiles) {
		mainBoard.setSelectedTile(currentTile[0], currentTile[1]);
		let chosenTargetTile = EnemyAIChooseTarget();
		mainBoard.unsetSelectedTile();

		let waitForAnimationPromise = new Promise( (resolve) => {
			mainBoard.movePiece(mainBoard.boardPieces[currentTile[0]][currentTile[1]],
			chosenTargetTile[0], chosenTargetTile[1], (r, c) => {
				mainBoard.boardPieces[r][c].alreadyMoved = true;
				resolve();
			});
		});
		await waitForAnimationPromise;
		mainBoard.updateDomToMatchState();
		let waitForPausePromise = new Promise(resolve => setTimeout(resolve, TIME_BETWEEN_ENEMY_ANIMATIONS));
		await waitForPausePromise;
	}

	mainBoard.resetAlreadyMovedOfThisAlignment(Alignment.Enemy);
	mainBoard.gamePhase = GamePhase.PlayerPhaseBanner;
	alertOverlayDom.innerText = 'Player Phase ▶';
	alertOverlayDom.style.display = 'flex';

	mainBoard.updateDomToMatchState();
}

function alertOverlayClickHandler(event) {
	switch (mainBoard.gamePhase) {
	case GamePhase.PlayerPhaseBanner:
	{
		alertOverlayDom.style.display = 'none';
		mainBoard.gamePhase = GamePhase.PlayerTurn;
		break;
	}
	case GamePhase.EnemyPhaseBanner:
	{
		alertOverlayDom.style.display = 'none';
		mainBoard.gamePhase = GamePhase.EnemyTurn;
		runEnemyPhase(); // an async function so it immediately returns
		break;
	}
	default:
		console.error('Alert Overlay should not be visible during ' + mainBoard.gamePhase);
	}

	mainBoard.updateDomToMatchState();
}

function tileFinishUnitAnimationHandler(r, c) {
	mainBoard.boardPieces[r][c].alreadyMoved = true;

	if (mainBoard.allUnitsMovedOfThisAlignment(Alignment.Player)) {
		mainBoard.resetAlreadyMovedOfThisAlignment(Alignment.Player);
		mainBoard.gamePhase = GamePhase.EnemyPhaseBanner;
		alertOverlayDom.innerText = 'Enemy Phase ▶';
		alertOverlayDom.style.display = 'flex';

		mainBoard.updateDomToMatchState();
	} else {
		mainBoard.gamePhase = GamePhase.PlayerTurn;
		mainBoard.updateDomToMatchState();
	}
}

function tileClickHandlerPlayerTurn(r, c) {
	if (mainBoard.boardPieces[r][c] && mainBoard.boardPieces[r][c].alignment === Alignment.Player && !mainBoard.boardPieces[r][c].alreadyMoved) {
		mainBoard.gamePhase = GamePhase.UnitSelected;
		mainBoard.setSelectedTile(r, c);
	} else if (mainBoard.boardPieces[r][c] && mainBoard.boardPieces[r][c].alignment === Alignment.Player) {
		// enemy tile: do nothing
	} else {
		// empty tile: do nothing
	}
}

function tileClickHandlerUnitSelected(r, c) {
	if (mainBoard.selectedTileMoveableContains(r, c)) {
		if (mainBoard.boardPieces[r][c]) {
			console.assert(mainBoard.boardPieces[r][c].alignment === Alignment.Enemy);
			// TODO: attack
			console.error('NOT IMPLEMENTED: ATTACKING');
		} else {
			mainBoard.gamePhase = GamePhase.UnitAnimation;
			let selectedPiece = mainBoard.boardPieces[mainBoard.selectedTile[0]][mainBoard.selectedTile[1]];
			mainBoard.movePiece(selectedPiece, r, c, tileFinishUnitAnimationHandler);
			mainBoard.unsetSelectedTile();
		}
	} else {
		// an empty or otherwise unselectable tile: go back
		mainBoard.gamePhase = GamePhase.PlayerTurn;
		mainBoard.unsetSelectedTile();
	}
}

function tileClickHandler(r, c) {
	switch (mainBoard.gamePhase) {
	case GamePhase.PlayerTurn:
		tileClickHandlerPlayerTurn(r, c);
		break;
	case GamePhase.UnitSelected:
		tileClickHandlerUnitSelected(r, c);
		break;
	case GamePhase.PlayerPhaseBanner:
	case GamePhase.EnemyPhaseBanner:
	case GamePhase.UnitAnimation:
	case GamePhase.EnemyTurn:
		break;
	default:
		console.error('NOT IMPLEMENTED: tileClickHandler FOR ' + mainBoard.gamePhase);
	}

	mainBoard.updateDomToMatchState();
}