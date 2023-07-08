"use strict";

function createEnum(values) {
	const enumObject = {};
	for (let i=0; i<values.length; i++) {
		enumObject[i] = values[i];
		enumObject[values[i]] = values[i];
	}
	enumObject.length = values.length;
	return Object.freeze(enumObject);
}

const TerrainTypes = createEnum(['Empty', 'Impassable']);
const TileUITypes = createEnum(['NotClickable', 'ClickablePiece', 'MoveableTile', 'AttackableTile']);
const Alignment = createEnum(['Player', 'Enemy']);
const GamePhase = createEnum([
	'PlayerPhaseBanner',
	'PlayerTurn',
	'UnitSelected',
	'UnitAnimation',
	'EnemyPhaseBanner',
	'EnemyTurn',
	'EnemyUnitAnimation',
	]);
const MovementTypes = createEnum(['Knight', 'Bishop', 'Rook', 'Queen', 'King']);

const CSS_CELL = 'cell'
const CSS_DARKCELL = 'darkcell';
const CSS_LIGHTCELL = 'lightcell';
const CSS_SELECTABLE = 'selectable';
const CSS_ALREADYMOVED = 'alreadymoved';
const CSS_IMPASSABLE = 'impassable'

const ANIMATION_TIME = 400; // in milliseconds

/** Interface. Something that has internal state and also must display it in the DOM.
JavaScript doesn't enforce interfaces, of course, but this is for organizational purposes. */
class GameObject {
	constructor() {
		this.domElement = null;
	}

	addDomToParent(parentId) {
		if (typeof parentId == 'string')
		{
			var parentElement = document.getElementById(parentId);
		}
		else
		{
			var parentElement = parentId;
		}
		parentElement.appendChild(this.domElement);
	}
}

class Piece extends GameObject {
	constructor(imgPath, alignment, movementType) {
		super()
		this.imgPath = imgPath;
		this.alignment = alignment;
		this.movementType = movementType;
		this.alreadyMoved = false;
		this.domElement = document.createElement('img');
		this.domElement.setAttribute('src', this.imgPath);
	}
}

class Board extends GameObject {
	constructor(numRows, numColumns, terrain=null, domId=null, tileOnClickCallback=null) {
		super()
		console.assert(terrain === null || (terrain.length == numRows && terrain[0].length == numColumns));

		this.numRows = numRows;
		this.numColumns = numColumns;
		this.boardTerrain = null;
		this.boardPieces = null;
		this.boardClickCallbacks = null;
		this.domElement = null;
		this.selectedTile = null;
		this.selectedTileMoveable = [];
		this.selectedTileAttackable = [];
		this.gamePhase = GamePhase.PlayerPhaseBanner;

		if (terrain === null) {
			// empty board
			this.boardTerrain = new Array(numRows);
			for (let r = 0; r < this.numRows; r++) {
				this.boardTerrain[r] = new Array(numColumns);
				for (let c = 0; c < this.numColumns; c++) {
					this.boardTerrain[r][c] = TerrainTypes.Empty;
				}
			}
		} else {
			this.boardTerrain = terrain;
		}

		this.boardPieces = new Array(numRows);
		for (let r = 0; r < this.numRows; r++) {
			this.boardPieces[r] = new Array(numColumns);
			for (let c = 0; c < this.numColumns; c++) {
				this.boardPieces[r][c] = null;
			}
		}

		this.boardClickCallbacks = new Array(numRows);
		for (let r = 0; r < this.numRows; r++) {
			this.boardClickCallbacks[r] = new Array(numColumns);
			for (let c = 0; c < this.numColumns; c++) {
				this.boardClickCallbacks[r][c] = null;
			}
		}

		this.domElement = document.createElement('table');
		if (domId) {
			this.domElement.id = domId;
		}
		for (let r = 0; r < this.numRows; r++) {
			let thisRow = document.createElement('tr');
			this.domElement.appendChild(thisRow);
			for (let c = 0; c < this.numColumns; c++) {
				let thisCell = document.createElement('td');
				thisRow.appendChild(thisCell);
				let thisCellDiv = document.createElement('div');
				thisCellDiv.classList.add(CSS_CELL);
				thisCell.appendChild(thisCellDiv);

				if (this.boardTerrain[r][c] === TerrainTypes.Impassable)
				{
					thisCellDiv.classList.add(CSS_IMPASSABLE);
				} else if ( (c%2) ^ (r%2) ) {
					thisCellDiv.classList.add(CSS_DARKCELL);
				}
				else {
					thisCellDiv.classList.add(CSS_LIGHTCELL);
				}
			}
		}

		if (tileOnClickCallback)
		{
			this.setTilesOnClick(tileOnClickCallback);
		}
	}

