"use strict";

// for debugging, make these accessible to the console
var mainBoard;
var tempPiece;
var tempPiece2;

function tileHandler(r, c) {
	switch (mainBoard.gamePhase)
	{
	case GamePhase.PlayerTurnStart:
		if (mainBoard.boardPieces[r][c] && mainBoard.boardPieces[r][c].alignment == Alignment.Player)
		{
			console.log([r, c]);
		}
		break;
	default:
		console.error('NOT IMPLEMENTED');
	}
}

function setupGame() {
	const BOARDSIZE_ROWS = 8;
	const BOARDSIZE_COLUMNS = 32;


	mainBoard = new Board(BOARDSIZE_ROWS, BOARDSIZE_COLUMNS, 'maintable', tileHandler);
	mainBoard.addDomToParent('main');

	tempPiece = new Piece('img/PLACEHOLDER_JS.gif', Alignment.Player);
	mainBoard.addPiece(tempPiece, 0, 6);
	tempPiece2 = new Piece('img/PLACEHOLDER_QD.gif', Alignment.Player);
	mainBoard.addPiece(tempPiece2, 0, 9);

	mainBoard.makeAllPiecesOfACertainAlignmentSelectable(Alignment.Player);
}

setupGame();