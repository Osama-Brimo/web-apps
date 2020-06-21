import { logic } from './logic.js'
import { canvasFuncs } from './canvas.js'
// import { patterns } from './patterns.js'


var canvas = document.getElementById('drawCanvas');


function clearBoard(board) {
    let emptyState = []
    for (let space = 0; space < board.width * board.height; space++) {
        logic.killSpace(space, board);
        emptyState.push(false);
    }
    board.state = emptyState;
}




function getEventCoords(event, board, normalize, noOffset) {
    // Experimental. Finds the position of a mouse event relative to canvas origin (top left by default).

    // normalize allows the returned result to take into account the 'zoom' of the board.
    // With it set to false, the coordinates would be as if the board was fully zoomed out.

    let w = board.spaceWidth,
        offset = board.settings.translationOffset,
        step = offset.step,
        xTranslationOffset = offset.x * w * step,
        yTranslationOffset = offset.y * w * step;

    return {
        x: normalize ? Math.floor((event.offsetX - xTranslationOffset) / w) : noOffset ? event.offsetX : event.offsetX + xTranslationOffset,
        y: normalize ? Math.floor((event.offsetY - yTranslationOffset) / w) : noOffset ? event.offsetY : event.offsetY + yTranslationOffset
    }
}



function mapSpaceToCoord(space, board, noOffset, absolute) {
    //This is what causes zoom to work. Canvas fits fewer spaces by using * board.spaceWidth.

    let w = absolute ? board.minSpaceWidth : board.spaceWidth,
        y = Math.floor(space / board.width) * w,
        x = (space % board.width) * w,
        xOffset = 0,
        yOffset = 0;

    if (!noOffset) {
        let offset = board.settings.translationOffset,
            step = offset.step;

        xOffset = offset.x * w * step,
            yOffset = offset.y * w * step;

        offset.calculatedX = xOffset;
        offset.calculatedY = yOffset;
    }

    if (absolute) {
        y = Math.floor(space / board.width);
        x = space % board.width;
    }

    return {
        x: x + xOffset,
        y: y + yOffset
    }
}


function turnCoordsToSpace(coords, board) {
    return (board.width * coords.y) + coords.x;
}



function mapCoordsToSpace(x, y, board) {
    return (board.width * Math.floor(y)) + Math.floor(x);
}


function determinStepToOrigin(coordA, coordB) {
    if (coordA.x === coordB.x && coordA.y === coordB.y) {
        return {
            xStep: 0,
            yStep: 0
        }
    }
    let yStep = coordA.y > coordB.y ? 1 : -1
    let xStep = coordA.x > coordB.x ? 1 : -1;
    return {
        xStep: xStep,
        yStep: yStep
    }
}


function getBoundingBox(coordA, coordB, board) {

    let boxWidth = Math.abs(coordA.x - coordB.x);

    if (coordA.x === coordB.x) {
        return [mapCoordsToSpace(coordA.x, coordA.y, board)];
    }

    let { xStep, yStep } = determinStepToOrigin(coordA, coordB);

    let result = [];

    let current = {};

    Object.assign(current, coordB)

    let stopper = 100000;

    for (current; stopper > 0; current.y += yStep, stopper--) {
        for (let i = 0; i < boxWidth + 1; i++, current.x += xStep) {
            let space = mapCoordsToSpace(current.x, current.y, board);
            result.push(space);
            if (current.x === coordA.x && current.y === coordA.y) {
                return result;
            }
        }
        current.x = coordB.x
    }
    throw new Error('infinite loop in getBoundingBox');
}


function parsePattern(patternTxt) {
    // turn .cells file text into an array of arrays, each array signifying a row
    // by detecting line breaks.
    let result = [],
        lineStart = 0;
    for (let i = 0; i < patternTxt.length; i++) {
        if (patternTxt[i].match(/\n/)) {
            let line = patternTxt.slice(lineStart, i);
            result.push(line);
            lineStart = i + 1;
        }
    }
    let lastLine = patternTxt.slice(lineStart, patternTxt.length);
    result.push(lastLine)
    return result;
}