	findPiece(piece) {
		for (let r = 0; r < this.numRows; r++) {
			for (let c = 0; c < this.numColumns; c++) {
				if(this.boardPieces[r][c] == piece)
					return [r,c];
			}
		}
		return null;
	}

	removePieceAt(row, column) {
		this.boardPieces[row][column] = null;
	}

	/** teleports instantly, no animation */
	addPiece(piece, row, column) {
		console.assert(row >=0 && row < this.numRows);
		console.assert(column >=0 && column < this.numColumns);

		let oldLocation = this.findPiece(piece);
		if (oldLocation !== null)
		{
			this.removePieceAt(oldLocation[0], oldLocation[1]);
		}

		this.boardPieces[row][column] = piece;

		let tdDom = this.domElement.children[row].children[column].firstChild;
		piece.addDomToParent(tdDom);
	}

	/** move piece - with animation */
	movePiece(piece, row, column, callback=null) {
		console.assert(row >=0 && row < this.numRows);
		console.assert(column >=0 && column < this.numColumns);

		let oldLocation = this.findPiece(piece);
		console.assert(oldLocation !== null);

		this.removePieceAt(oldLocation[0], oldLocation[1]);
		this.boardPieces[row][column] = piece;

		// TODO: make this animation actually right
		const animationStates = [
			{ transform: "rotate(0)" },
			{ transform: "rotate(360deg)" },
		];
		const animationTiming = { duration: ANIMATION_TIME };
		let animation = piece.domElement.animate(animationStates, animationTiming);

		animation.addEventListener('finish', (event) => {
			let tdDom = this.domElement.children[row].children[column].firstChild;
			piece.addDomToParent(tdDom);
			if (callback !== null)
				callback(row, column);
		}, { once: true });
	}

	setTilesOnClick(callback) {
		for (let r = 0; r < this.numRows; r++) {
			for (let c = 0; c < this.numColumns; c++) {
				let tdDom = this.domElement.children[r].children[c].firstChild;
				this.boardClickCallbacks[r][c] = (event) => {
					callback(r, c);
				};

				tdDom.addEventListener('click', this.boardClickCallbacks[r][c]);
			}
		}
	}

	/** clear all additional tags */
	resetDom() {
		for (let r = 0; r < this.numRows; r++) {
			for (let c = 0; c < this.numColumns; c++) {
				let tdDom = this.domElement.children[r].children[c].firstChild;

				tdDom.classList.remove(CSS_SELECTABLE);
				if (tdDom.firstChild)
					tdDom.firstChild.classList.remove(CSS_ALREADYMOVED);
			}
		}
	}

	/** the safest thing to do is to reset and update everything every time this is called */
	updateDomToMatchState() {
		this.resetDom();

		for (let r = 0; r < this.numRows; r++) {
			for (let c = 0; c < this.numColumns; c++) {
				let tdDom = this.domElement.children[r].children[c].firstChild;
				if (this.boardPieces[r][c]
					// && this.boardPieces[r][c].alignment == Alignment.Player
					&& this.boardPieces[r][c].alreadyMoved) {
					tdDom.firstChild.classList.add(CSS_ALREADYMOVED);
				}

				switch (mainBoard.gamePhase) {
				case GamePhase.PlayerTurn:
					if (this.boardPieces[r][c]
						&& this.boardPieces[r][c].alignment == Alignment.Player
						&& !this.boardPieces[r][c].alreadyMoved) {
						tdDom.classList.add(CSS_SELECTABLE);
					} else 
					break;
				case GamePhase.UnitSelected:
					if (this.selectedTileMoveableContains(r,c)) {
						tdDom.classList.add(CSS_SELECTABLE);
					}
					break;
				case GamePhase.PlayerPhaseBanner:
				case GamePhase.EnemyPhaseBanner:
				case GamePhase.EnemyTurn:
				case GamePhase.UnitAnimation:
					break;
				default:
					console.error('NOT IMPLEMENTED: DOM UPDATE FOR ' + mainBoard.gamePhase);
				}
			}
		}
	}

