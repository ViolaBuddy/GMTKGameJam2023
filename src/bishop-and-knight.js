"use strict";

var mainBoard;
var alertOverlay;

const TIME_BETWEEN_ENEMY_ANIMATIONS = 250;

function enemyAIChooseTarget() {
	if (mainBoard.selectedTileAttackable.length > 0) {
		// if you can attack anything, do it
		return mainBoard.selectedTileAttackable[0];
	}
	// otherwise, just move randomly
	return mainBoard.selectedTileMoveable[Math.floor(Math.random()*mainBoard.selectedTileMoveable.length)];
}

async function runEnemyPhase() {
	let allEnemyTiles = mainBoard.getAllTilesWithUnitsOfThisAlignment(Alignment.Enemy);

	for (let currentTile of allEnemyTiles) {
		mainBoard.setSelectedTile(currentTile[0], currentTile[1]);
		let chosenTargetTile = enemyAIChooseTarget();
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
	mainBoard.turnCounter += 1;
	alertOverlay.show('Player Phase<br>Turn ' + mainBoard.turnCounter);

	mainBoard.updateDomToMatchState();
}

function alertOverlayClickHandler(event) {
	switch (mainBoard.gamePhase) {
	case GamePhase.PlayerPhaseBanner:
	{
		alertOverlay.hide();
		mainBoard.gamePhase = GamePhase.PlayerTurn;
		break;
	}
	case GamePhase.EnemyPhaseBanner:
	{
		alertOverlay.hide();
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

	if (mainBoard.boardTerrain[r][c] === TerrainTypes.Goal) {
		let tdDom = mainBoard.domElement.children[r].children[c].firstChild;
		tdDom.removeChild(mainBoard.boardPieces[r][c].domElement);
		mainBoard.removePieceAt(r, c);
		if(mainBoard.checkVictory())
		{
			mainBoard.updateDomToMatchState();
			return;
		}
	}

	if (mainBoard.allUnitsMovedOfThisAlignment(Alignment.Player)) {
		mainBoard.resetAlreadyMovedOfThisAlignment(Alignment.Player);
		mainBoard.gamePhase = GamePhase.EnemyPhaseBanner;
		alertOverlay.show('Enemy Phase<br>Turn ' + mainBoard.turnCounter);

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
		mainBoard.gamePhase = GamePhase.UnitAnimation;
		let selectedPiece = mainBoard.boardPieces[mainBoard.selectedTile[0]][mainBoard.selectedTile[1]];
		mainBoard.movePiece(selectedPiece, r, c, tileFinishUnitAnimationHandler);
		mainBoard.unsetSelectedTile();
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