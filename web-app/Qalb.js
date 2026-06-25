/**
 * @file Qalb game module.
 *
 * This module eis a functional API for the game of Qalb (Reversi)
 * on the standard 8×8 board. The API is organised into three groups:
 *
 * - Constructors- create a starting {@link GameState}.
 * - Queries- inspect the board without changing it.
 * - Transitions- return a new board advanced by some move.
 * @module Qalb
 */

import R from "./ramda.js";


// Type Definitions

/**
 * One of the two players. Black moves first by Qalb convention.
 * @typedef {("B" | "W")} Player
 */

/**
 * The contents of a single board square. `null` means empty.
 * @typedef {(Player | null)} Cell
 */

/**
 * A position on the 8×8 board. Both indices are 0-based;
 * row 0 is the top row, column 0 is the leftmost column.
 * @typedef {object} Position
 * @property {number} row Integer in the range 0-7.
 * @property {number} col Integer in the range 0-7.
 */

/**
 * The 8×8 board, indexed as `board[row][col]`.
 * @typedef {Cell[][]} Board
 */

/**
 * The complete state of an in-progress or finished game.
 *
 * `lastWasPass` records whether the previous turn was a forced
 * pass; the game ends when both players must pass in succession.
 *
 * @typedef {object} GameState
 * @property {Board} board
 * @property {Player} currentPlayer The player to move next (B or W)
 * @property {boolean} lastWasPass Was the last move a Pass?
 */


// Constants

const SIZE = 8;

/**
 * The eight unit vectors used when searching for captures.
 * Each pair is `[dRow, dCol]`.
 */
const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
];

const opponent = function (player) {
    return (
        player === "B"
        ? "W"
        : "B"
    );
};

const inBounds = function ({row, col}) {
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
};

const cellAt = R.curry(function (board, position) {
    return board[position.row][position.col];
});

// Contrsuctors

/**
 * Create the standard starting position: an empty 8×8 board with
 * the four central discs placed (white at d4 and e5, black at d5
 * and e4) and black to move.
 *
 * @returns {GameState}
 *
 * @example
 * const state = Qalb.newGame();
 * Qalb.currentPlayer(state); // => "B"
 * Qalb.score(state);         // => { B: 2, W: 2 }
 */
const newGame = function () {
    const empty = R.times(() => R.repeat(null, SIZE), SIZE);
    const board = R.pipe(
        R.assocPath([3, 3], "W"),
        R.assocPath([3, 4], "B"),
        R.assocPath([4, 3], "B"),
        R.assocPath([4, 4], "W")
    )(empty);
    return Object.freeze({
        board,
        currentPlayer: "B",
        lastWasPass: false
    });
};


// Queries

/**
 * @param {GameState} state
 * @returns {Player} The player who's turn it is.
 *
 * @example
 * Qalb.currentPlayer(Qalb.newGame()); // => "B"
 */
const currentPlayer = (state) => state.currentPlayer;

/**
 * The contents of the square at `position`.
 *
 * @param {GameState} state
 * @param {Position} position
 * @returns {Cell}
 */
const getCell = (state, position) => cellAt(state.board, position);

/**
 * Count the discs of each colour on the board.
 *
 * @param {GameState} state
 * @returns {{B: number, W: number}}
 *
 * @example
 * Qalb.score(Qalb.newGame()); // => { B: 2, W: 2 }
 */
const score = function (state) {
    const flat = R.flatten(state.board);
    return {
        B: R.filter(R.equals("B"), flat).length,
        W: R.filter(R.equals("W"), flat).length
    };
};

/**
 * Walk one direction from `start` for the given player, returning
 * the positions that would be captured along that ray.
 *
 * A capture happens when one or more adjacent opposing discs are
 * followed by a disc of the player's own colour. If the ray hits
 * an empty square or the edge of the board first, nothing is
 * captured.
 *
 * Implemented recursively: each step either extends the run of
 * captured opponent discs or terminates the walk.
 *
 * @private
 * @param {Board} board
 * @param {Player} player
 * @param {Position} start
 * @param {number[]} direction `[dRow, dCol]`
 * @returns {Position[]}
 */
const walkRay = function (board, player, start, [dRow, dCol]) {
    const step = function (pos, captured) {
        const next = {row: pos.row + dRow, col: pos.col + dCol};

        if (!inBounds(next)) {
            return [];
        }

        const here = cellAt(board, next);

        if (here === null) {
            return [];
        }

        if (here === player) {
            return captured;
        }

        return step(next, [...captured, next]);
    };

    return step(start, []);
};