function mapPatternToSpace(pattern, board, origin) {
    // Maps the parsed .cells file unto the board by assuming every array lies
    // on one board row.

    // The offset allows the pattern to be loaded with any point as the origin,
    // given as a coord or a space.
    let offset = origin.length > 1 ? mapCoordsToSpace(origin[0], origin[1], board) : origin[0];
    offset = origin.length === 0 ? 0 : offset;

    let parsedPattern = parsePattern(pattern);
    let wrapDist = board.width;
    let result = [];

    for (let row = 0; row < parsedPattern.length; row++) {
        let space = row * wrapDist;
        for (let pos of parsedPattern[row]) {
            if (pos === 'O') result.push(space + offset);
            space += 1;
        }
    }
    return result;
}


function determineTopSpace(inCoords, outCoords, board, absolute, returnBottom) {
    //returns highest and leftmost space of a selection

    absolute = absolute ? absolute : false;

    let selectionWidth = Math.abs(inCoords.x - outCoords.x);

    let inSpace = utils.turnCoordsToSpace(inCoords, board),
        outSpace = utils.turnCoordsToSpace(outCoords, board);

    let topSpace = Math.min(inSpace, outSpace),
        bottomSpace = Math.max(inSpace, outSpace);

    if (topSpace % board.width > bottomSpace % board.width) {
        topSpace = topSpace - selectionWidth;
    }

    let topSpaceCoord = utils.mapSpaceToCoord(topSpace, board, true, absolute);

    if (returnBottom) {
        return {
            top: topSpaceCoord,
            bottom: utils.mapSpaceToCoord(bottomSpace, board)
        }
    }
    return topSpaceCoord;
}



function mapSelectionToOrigin(spaces, board) {

    let { inCoords, outCoords } = board.game.clipBoard.boxCoords;

    let topSpace = determineTopSpace(inCoords, outCoords, board)

    let topX = Math.round(topSpace.x / board.spaceWidth);
    let topY = Math.round(topSpace.y / board.spaceWidth);

    let result = [];

    for (let space of spaces) {
        let skimmed = space - ((topY * board.width) + topX);
        result.push(skimmed);
    }
    return result;

}


function mapSpaceToPattern(spaces, board) {

    console.log(board);

    spaces.sort((a, b) => a - b);

    let result = ``;

    let originEquiv = mapSelectionToOrigin(spaces, board);

    for (let i = 0; i < spaces.length; i++) {
        result += board.state[spaces[i]] ? 'O' : '.';
        if (originEquiv[i + 1] % board.width === 0) {
            result += '\n';
        }
    }
    return result;
}


function generateRandomRuleArray(spread) {
    let result = [];
    let neighbourHoodLimit = ((spread * 2) + 1) ** 2 - 1;
    let randomRange = Math.round( Math.random() * neighbourHoodLimit );

    for (randomRange; randomRange > 0; randomRange--) {
        let randomNum = Math.round(Math.random() * neighbourHoodLimit);
        result.includes(randomNum) ? randomRange++ : result.push(randomNum);
    }
    return result.sort((a, b) => a - b);
};

function parseBSRuleString (rulestring) {

    let result = {
        birth: [],
        survive: [],
        spread : 1,
        includeCenter : false
    };

    rulestring = rulestring.replace(/\s/g, '');
    rulestring = rulestring.toUpperCase(rulestring);

    let BirthSurvive = {
        birth: rulestring.match(/(?<=B)\d*/g)[0],
        survive: rulestring.match(/(?<=S)\d*/g)[0]
    };

    for (let prop of Object.keys(BirthSurvive)) {
        let parsed = [];
        for (let stringNum of BirthSurvive[prop]) {
            let toNum = parseInt(stringNum);
            parsed.push(toNum);
        }
        result[prop] = parsed;
    }

    return result;
    
}

