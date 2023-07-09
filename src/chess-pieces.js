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

const TerrainTypes = createEnum(['Empty', 'Impassable', 'Goal', 'MagicalShield', 'PhysicalShield']);
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
const WeaponType = createEnum(['Magical', 'Physical']);

const CSS_CELL_SIZE = 70; //must match `td .cell` size in index.css

const CSS_CELL = 'cell';

const CSS_DARKCELL = 'darkcell';
const CSS_LIGHTCELL = 'lightcell';
const CSS_SELECTABLE = 'selectable';

const CSS_ALREADYMOVED = 'alreadymoved';

const CSS_IMPASSABLE = 'impassable';
const CSS_GOAL = 'goal';
const CSS_SHIELDED_MAGICAL = 'shieldedmagical'
const CSS_SHIELDED_PHYSICAL = 'shieldedphysical'

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

class AlertOverlay extends GameObject {
	constructor(domElement, onClickHandler = null) {
		super()
		this.domElement = domElement;
		this.onClickHandler = null;
		this.setClickHandler(onClickHandler);
	}

	setClickHandler(onClickHandler) {
		if (this.onClickHandler !== null) {
			this.domElement.removeEventListener('click', this.onClickHandler);
		}
		this.onClickHandler = onClickHandler;
		if (onClickHandler !== null) {
			this.domElement.addEventListener('click', onClickHandler);
		}
	}

	hide() {
		this.domElement.style.display = 'none';
	}

	show(message) {
		this.domElement.style.display = 'flex';
		this.domElement.innerHTML = message;
	}
}

class Piece extends GameObject {
	constructor(imgPath, alignment, movementType, attackType=null, defenseType=null) {
		super()
		this.imgPath = imgPath;
		this.alignment = alignment;
		this.movementType = movementType;
		this.attackType = attackType;
		this.defenseType = defenseType;

		this.alreadyMoved = false;
		this.domElement = document.createElement('img');
		this.domElement.setAttribute('src', this.imgPath);
	}
}