/**
 * The squares that would be flipped if the current player placed
 * a disc at `position`. Empty when the move is illegal.
 *
 * @param {GameState} state
 * @param {Position} position
 * @returns {Position[]}
 */
const flipsForMove = function (state, position) {
    if (!inBounds(position)) {
        return [];
    }

    if (cellAt(state.board, position) !== null) {
        return [];
    }

    return R.chain(
        function (dir) {
            return walkRay(state.board, state.currentPlayer, position, dir);
        },
        DIRECTIONS
    );
};

/**
 * The set of squares where the current player may legally place
 * a disc. A move is legal only if it captures at least one
 * opposing disc by sandwiching disc(s) between the new
 * disc and an existing disc of the current player's colour.
 *
 * @param {GameState} state
 * @returns {Position[]} May be empty, in which case the player
 *          must pass.
 */
const validMoves = function (state) {
    const positions = R.xprod(
        R.range(0, SIZE),
        R.range(0, SIZE)
    ).map(function (pair) {
        return {
            row: pair[0],
            col: pair[1]
        };
    });

    return R.filter(function (pos) {
        return flipsForMove(state, pos).length > 0;
    }, positions);
};

/**
 * @param {GameState} state
 * @param {Position} position
 * @returns {boolean} True iff `position` is in `validMoves(state)`.
 */
const isValidMove = function (state, position) {
    return flipsForMove(state, position).length > 0;
};

/**
 * The game is over when neither player has any legal move. This
 * happens when the board is full or when both players are forced
 * to pass in succession.
 *
 * @param {GameState} state
 * @returns {boolean}
 */
const isGameOver = function (state) {
    let swapped;

    if (validMoves(state).length > 0) {
        return false;
    }

    swapped = Object.assign({}, state, {
        currentPlayer: opponent(state.currentPlayer)
    });

    return validMoves(swapped).length === 0;
};


/**
 * The winner of a finished game.
 *
 * @param {GameState} state Must satisfy `isGameOver(state)`.
 * @returns {(Player | null)} The player with the most discs, or
 *          `null` for a draw.
 * @throws {Error} If the game is not yet over.
 */
const winner = function (state) {
    if (!isGameOver(state)) {
        throw new Error("Game is not over.");
    }

    const {B, W} = score(state);

    if (B > W) {
        return "B";
    }

    if (W > B) {
        return "W";
    }

    return null;
};

// Transitons

/**
 * Apply a move, returning the resulting state. The new state has
 * the disc placed, all sandwiched discs flipped, and the turn
 * advanced (or kept, when the opponent has no legal reply).
 *
 * @param {GameState} state
 * @param {Position} position Must satisfy `isValidMove(state, position)`.
 * @returns {GameState}
 * @throws {Error} If `position` is not a legal move.
 *
 * @example
 * const start = Qalb.newGame();
 * const next = Qalb.makeMove(start, { row: 2, col: 3 });
 * Qalb.currentPlayer(next); // => "W"
 */
const makeMove = function (state, position) {
    const flips = flipsForMove(state, position);

    if (flips.length === 0) {
        throw new Error(
            `Illegal move at (${position.row}, ${position.col}).`
        );
    }

    const player = state.currentPlayer;
    const placements = [position, ...flips];

    const newBoard = R.reduce(
        (board, cell) => R.assocPath(
            [cell.row, cell.col],
            player,
            board
        ),
        state.board,
        placements
    );

    const tentative = {
        board: newBoard,
        currentPlayer: opponent(player),
        lastWasPass: false
    };

    // If the opponent has no legal reply, the turn comes back to
    // the same player without a pass being recorded.
    if (validMoves(tentative).length === 0) {
        return Object.freeze(Object.assign({}, tentative, {
            currentPlayer: player
        }));
    }

    return Object.freeze(tentative);
};

/**
 * Pass the current player's turn. Only legal when the current
 * player has no valid moves.
 *
 * @param {GameState} state Must satisfy `validMoves(state).length === 0`.
 * @returns {GameState}
 * @throws {Error} If the current player has any legal move.
 */
const pass = function (state) {
    if (validMoves(state).length > 0) {
        throw new Error("Cannot pass: current player has legal moves.");
    }

    return Object.freeze(
        Object.assign({}, state, {
            currentPlayer: opponent(state.currentPlayer),
            lastWasPass: true
        })
    );
};


// Module Export

const Qalb = Object.freeze({
    newGame,
    currentPlayer,
    getCell,
    score,
    validMoves,
    isValidMove,
    flipsForMove,
    isGameOver,
    winner,
    makeMove,
    pass
});

export default Object.freeze(Qalb);