function parseLtLRulestring (rulestring) {

    let result = {
        birth : [],
        survive : [],
        spread : true,
        includeCenter : true
    };

    let letterMeanings = {
        'R' : 'spread',
        'M' : 'includeCenter',
        'S' : 'survive',
        'B' : 'birth'
    };

    let associated = {};

    let values = rulestring.match(/(?<=[A-Z])[0-9.]+?(?=,|$)/g);

    let toSet = rulestring.match(/[A-Z]+/g);

    toSet.forEach((prop, index) => {
        associated[prop] = values[index];
    });

    for (let prop of Object.keys(associated)) {
        let letterToMeaning = letterMeanings[prop];
        let value = associated[prop];
        let isRange = value ? value.includes('..') : false;

        if (isRange) {
            let rangeNums = associated[prop].match(/[0-9]+/g); 

            let rangeFrom = parseInt(rangeNums[0]);
            let rangeTo = parseInt(rangeNums[1]);
            
            for (let i = rangeFrom; i <= rangeTo; i++) {
                result[letterToMeaning].push(i);
            }
        } else if (result[letterToMeaning]) {
            result[letterToMeaning] = parseInt(value);
        }
    }
    return result;
}


function parseRulestring(rulestring) {

    let specialWords = ['random', 'default'];

    let ruleFamily = $('#inputBar').attr('rule');

    if (rulestring.length >= 3) {

        if (specialWords.includes(rulestring)) {
            switch (rulestring) {
                case 'random':
                    rulestring = generateRandomRulestring(ruleFamily);
                    break;
                case 'default' :
                    let newRule = !isLtL ? new logic.Rules() : new logic.Rules(logic.rulePresets.LtLPresets.Bugs);
                    rulestring = generateRulestring(newRule);
                    break;
            }
        }
        let result = ruleFamily === 'B/S' ? parseBSRuleString(rulestring) : parseLtLRulestring(rulestring);
        return result;
    } else {
        throw new Error('Invalid Rulestring');
    }
}

function generateBSRulestring (rule) {
    let result = ``;
    console.log(rule)
    for (let prop of Object.keys(rule)) {
        if (Array.isArray(rule[prop])) {
            prop === 'birth' ? result += 'B' : prop === 'survive' ? result += '/S' : undefined;
            for (let num of rule[prop]) {
                result += num;
            }
        }
    }

    return result;
}

function generateLtLRulestring (rule) {

    let ranges = {
        birthRange : [rule.birth[0], rule.birth[rule.birth.length - 1]],
        surviveRange : [rule.survive[0], rule.survive[rule.survive.length - 1]]
    };

    console.log(rule);

    let result = `R${rule.meta.spread},C0,M${rule.meta.includeCenter + 0},S${ranges.surviveRange[0]}..${ranges.surviveRange[1]},B${ranges.birthRange[0]}..${ranges.birthRange[1]},NM`;
    return result;
}

function generateRulestring(rule) {

    let isLtL = rule.meta.spread > 1 || rule.meta.includeCenter;

    // let selectedRuleFamily = $('#inputBar').attr('rule');

    // if (!isLtL && selectedRuleFamily === 'LtL') {
    //     console.log($('.toggleRuleType'));
    //     $('.toggleRuleType').trigger('click');
    // }

    let result = isLtL ? generateLtLRulestring(rule) : generateBSRulestring(rule);

    return result;

}

function returnRandomRange (min, max) {

    let rangeA = Math.floor(Math.random() * max); 
    let rangeB = Math.floor(Math.random() * max);
    
    rangeA = rangeA > max ? max : rangeA;
    rangeB = rangeB > max ? max : rangeB;
    
    rangeA = rangeA < min ? min : rangeA;
    rangeB = rangeB < min ? min : rangeB;

    let rMax = Math.max(rangeA, rangeB);
    let rMin = Math.min(rangeA, rangeB);


    return [rMin, rMax];
}

