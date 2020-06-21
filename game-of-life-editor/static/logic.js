/// --------- ! to do :
/// clean up all doomed spaces and all birth spaces.
/// maybe figure out how to add memoization and rewinding.

import { utils } from "./utilities.js";
import {canvasFuncs} from "./canvas.js"

let LtLPresets = {
    'Bugs' : 'R5,C0,M1,S34..58,B34..45,NM',
    'BugsMovie' : 'R10,C0,M1,S123..212,B123..170,NM',
    'smallBugs' : 'R3,C0,M1,S14..23,B14..18,NM',
    'Globe' : 'R8,C0,M0,S163..223,B74..252,NM',
    'Majority' : 'R4,C0,M1,S41..81,B41..81,NM',
    'Waffle' : 'R7,C0,M1,S100..200,B75..170,NM',
    'Pellets' : 'R4,C0,M1,S29..55,B36..62,NM',
    'LtLDiamonds' : 'R3,C0,M1,S5..46,B23..36,NM',
    'Webs' : 'R5,C0,M1,S38..113,B61..64,NM',
    'Chambers' : 'R9,C0,M0,S43..225,B163..250,NM',
    'screamingBear' : 'R8,C0,M1,S141..184,B15..176,NM'
}

let BSPresets = {
    'Life' : 'B3/S23',
    '3/4 Life' : 'B34/S34',
    'Replicator' : 'B1357/S1357',
    'Day & Night' : 'B3678/S34678',
    'Diamoeba' : 'B35678/S5678',
    'Morley' : 'B368/S245',
    '2x2' : 'B36/S125',
    'HighLife' : 'B36/S23',
    'Coagulation' : 'B378/S235678',
    'Mazectric' : 'B3/S1234',
    'Maze' : 'B3/S12345',
    'CoralLife' : 'B3/S45678',
    'Bacteria' : 'B34/S456',
    'Insects' : 'B3567/S15678',
    'Holstein' : 'B35678/S4678',
    'H-Trees' : 'B1/S012345678',
    'Anti-Life' : 'B0123478/S01234678'
}

let rulePresets = {
    BSPresets : BSPresets,
    LtLPresets : LtLPresets
}


class Rules {
    constructor(birth, survive, spread, includeCenter) {

        let firstArg = birth;
        if (typeof firstArg === 'string') {
            ({ birth, survive, spread, includeCenter } = utils.parseRulestring(firstArg));
        }

        this.birth = birth ? birth : [3];
        this.survive = survive ? survive : [2, 3];

        this.meta = {
            spread : spread ? spread : 1,
            includeCenter : includeCenter && includeCenter > 0 ? true : false
        };

        this.presets = {
            'B/S' : BSPresets,
            'LtL' : LtLPresets
        };
        
        this.randomize = function (rSpread, rCenter) {
            rSpread = rSpread ? Math.floor(Math.random() * 11) : 1;
            rCenter = rCenter ? Math.floor(Math.random() * 2) : false;

            this.survive = utils.generateRandomRuleArray(rSpread);
            this.birth = utils.generateRandomRuleArray(rSpread);

            this.meta = {
                spread: rSpread,
                includeCenter: rCenter
            };
        }
    }
}


function buildEmptyBoardModel(width, height) {
    let squares = width * height,
        boardModel = [];
    for (squares; squares > 0; squares--) {
        boardModel.push(false);
    }
    return boardModel;
}

function getSpaces(w, h) {
    let result = [];

    for (let i = 0; i < w * h; i++) {
        result.push(i)
    }

    return result;
}





function returnNeighbourIndices(space, board, spread) {

    spread = spread === undefined ? 1 : spread;

    let yMove = board.width;

    let extreme = (yMove * spread) + spread;

    let startingSpace = space - extreme;
    let endingSpace = space + extreme;

    let result = [];

    for (startingSpace; true; startingSpace + yMove) {
        for (let xMove = 0; xMove !== (spread * 2) + 1; xMove++) {
            let current = startingSpace + xMove;

            if (board.rules.meta.includeCenter) {
                result.push(current);
            } else {
                if (current !== space) {
                    result.push(current);
                }
            }

            if (current === endingSpace) {

                return result;
            }
        }
        startingSpace += yMove;
    }
}


function killSpace(space, board) {
    board.state[space] = false;
}

function birthSpace(space, board) {
    board.state[space] = true;
}

function returnNeighboursOfLiving(board) {
    let livingSpaces = board.living,
        result = [];
    for (let space of livingSpaces) {
        let neighbours = returnNeighbourIndices(space, board, board.rules.meta.spread);
        result.push(neighbours);
    }
    return result;
}



function getLiving(board) {
    let state = board.state;
    let stateLen = state.length;
    let living = board.living;
    let population = 0;

    for (let space = 0; space < stateLen; space++) {
        if (state[space]) {
            living.push(space);
            population += 1;
        }
    }

    board.population = population;
}