	setSelectedTile(r, c) {
		this.selectedTile = [r, c];
		let thisPiece = this.boardPieces[r][c];
		console.assert(thisPiece);

		switch(thisPiece.movementType)
		{
		case MovementTypes.Knight:
		{
			let directions = [[1,2],[1,-2],[-1,2],[-1,-2],[2,1],[2,-1],[-2,1],[-2,-1]];
			for (let direction of directions) {
				let targetTile = [r+direction[0], c+direction[1]];
				if (this.tileIsPassable(targetTile[0], targetTile[1]))
				{
					this.selectedTileMoveable.push(targetTile);
					// TODO: attackable
				}
			}
			break;
		}
		case MovementTypes.Bishop:
		{
			let directions = [[1,1],[1,-1],[-1,1],[-1,-1]];
			for (let direction of directions) {
				let targetTile = [r+direction[0], c+direction[1]];
				while (this.tileIsPassable(targetTile[0], targetTile[1]))
				{
					this.selectedTileMoveable.push(targetTile);
					targetTile = [targetTile[0]+direction[0], targetTile[1]+direction[1]];
					// TODO: attackable
				}
			}
			break;
		}
		case MovementTypes.Rook:
		{
			let directions = [[0,1],[0,-1],[-1,0],[1,0]];
			for (let direction of directions) {
				let targetTile = [r+direction[0], c+direction[1]];
				while (this.tileIsPassable(targetTile[0], targetTile[1]))
				{
					this.selectedTileMoveable.push(targetTile);
					targetTile = [targetTile[0]+direction[0], targetTile[1]+direction[1]];
					// TODO: attackable
				}
			}
			break;
		}
		default:
			console.error('NOT IMPLEMENTED: MOVEMENT FOR ' + thisPiece.movementType);
		}
	}

	tileIsPassable(r, c) {
		let withinBoard = r >= 0 && r < this.numRows && c >= 0 && c < this.numColumns;
		if (!withinBoard)
			return false;

		let containsUnit = this.boardPieces[r][c] !== null;
		let passableTerrain = this.boardTerrain[r][c] === TerrainTypes.Empty;
		return !containsUnit && passableTerrain;
	}

	unsetSelectedTile() {
		this.selectedTile = null;
		this.selectedTileMoveable = [];
		this.selectedTileAttackable = [];
	}

	selectedTileMoveableContains(r,c) {
		for (let i = 0; i < this.selectedTileMoveable.length; i++)
		{
			let tile = this.selectedTileMoveable[i];
			if (tile[0] === r && tile[1] === c)
			{
				return true;
			}
		}
		return false;
	}

	allUnitsMovedOfThisAlignment(alignment) {
		for (let r = 0; r < this.numRows; r++) {
			for (let c = 0; c < this.numColumns; c++) {
				if (this.boardPieces[r][c] === null)
					continue;
				if (this.boardPieces[r][c].alignment === alignment && !this.boardPieces[r][c].alreadyMoved)
					return false;
			}
		}
		return true;
	}

	resetAlreadyMovedOfThisAlignment(alignment) {
		for (let r = 0; r < this.numRows; r++) {
			for (let c = 0; c < this.numColumns; c++) {
				if (this.boardPieces[r][c] === null || this.boardPieces[r][c].alignment !== alignment)
					continue;
				this.boardPieces[r][c].alreadyMoved = false;
			}
		}
		return true;
	}

	getAllTilesWithUnitsOfThisAlignment(alignment) {
		let toReturn = [];
		for (let r = 0; r < this.numRows; r++) {
			for (let c = 0; c < this.numColumns; c++) {
				if (this.boardPieces[r][c] === null)
					continue;
				if (this.boardPieces[r][c].alignment === alignment)
					toReturn.push([r, c]);
			}
		}
		return toReturn;
	}
}