function generateRandomRulestring (ruleFamily) {
    let rulestring = ``;

    switch (ruleFamily) {

        case 'B/S':
            let b = generateRandomRuleArray(1).join('');
            let s = generateRandomRuleArray(1).join('');
            rulestring = `B${b}/S${s}`;
            break;

        case 'LtL':
            let spreadMax = 10;

            let range = Math.round(Math.random() * spreadMax);

            let includeCenter = Math.floor(Math.random() * 2);

            let neighbourHoodLimit = (((range * 2) + 1) ** 2) - 1;

            let redundantLtL = !includeCenter && range === 1;

            if (redundantLtL) {
                includeCenter = true;
            }

            let birthRange = returnRandomRange(1, neighbourHoodLimit);
            let surviveRange = returnRandomRange(1, neighbourHoodLimit);

            rulestring = `R${range},C0,M${includeCenter},S${surviveRange[0]}..${surviveRange[1]},B${birthRange[0]}..${birthRange[1]},NM`;
            break;
    }
    return rulestring;
}


function setRules(rule, board) {
    rule = rule === undefined ? new logic.Rules() : rule;
    let newRules = new logic.Rules(rule.birth, rule.survive, rule.spread, rule.includeCenter);
    board.rules = newRules;
    let rulestring = generateRulestring(newRules);
    $('#inputBar').val(rulestring);
}

function determinePatternBoundary(pattern, board, returnSpace) {

    if (pattern.length === 0) {
        return [{ x: 0, y: 0 }, { x: 0, y: 0 }]
    }

    let type = typeof pattern;
    let parsed = type === 'string' ? mapPatternToSpace(pattern, board) : pattern;

    let initCoord = mapSpaceToCoord(pattern[0], board, true, true);

    let initVal = { x: initCoord.x, y: initCoord.y };

    let [xMax, xMin, yMax, yMin] = [initVal, initVal, initVal, initVal];

    for (let space of parsed) {

        let mapped = mapSpaceToCoord(space, board, true, true);

        xMax = xMax.x < mapped.x ? mapped : xMax;
        xMin = xMin.x > mapped.x ? mapped : xMin;

        yMax = yMax.y < mapped.y ? mapped : yMax;
        yMin = yMin.y > mapped.y ? mapped : yMin;
    }

    if (returnSpace) {
        let spaceA = mapCoordsToSpace(xMin.x, yMin.y, board);
        let spaceB = mapCoordsToSpace(xMax.x, yMax.y, board);
        return [spaceA, spaceB];
    }
    return [{ x: xMin.x, y: yMin.y }, { x: xMax.x, y: yMax.y }];
}


function clearSelection(board) {
    let selection = board.game.clipBoard.boxCoords;
    if (selection) {
        let { inCoords, outCoords } = selection;
        let boundingBox = getBoundingBox(inCoords, outCoords, board);

        for (let space of boundingBox) {
            logic.killSpace(space, board);
        }
    }
}

function loadPattern(pattern, board, ...origin) {
    let mapping = mapPatternToSpace(pattern, board, origin);
    console.log(mapping)
    for (let space of mapping) {
        logic.birthSpace(space, board)
    }
    canvasFuncs.drawFrame(board, true);
}

function initializeRandomBoard(board) {
    let density = board.settings.randomizationDensity;
    let totalSpaces = board.width * board.height,
        spaceCount = Math.floor(totalSpaces * density);
    let birthed = {};

    utils.clearBoard(board);

    for (let i = spaceCount; i > 0; i--) {
        let random = Math.floor(Math.random() * totalSpaces);
        if (!birthed[random]) {
            logic.birthSpace(random, board);
            birthed[random] = true;
        } else {
            i++;
        }
    }
    canvasFuncs.drawFrame(board, true);
};



function matchCoordsToSelection(origin, current) {
    // Selection from each direction starts from the same corner of a box
    // causing every direction to appear to select differently.
    // This can be fixed by adding 1 unit to every x or y
    // bigger than its counterpart in the other coord.

    let translatedOrigin = {};
    let translatedCurrent = {};

    Object.assign(translatedOrigin, origin);
    Object.assign(translatedCurrent, current);

    for (let coord of Object.keys(origin)) {
        translatedOrigin[coord] = translatedOrigin[coord] > translatedCurrent[coord] ? translatedOrigin[coord] + 1 : translatedOrigin[coord];
        translatedCurrent[coord] = translatedCurrent[coord] > translatedOrigin[coord] ? translatedCurrent[coord] + 1 : translatedCurrent[coord];
    }
    return {
        translatedOrigin: translatedOrigin,
        translatedCurrent: translatedCurrent
    }
}