class Board extends GameObject {
	constructor(numRows, numColumns, terrain=null, domId=null, tileOnClickCallback=null, loseGameFunc=null, winGameFunc=null) {
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
		this.turnCounter = 1;

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

				if (this.boardTerrain[r][c] === TerrainTypes.Impassable){
					thisCellDiv.classList.add(CSS_IMPASSABLE);
				}
				if (this.boardTerrain[r][c] === TerrainTypes.Goal){
					thisCellDiv.classList.add(CSS_GOAL);
				} else if ( (c%2) ^ (r%2) ) {
					thisCellDiv.classList.add(CSS_DARKCELL);
				} else {
					thisCellDiv.classList.add(CSS_LIGHTCELL);
				}
			}
		}

		if (tileOnClickCallback)
		{
			this.setTilesOnClick(tileOnClickCallback);
		}
		if (loseGameFunc)
			this.loseGame = loseGameFunc;
		else
			this.loseGame = function(){
				console.log('YOU LOSE');
			};
		if (winGameFunc)
			this.winGame = winGameFunc;
		else
			this.winGame = function(){
				console.log('YOU WIN');
			};

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
		this.recalculateShieldedTerrain();
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
		this.recalculateShieldedTerrain();
	}

	/** move piece - with animation */
	movePiece(piece, row, column, callback=null) {
		console.assert(row >=0 && row < this.numRows);
		console.assert(column >=0 && column < this.numColumns);

		let youAreLosingThisTurn = false;

		let oldLocation = this.findPiece(piece);
		console.assert(oldLocation !== null);
		let capturedPiece = this.boardPieces[row][column];
		if (capturedPiece === piece)
			capturedPiece = null; // there isn't actually a captured piece, so set this back to null
		if (capturedPiece !== null) {
			this.removePieceAt(row, column);
			let tdDom = this.domElement.children[row].children[column].firstChild;
			tdDom.removeChild(capturedPiece.domElement);
			if(capturedPiece.alignment === Alignment.Player)
			{
				youAreLosingThisTurn = true;
			}
		}
		this.removePieceAt(oldLocation[0], oldLocation[1]);
		this.boardPieces[row][column] = piece;

		let distanceY = CSS_CELL_SIZE * (row - oldLocation[0]);
		let distanceX = CSS_CELL_SIZE * (column - oldLocation[1]);
		const animationStates = [
			{ transform: "translate(0px,0px)" },
			{ transform: "translate(" + distanceX + "px," + distanceY + "px)" },
		];
		const animationTiming = {
			duration: ANIMATION_TIME,
			easing: 'ease-in-out' };

		piece.domElement.style.zIndex = 1000;
		let animation = piece.domElement.animate(animationStates, animationTiming);
		animation.addEventListener('finish', (event) => {
			let tdDom = this.domElement.children[row].children[column].firstChild;
			piece.addDomToParent(tdDom);
			piece.domElement.style.zIndex = null;

			if (youAreLosingThisTurn) {
				this.loseGame();
				// and just stop here; don't do the callback
			} else if (callback !== null) {
				callback(row, column);
			}
		}, { once: true });
		this.recalculateShieldedTerrain();
	}

	recalculateShieldedTerrain() {
		for (let r = 0; r < this.numRows; r++) {
			for (let c = 0; c < this.numColumns; c++) {
				if (this.boardTerrain[r][c] === TerrainTypes.Empty ||
					this.boardTerrain[r][c] === TerrainTypes.MagicalShield ||
					this.boardTerrain[r][c] === TerrainTypes.PhysicalShield ) {

					// you cannot shield on top of a person
					// maybe you should be able to, but the UI is going to look funny
					// and I don't feel like dealing with that
					// if (this.boardPieces[r][c])
					// 	continue;
					
					this.boardTerrain[r][c] = TerrainTypes.Empty;
					let directions = [[0,0],[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
					for (let direction of directions) {
						let sourceTile = [r+direction[0], c+direction[1]];

						let withinBoard = sourceTile[0] >= 0 && sourceTile[0] < this.numRows && sourceTile[1] >= 0 && sourceTile[1] < this.numColumns;
						if (!withinBoard)
							continue;

						// this gives physical shields priority
						// but you know what, I don't even know if I'm going to have multiple shield types in the same level
						if (this.boardPieces[sourceTile[0]][sourceTile[1]] && this.boardPieces[sourceTile[0]][sourceTile[1]].defenseType === WeaponType.Physical) {
							this.boardTerrain[r][c] = TerrainTypes.PhysicalShield;
						} else if (this.boardPieces[sourceTile[0]][sourceTile[1]] && this.boardPieces[sourceTile[0]][sourceTile[1]].defenseType === WeaponType.Magical) {
							this.boardTerrain[r][c] = TerrainTypes.MagicalShield;
						}
					}
				}
			}
		}
	}

	/** clear all additional tags */
	resetDom() {
		for (let r = 0; r < this.numRows; r++) {
			for (let c = 0; c < this.numColumns; c++) {
				let tdDom = this.domElement.children[r].children[c].firstChild;

				tdDom.classList.remove(CSS_SELECTABLE);
				tdDom.classList.remove(CSS_SHIELDED_PHYSICAL);
				tdDom.classList.remove(CSS_SHIELDED_MAGICAL);
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
				if (this.boardPieces[r][c] && this.boardPieces[r][c].alreadyMoved) {
					tdDom.firstChild.classList.add(CSS_ALREADYMOVED);
				}

				if (this.boardTerrain[r][c] === TerrainTypes.MagicalShield) {
					tdDom.classList.add(CSS_SHIELDED_MAGICAL);
				} else if (this.boardTerrain[r][c] === TerrainTypes.PhysicalShield) {
					tdDom.classList.add(CSS_SHIELDED_PHYSICAL);
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
				if (this.tileIsPassable(targetTile[0], targetTile[1], thisPiece)) {
					this.selectedTileMoveable.push(targetTile);
				} else if (this.tileIsAttackable(targetTile[0], targetTile[1], thisPiece)) {
					this.selectedTileAttackable.push(targetTile);
				}
			}
			// always be able to stay in place, even if it's otherwise impassable
			this.selectedTileMoveable.push([r,c]);
			break;
		}
		case MovementTypes.Bishop:
		{
			let directions = [[1,1],[1,-1],[-1,1],[-1,-1]];
			for (let direction of directions) {
				let targetTile = [r+direction[0], c+direction[1]];
				while (this.tileIsPassable(targetTile[0], targetTile[1], thisPiece)) {
					this.selectedTileMoveable.push(targetTile);
					targetTile = [targetTile[0]+direction[0], targetTile[1]+direction[1]];
				}
				// once we run out of free squares, the next square might still be attackable
				if (this.tileIsAttackable(targetTile[0], targetTile[1], thisPiece)) {
					this.selectedTileAttackable.push(targetTile);
				}
			}
			// always be able to stay in place, even if it's otherwise impassable
			this.selectedTileMoveable.push([r,c]);
			break;
		}
		case MovementTypes.Rook:
		{
			let directions = [[0,1],[0,-1],[-1,0],[1,0]];
			for (let direction of directions) {
				let targetTile = [r+direction[0], c+direction[1]];
				while (this.tileIsPassable(targetTile[0], targetTile[1], thisPiece)) {
					this.selectedTileMoveable.push(targetTile);
					targetTile = [targetTile[0]+direction[0], targetTile[1]+direction[1]];
				}
				// once we run out of free squares, the next square might still be attackable
				if (this.tileIsAttackable(targetTile[0], targetTile[1], thisPiece)) {
					this.selectedTileAttackable.push(targetTile);
				}
			}
			// always be able to stay in place, even if it's otherwise impassable
			this.selectedTileMoveable.push([r,c]);
			break;
		}
		default:
			console.error('NOT IMPLEMENTED: MOVEMENT FOR ' + thisPiece.movementType);
		}
	}

	tileIsPassable(r, c, movingPiece) {
		let withinBoard = r >= 0 && r < this.numRows && c >= 0 && c < this.numColumns;
		if (!withinBoard)
			return false;

		let containsUnit = this.boardPieces[r][c] !== null;
		let passableTerrain =
			this.boardTerrain[r][c] === TerrainTypes.Empty ||
			(this.boardTerrain[r][c] === TerrainTypes.Goal && movingPiece.alignment === Alignment.Player) ||
			(this.boardTerrain[r][c] === TerrainTypes.MagicalShield && movingPiece.attackType !== WeaponType.Magical) ||
			(this.boardTerrain[r][c] === TerrainTypes.PhysicalShield && movingPiece.attackType !== WeaponType.Physical);
		return !containsUnit && passableTerrain;
	}

	tileIsAttackable(r, c, attackingPiece) {
		if (attackingPiece.attackType === null)
			return false;

		let withinBoard = r >= 0 && r < this.numRows && c >= 0 && c < this.numColumns;
		if (!withinBoard)
			return false;

		let defendingPiece = this.boardPieces[r][c];
		if (defendingPiece === null)
			return false;

		let sameTeam = defendingPiece.alignment === attackingPiece.alignment;
		let isDefended = defendingPiece.defenseType !== null
			&& attackingPiece.attackType === defendingPiece.defenseType;
		let passableTerrain =
			this.boardTerrain[r][c] === TerrainTypes.Empty ||
			(this.boardTerrain[r][c] === TerrainTypes.Goal && movingPiece.alignment === Alignment.Player) ||
			(this.boardTerrain[r][c] === TerrainTypes.MagicalShield && attackingPiece.attackType !== WeaponType.Magical) ||
			(this.boardTerrain[r][c] === TerrainTypes.PhysicalShield && attackingPiece.attackType !== WeaponType.Physical);
		
		return !sameTeam && !isDefended && passableTerrain;
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


	checkVictory() {
		let allPlayerUnits = this.getAllTilesWithUnitsOfThisAlignment(Alignment.Player);
		if (allPlayerUnits.length === 0) {
			this.winGame();
			return true;
		}
		return false;
	}
}