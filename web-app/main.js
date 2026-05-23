/**
 * @file Web app controller.
 *
 * `main.js` is the bridge between the Dcoument Object Module (DOM)
 * and the Qalb module.
 * It holds the current game state, listens for input events, and
 * re-renders. It contains no game logic itself. Every decision
 * about legality, captures, turns and end-conditions comes from
 * the {@link module:Qalb} module.
 */

import Qalb from "./Qalb.js";


// State

let state = Qalb.newGame();

const boardEl = document.getElementById("board");
const turnEl = document.getElementById("turn-indicator");
const scoreEl = document.getElementById("score");
const passBtn = document.getElementById("pass-button");
const resetBtn = document.getElementById("reset-button");
const themeSelect = document.getElementById("theme-select");


// Initial DOM construction

const buildBoard = function () {
    boardEl.innerHTML = "";
    Array.from({length: 64}).forEach(function (ignore, index) {
        const row = Math.floor(index / 8);
        const col = index % 8;
        const cell = document.createElement("button");
        cell.className = "cell";
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        cell.setAttribute("role", "gridcell");
        cell.setAttribute(
            "aria-label",
            `Row ${row + 1}, column ${col + 1}, empty`
        );
        boardEl.appendChild(cell);
    });
};


//Rendering

const playerName = (player) => (
    player === "B"
    ? "Black"
    : "White"
);

const render = function () {
    const moves = Qalb.validMoves(state);
    const legalSet = new Set(moves.map((m) => `${m.row},${m.col}`));

    Array.from(boardEl.children).forEach(function (cellEl) {
        const row = Number(cellEl.dataset.row);
        const col = Number(cellEl.dataset.col);
        const here = Qalb.getCell(state, {row, col});

        cellEl.classList.remove("legal");
        cellEl.innerHTML = "";

        if (here === "B") {
            const disc = document.createElement("span");
            disc.className = "disc black";
            cellEl.appendChild(disc);
            cellEl.setAttribute(
                "aria-label",
                `Row ${row + 1}, column ${col + 1}, black disc`
            );
            cellEl.disabled = true;
        } else if (here === "W") {
            const whiteDisc = document.createElement("span");
            whiteDisc.className = "disc white";
            cellEl.appendChild(whiteDisc);
            cellEl.setAttribute(
                "aria-label",
                `Row ${row + 1}, column ${col + 1}, white disc`
            );
            cellEl.disabled = true;
        } else {
            const isLegal = legalSet.has(`${row},${col}`);
            if (isLegal) {
                cellEl.classList.add("legal");
                cellEl.setAttribute(
                    "aria-label",
                    `Row ${row + 1}, column ${col + 1}, `
                    + `legal move for ${playerName(Qalb.currentPlayer(state))}`
                );
                cellEl.disabled = false;
            } else {
                cellEl.setAttribute(
                    "aria-label",
                    `Row ${row + 1}, column ${col + 1}, empty`
                );
                cellEl.disabled = true;
            }
        }
    });

    const {B, W} = Qalb.score(state);
    scoreEl.textContent = `Black: ${B}  ·  White: ${W}`;

    if (Qalb.isGameOver(state)) {
        const w = Qalb.winner(state);
        turnEl.textContent = (
            w === null
            ? "Game over: it's a draw."
            : `Game over: ${playerName(w)} wins.`
        );
        passBtn.disabled = true;
    } else if (moves.length === 0) {
        turnEl.textContent = (
            `${playerName(Qalb.currentPlayer(state))} has no legal moves`
            + ` - must pass.`
        );
        passBtn.disabled = false;
    } else {
        turnEl.textContent = `${playerName(Qalb.currentPlayer(state))} to move`;
        passBtn.disabled = true;
    }
};


// Event Handlers

let isAnimating = false;

const handleCellClick = function (event) {
    if (isAnimating) {
        return;
    }
    const cell = event.target.closest(".cell");
    if (!cell || cell.disabled) {
        return;
    }
    const position = {
        row: Number(cell.dataset.row),
        col: Number(cell.dataset.col)
    };
    if (!Qalb.isValidMove(state, position)) {
        return;
    }

    const flips = Qalb.flipsForMove(state, position);
    isAnimating = true;

    // Phase 1: collapse the discs that are about to flip
    flips.forEach(function ({row, col}) {
        const cellEl = boardEl.querySelector(
            `[data-row="${row}"][data-col="${col}"]`
        );
        const disc = cellEl && cellEl.querySelector(".disc");
        if (disc) {
            disc.classList.add("flip-out");
        }
    });

    setTimeout(function () {
        // Phase 2: update state, re-render with new colours, then expand
        state = Qalb.makeMove(state, position);
        render();

        flips.forEach(function ({row, col}) {
            const cellEl = boardEl.querySelector(
                `[data-row="${row}"][data-col="${col}"]`
            );
            const disc = cellEl && cellEl.querySelector(".disc");
            if (disc) {
                disc.classList.add("flip-in");
            }
        });


        setTimeout(function () {
            isAnimating = false;
        }, 150);
    }, 150);
};

const handlePass = function () {
    if (Qalb.validMoves(state).length > 0) {
        return;
    }
    state = Qalb.pass(state);
    render();
};

const handleReset = function () {
    state = Qalb.newGame();
    render();
};

const handleThemeChange = function (event) {
    document.body.className = event.target.value;
};


// Wiring

buildBoard();
boardEl.addEventListener("click", handleCellClick);
passBtn.addEventListener("click", handlePass);
resetBtn.addEventListener("click", handleReset);
themeSelect.addEventListener("change", handleThemeChange);
document.body.className = themeSelect.value;
render();
