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

const TerrainTypes = createEnum(['Empty', 'Hole', 'Wall']);
const TileUITypes = createEnum(['NotClickable', 'ClickablePiece', 'SelectedPiece', 'MoveableTile', 'AttackableTile']);
const Alignment = createEnum(['Player', 'Enemy']);
const GamePhase = createEnum(['PlayerTurnStart', 'UnitSelected', 'UnitAnimation', 'EndUnitTurn', 'EnemyTurn']);

const CSS_CELL = 'cell'
const CSS_DARKCELL = 'darkcell';
const CSS_LIGHTCELL = 'lightcell';
const CSS_SELECTABLE = 'selectable';

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
	constructor(imgPath, alignment) {
		super()
		this.imgPath = imgPath;
		this.alignment = alignment;
		this.domElement = document.createElement('img');
		this.domElement.setAttribute('src', this.imgPath);
	}
}

class Board extends GameObject {
	constructor(numRows=8, numColumns=8, domId=null, tileOnClickCallback=null) {
		super()
		this.numRows = numRows;
		this.numColumns = numColumns;
		this.boardTerrain = null;
		this.boardPieces = null;
		this.boardTileUI = null;
		this.boardClickCallbacks = null;
		this.domElement = null;
		this.gamePhase = GamePhase.PlayerTurnStart;

		this.boardTerrain = new Array(numRows);
		for (let r = 0; r < this.numRows; r++) {
			this.boardTerrain[r] = new Array(numColumns);
			for (let c = 0; c < this.numColumns; c++) {
				this.boardTerrain[r][c] = TerrainTypes.Empty;
			}
		}

		this.boardPieces = new Array(numRows);
		for (let r = 0; r < this.numRows; r++) {
			this.boardPieces[r] = new Array(numColumns);
			for (let c = 0; c < this.numColumns; c++) {
				this.boardPieces[r][c] = null;
			}
		}

		this.boardTileUI = new Array(numRows);
		for (let r = 0; r < this.numRows; r++) {
			this.boardTileUI[r] = new Array(numColumns);
			for (let c = 0; c < this.numColumns; c++) {
				this.boardTileUI[r][c] = TileUITypes.NotClickable;
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

				if ( (c%2) ^ (r%2) ) {
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

	addPiece(piece, row=0, column=0) {
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

	setTilesOnClick(callback) {
		for (let r = 0; r < this.numRows; r++) {
			for (let c = 0; c < this.numColumns; c++) {
				let tdDom = this.domElement.children[r].children[c].firstChild;
				this.boardClickCallbacks[r][c] = function (event) {
					callback(r, c);
				};

				tdDom.addEventListener('click', this.boardClickCallbacks[r][c]);
			}
		}
	}


	/** a few functions, which affect UI appearance only, not functionality*/
	/** TODO: make this just a single update function that loops through all squares and updates the UI to match the internal gamestate */
	makeAllPiecesNotClickable() {
		for (let r = 0; r < this.numRows; r++) {
			for (let c = 0; c < this.numColumns; c++) {
				this.boardTileUI[r][c] = TileUITypes.NotClickable;
				let tdDom = this.domElement.children[r].children[c].firstChild;
				tdDom.classList.remove(CSS_SELECTABLE);
			}
		}
	}

	makeAllPiecesOfACertainAlignmentSelectable(alignment) {
		this.makeAllPiecesNotClickable();

		for (let r = 0; r < this.numRows; r++) {
			for (let c = 0; c < this.numColumns; c++) {
				if (this.boardPieces[r][c] && this.boardPieces[r][c].alignment == alignment)
				{
					this.makeTileAtSelectable(r, c);
				}
			}
		}
	}

	makeTileAtSelectable(row, column) {
		this.boardTileUI[row][column] = TileUITypes.ClickablePiece;
		let tdDom = this.domElement.children[row].children[column].firstChild;
		tdDom.classList.add(CSS_SELECTABLE);
	}
}