function iterateOnlivingNeighbourhoods(nol, board) {
    let freqList = {};
    let result = {
        doomed: [],
        birth: []
    };

    let rules = board.rules;

    for (let neighbourHood of nol) {
        let parents = 0;
        for (let space of neighbourHood) {
            freqList[space] = freqList[space] ? freqList[space] + 1 : 1;
            parents += board.state[space];
        }
        let center = neighbourHood[0] + (board.width * rules.meta.spread) + (rules.meta.spread);

        rules = board.ruleBoxes.spaces[center] ? board.ruleBoxes.spaces[center] : board.rules;


        if (!rules.survive.includes(parents)) {
            // The center is not returned with its neighbours. Find center based on spread.
            result.doomed.push(center);
        }
    }

    // Checks if a space occurs n times as a neighbour of a living 
    // cell. If n is a birth number, queues it to be born.
    for (let space of Object.keys(freqList)) {
        space = parseInt(space);

        rules = board.ruleBoxes.spaces[space] ? board.ruleBoxes.spaces[space] : board.rules;

        let living = board.state[space];
        if (rules.birth.includes(freqList[space]) && !living) {
            result.birth.push(space);
        }
    }
    return result;
}


function iterateOnAll(board, range) {
    let rules = board.rules;
    let stateLen = board.state.length;
    let result = {
        doomed: [],
        birth: []
    };
    range = range ? range : { from: 0, to: board.state.length };

    for (let center = 0; center < stateLen; center++) {
        
        let neighbours = returnNeighbourIndices(center, board, rules.meta.spread);
        let parents = 0;
        let living = board.state[center];

        for (let space of neighbours) {
            parents += board.state[space];
        }

        if (board.ruleBoxes.spaces[center]) {
            rules = board.ruleBoxes.spaces[center];
        } else {
            rules = board.rules;
        }

        if (living) {
            if (!rules.survive.includes(parents)) {
                result.doomed.push(center);
            }
        } else {
            if (rules.birth.includes(parents)) {
                result.birth.push(center);
            }
        }
    }
    return result;
}




function returnNextSpaces(board) {

    let result;

    let zeroBirthRule = board.rules.birth.includes(0) || board.ruleBoxes.birthNums.includes(0);

    if (board.population < board.checkThreshold && !zeroBirthRule) {
        // only check around living spaces if 0 is not a valid birth number
        // and population is not very large...
        let nol = returnNeighboursOfLiving(board);
        result = iterateOnlivingNeighbourhoods(nol, board);
    } else {
        // ...otherwise check everything.
        result = iterateOnAll(board);
    }
    return result;
}




function loadNextState(board) {

    board.living = [];

    getLiving(board);

    if (board.cache.length > 1000) {
        board.cache = [];
    }

    captureState(board, true);

    let boundary = utils.determinePatternBoundary(board.living, board, false);

    // The maximal speed at which growth can happen is one space per gen (known as speed of life).
    // Add a one unit padding to the boundary of living spaces to contain the board as it grows. 
    let speedOfLife = 1;
    let coordA = boundary.length > 0 ? { x: boundary[0].x - speedOfLife, y: boundary[0].y - speedOfLife } : { x: 0, y: 1 };
    let coordB = boundary.length > 0 ? { x: boundary[1].x + speedOfLife, y: boundary[1].y + speedOfLife } : { x: 0, y: 1 };

    board.nextCheck = utils.getBoundingBox(coordA, coordB, board);

    let nextState = returnNextSpaces(board);

    for (let space of nextState.birth) {
        birthSpace(space, board);
    }

    for (let space of nextState.doomed) {
        killSpace(space, board);
    }
    board.gen = board.genCount + 1;
}

function restoreState (board, state) {
    let stateKeys = Object.keys(state.settings);

    utils.clearBoard(board);

    for (let key of stateKeys) {
        board[key] = state.settings[key];
    }

    for (let space of state.spaces) {
        birthSpace(space, board);
    }
} 

function rewindState (board) {
    if (board.cache.length > 0) {
        let prevState = board.cache.pop();
        console.log(prevState);
        restoreState(board, prevState);
    }
}

function captureState (board, storeInCache) {
    let result = [];
    let state = board.state;
    for (let space = 0; space < state.length; space++) {
        state[space] ? result.push(space) : undefined;
    }

    let settings = {
        gen : board.genCount,
        rules : board.rules,
        ruleBoxes : board.ruleBoxes
    }

    let currentState = {
        spaces : result,
        settings : settings
    }

    if (storeInCache) {
        board.cache.push(currentState);
    }
    return currentState;
}


function skipNGens(n, board) {
    for (n; n > 0; n--) {
        logic.loadNextState(board);
    }
}


function skipToGenN(n, board) {
    let howManyAway = n - board.gen;
    skipNGens(howManyAway, board);
}



let logic = {
    loadNextState: loadNextState,
    birthSpace: birthSpace,
    killSpace: killSpace,
    rni: returnNeighbourIndices,
    skipNGens: skipNGens,
    skipToGenN: skipToGenN,
    getLiving : getLiving,
    rewindState : rewindState,
    captureState : captureState,
    restoreState : restoreState,
    buildEmptyBoardModel : buildEmptyBoardModel,
    getSpaces : getSpaces,
    rulePresets : rulePresets,
    Rules : Rules
}

export { logic }