function startBoard(board, drawFunc) {
    if (board.status !== 'playing') {
        drawFunc();
        board.status = 'playing';
    }
}

function stopBoard(board) {
    if (board.status === 'playing') {
        board.status = 'stopped';
        window.cancelAnimationFrame(board.intervalKey);
        window.clearInterval(board.intervalKey);
        canvasFuncs.drawFrame(board, true);
        canvasFuncs.drawGenInfo(board);
    }
}

function changeTool(binderName, game, ...args) {

    let lastUsed = game.tools.lastUsed;
    let currentTool = game.tools.current;
    let type = args[0];

    if (binderName === currentTool.name && type === currentTool.type) {
        return;
    }

    $('#touchCanvas').off('.tool');
    $('#touchCanvas').css('cursor', 'default');

    // if tool name is false, unset the current tool.
    if (!binderName) {
        game.tools.current.binder = undefined;
        game.tools.current.name = undefined;
        game.tools.current.type = undefined;
        return;
    }

    lastUsed = currentTool;

    let toolBinder = game.tools.binders[binderName];

    game.tools.current.binder = toolBinder;
    game.tools.current.name = binderName;
    game.tools.current.type = type;
    game.tools.current.binder(game, ...args);
}


function applyPen(board, type) {
    let space = board.mousePos.space,
        pointerSize = board.settings.pointerSize;

    if (type === 'draw') {
        type = true;
    } else if (type === 'erase') {
        type = false;
    } else {
        throw new Error('invalid type argument in applyPen.');
    }

    let penFunc = type ? logic.birthSpace : logic.killSpace;

    if (pointerSize > 1) {
        // Pointer size 1 corresponds to a single block, while
        // spread 1 is a block and its 8 neighbours. 
        let areaOfEffect = logic.rni(space, board, pointerSize - 1);
        for (let pos of areaOfEffect) {
            penFunc(pos, board);
        }
    }
    // The space passed into returnNeighbourIndices is not returned
    // with its neighbours. This also draws a single point in case pointer size is 1.
    penFunc(space, board);
}

function setSelection(boxOrigin, boxEnd, game) {
    $('.addRuleBox, .copy, .paste, .clearSelection').removeClass('disabled');


    $('.contextSelect').css('opacity', '1');
    $('.contextSelect').css('transform', 'translateX(0px)');

    game.clipBoard.boxCoords = {
        inCoords: boxOrigin,
        outCoords: boxEnd
    };
}

function unsetSelection(game) {
    $('.addRuleBox, .copy, .paste, .clearSelection').addClass('disabled');
    $('.contextSelect').css('opacity', '0');
    $('.contextSelect').css('transform', 'translateX(-20px)');



    game.clipBoard.boxCoords = undefined
}

function getCurrentTool(board) {
    return board.game.tools.current;
}

function applyZoom(board) {
    board.settings.translationOffset.x = 0;
    board.settings.translationOffset.y = 0;

    // grab selection...
    let { inCoords, outCoords } = board.game.clipBoard.boxCoords;
    let topSpaceCoord = utils.determineTopSpace(inCoords, outCoords, board);

    // ...move it to canvas origin...
    board.settings.translationOffset.x -= topSpaceCoord.x / board.spaceWidth;
    board.settings.translationOffset.y -= topSpaceCoord.y / board.spaceWidth;

    // ...zoom in by making the canvas fit spaces based on selection width.
    let widthToSet = canvas.width / Math.abs(outCoords.x - inCoords.x);

    widthToSet = widthToSet > board.width || widthToSet <= 0 ? board.spaceWidth : widthToSet;

    board.spaceWidth = widthToSet;

    canvasFuncs.drawTouchFrame(board, true);
    canvasFuncs.drawFrame(board, true);

    // board.game.clipBoard.boxCoords = undefined;
    unsetSelection(board.game);
}

function resetZoom(board, resetOffset) {
    if (resetOffset) {
        board.settings.translationOffset.x = 0;
        board.settings.translationOffset.y = 0;
    }
    board.spaceWidth = (window.innerWidth) / (board.width);
    canvasFuncs.drawTouchFrame(board, true);
    if (board.status !== 'playing') {
        canvasFuncs.drawFrame(board, true);
    }
}

function trimDeadSpace(pattern, board) {
    let parsed = parsePattern(pattern);
    let result = [];

    for (let row = 0; row < parsed.length; row++) {
        let livingInRow = 0;
        let rowX = parsed[row];
        for (let space = 0; space < rowX.length; space++) {
            livingInRow = rowX[space] === 'O' ? livingInRow + 1 : livingInRow;
        }
        if (livingInRow !== 0) {
            result.push(parsed[row]);
        }
    }
    let toPattern = mapSpaceToPattern(result, board);
    return toPattern;
}


function copySelection(game) {
    let selection = game.clipBoard.boxCoords;
    let copyOccured = false;

    if (selection) {
        let { inCoords, outCoords } = selection;
        let spaces = utils.getBoundingBox(inCoords, outCoords, game.current);
        let trim = utils.determinePatternBoundary(spaces, game.current, false);
        let trimmedPattern = utils.getBoundingBox(trim[0], trim[1], game.current);
        let pattern = utils.mapSpaceToPattern(trimmedPattern, game.current);
        game.clipBoard.pattern = pattern;
        copyOccured = true;
        unsetSelection(game);
    }
    return copyOccured;
}

function pasteSelection(game) {
    let pattern = game.clipBoard.pattern;
    let selection = game.clipBoard.boxCoords;

    if (pattern && selection) {
        let origin = utils.determineTopSpace(selection.inCoords, selection.outCoords, game.current);

        let x = Math.floor(origin.x / game.current.spaceWidth);
        let y = Math.floor(origin.y / game.current.spaceWidth);

        loadPattern(pattern, game.current, x, y);

        // game.clipBoard.boxCoords = undefined;
        unsetSelection(game);

    }
}

function setRuleBox(game, rules) {
    let selection = game.clipBoard.boxCoords;

    if (selection) {
        let { inCoords, outCoords } = selection;

        let boundingBox = utils.getBoundingBox(inCoords, outCoords, game.current);

        for (let space of boundingBox) {
            game.current.ruleBoxes.spaces[space] = rules;
        }
        game.current.ruleBoxes.birthNums.push(...rules.birth);

        // game.clipBoard.boxCoords = undefined;
        unsetSelection(game);
        canvasFuncs.drawTouchFrame(game.current);
    }
}

function clearRuleBoxes(board) {
    board.ruleBoxes.spaces = {};
    board.ruleBoxes.birthNums = [];
}


function returnAverage(a, b) {
    return Math.floor((a + b) / 2);
}


function hexToRGB(hex, returnString) {
    if (hex.length !== 7) {
        console.log(hex);
    }
    let regex = /\w{2}/g;
    let rgb = hex.match(regex);
    let result = [];
    for (let channel of rgb) {
        let toNum = parseInt(channel, 16);
        result.push(toNum);
    }

    if (returnString) {
        return `rgb(${result[0]},${result[1]},${result[2]})`;
    }
    return result;
}

function rgbToHex(rgb) {
    let result = '#';
    for (let channel of rgb) {
        let toHex = channel.toString(16);
        toHex = toHex.length === 1 ? `0${toHex}` : toHex;
        result += toHex;
    }
    return result;
}


function triggerSliderAtValue(val, sliderName) {

    let slider = $(sliderName);
    let sliderStep = parseInt(slider.attr('step'), 10);
    let sliderWidth = parseInt(slider.css('width'));

    let maxVal = parseInt(slider.attr('max'));
    let minVal = parseInt(slider.attr('min'));

    val = val >= maxVal ? maxVal : val <= minVal ? minVal : val;

    // divide by step to find how many sectionLens the value is worth
    val = (val / sliderStep);

    let numOfVals = Math.round(maxVal / sliderStep);
    let sectionLen = sliderWidth / numOfVals;

    let x = (sectionLen * val);

    // create a click event whose pageX is x distance from origin of slider 
    let event = new $.Event('click');
    event.pageX = slider.offset().left + x;

    slider.trigger(event);
}

function initializeSliders() {
    let sliders = $('.slider');
    for (let slider of sliders) {
        let defaultVal = parseInt($(slider).attr('defaultVal'));
        let minVal = parseInt($(slider).attr('min'));
        let val = defaultVal ? defaultVal : minVal ? minVal : 0;
        triggerSliderAtValue(val, slider);
    }
}


function incrementSlider(sliderName, e, positiveTrigger) {
    let sliderValue = parseInt($(sliderName).attr('value'));
    let step = parseInt($(sliderName).attr('step'));
    let increment = e.which === positiveTrigger ? step : (step * -1);
    let value = sliderValue + increment;
    triggerSliderAtValue(value, sliderName);
}


function transitionOut(element, transitions, stayingTime, changeDisplay) {

    stayingTime = stayingTime !== undefined ? stayingTime : 300;
    changeDisplay = changeDisplay === undefined ? true : changeDisplay;

    window.setTimeout(function () {
        $(element).stop(true, true).css(transitions);
    }, stayingTime)

    if (changeDisplay) {
        window.setTimeout(function () {
            $(element).stop(true, true).css('display', 'none');
        }, stayingTime + 200);
    }
}


function transitionIn(element, transitions, changeDisplay) {
    changeDisplay = changeDisplay === undefined ? true : changeDisplay;

    if (changeDisplay) {
        $(element).stop(true, true).css('display', 'initial');
    }

    window.setTimeout(function () {
        $(element).stop(true, true).css(transitions);
    }, 0)
}


function setLoadableRulePresets(ruleFamily, board) {
    let persetSelect = $('#ruleSelect');
    persetSelect.html('');
    let presets = board.rules.presets[ruleFamily];
    for (let preset of Object.keys(presets)) {

        let ruleString = presets[preset];

        persetSelect.append(`<option value='${ruleString}'> : ${preset}</option>`);
    }
}


let utils = {
    parsePattern: parsePattern,
    mapPatternToSpace: mapPatternToSpace,
    clearBoard: clearBoard,
    mapSpaceToCoord: mapSpaceToCoord,
    mapCoordsToSpace: mapCoordsToSpace,
    getEventCoords: getEventCoords,
    getBoundingBox: getBoundingBox,
    determinStepToOrigin: determinStepToOrigin,
    turnCoordsToSpace: turnCoordsToSpace,
    mapSpaceToPattern: mapSpaceToPattern,
    determineTopSpace: determineTopSpace,
    generateRandomRuleArray: generateRandomRuleArray,
    parseRulestring: parseRulestring,
    generateRulestring: generateRulestring,
    setRules: setRules,
    determinePatternBoundary: determinePatternBoundary,
    turnCoordsToSpace: turnCoordsToSpace,
    generateRulestring: generateRulestring,
    clearSelection: clearSelection,
    setSelection: setSelection,
    unsetSelection: unsetSelection,
    matchCoordsToSelection: matchCoordsToSelection,
    startBoard: startBoard,
    stopBoard: stopBoard,
    getCurrentTool: getCurrentTool,
    resetZoom: resetZoom,
    changeTool: changeTool,
    applyPen: applyPen,
    copySelection: copySelection,
    pasteSelection: pasteSelection,
    setRuleBox: setRuleBox,
    clearRuleBoxes: clearRuleBoxes,
    initializeRandomBoard: initializeRandomBoard,
    applyZoom: applyZoom,
    loadPattern: loadPattern,
    returnAverage: returnAverage,
    hexToRGB: hexToRGB,
    triggerSliderAtValue: triggerSliderAtValue,
    incrementSlider: incrementSlider,
    initializeSliders: initializeSliders,
    transitionIn: transitionIn,
    transitionOut: transitionOut,
    setLoadableRulePresets : setLoadableRulePresets
}

export { utils }