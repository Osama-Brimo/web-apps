import { logic } from './logic.js'
import { utils } from './utilities.js'


const canvas = document.getElementById('drawCanvas'),
    ctx = canvas.getContext('2d');


const touchCanvas = document.getElementById('touchCanvas'),
    ctt = touchCanvas.getContext('2d');


const flashCanvas = document.getElementById('flashCanvas'),
    ctf = flashCanvas.getContext('2d');


/////////////////////////////////////////////////////////////////////////////////////////

function drawAxis(axis, board) {
    for (let w = board.spaceWidth; w < canvas.width; w += board.spaceWidth) {
        ctt.beginPath();
        ctt.strokeStyle = board.settings.colorScheme.strokeStyle;
        ctt.lineWidth = 0.5;
        if (axis === 'y') {
            ctt.moveTo(w, 0);
            ctt.lineTo(w, canvas.height);
        }
        if (axis === 'x') {
            ctt.moveTo(0, w);
            ctt.lineTo(canvas.width, w);
        }
        ctt.stroke()
    }
};


function drawGrid(board) {
    ctt.clearRect(0, 0, touchCanvas.width, touchCanvas.height);
    drawAxis('x', board);
    drawAxis('y', board);
};

function applySettings(board, settingTree, settingObj) {
    if (settingTree && settingObj) {
        for (let key of Object.keys(settingObj)) {
            board.settings[settingTree][key] = settingObj[key];
        }
    }
    $('#drawCanvas').css('background-color', board.settings.colorScheme.canvasBg)
    drawTouchFrame(board, true);
    drawFrame(board, true);
};


function highlightCoord(board) {

    let currentTool = utils.getCurrentTool(board);

    // only highlight the current coord if pen is not the selected tool.
    let pointerSize = currentTool.name === 'pen' ? board.settings.pointerSize : 1,
        spreadModifier = pointerSize - 1;

    let area = pointerSize === 1 ? [board.mousePos.space] : logic.rni(board.mousePos.space, board, spreadModifier);

    for (let space of area) {
        let coords = utils.mapSpaceToCoord(space, board);

        ctt.strokeStyle = board.settings.colorScheme.strokeStyle;
        ctt.lineWidth = 1.2;

        ctt.strokeRect(coords.x, coords.y, board.spaceWidth, board.spaceWidth);
    }
}

function drawFrame(board, freeze, genStep) {
    // freeze is used in cases where we would like to update the board
    // but not calculate the next generation.

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = board.settings.colorScheme.strokeStyle;
    ctx.fillStyle = board.settings.colorScheme.fillStyle;

    let spaceWidth = board.spaceWidth;
    let state = board.state;
    let cellStyle = board.settings.colorScheme.cellStyle;
    let halfSpaceWidth = spaceWidth / 2;

    for (let space = 0; space < board.state.length; space++) {
        let living = state[space];
        if (living) {
            let mapped = utils.mapSpaceToCoord(space, board);
            switch (cellStyle) {
                case 'default' :
                    ctx.fillRect(mapped.x, mapped.y, spaceWidth, spaceWidth);
                    break;
                case 'circle':
                    ctx.beginPath();
                    ctx.arc(mapped.x + halfSpaceWidth, mapped.y + halfSpaceWidth, halfSpaceWidth, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'triangle':
                    ctx.beginPath(); 
                    ctx.moveTo(mapped.x + spaceWidth / 2, mapped.y);
                    ctx.lineTo(mapped.x, mapped.y + spaceWidth);
                    ctx.lineTo(mapped.x + spaceWidth, mapped.y + spaceWidth);
                    ctx.fill();
                    break;
            }
        }
    }

    if (!freeze) {
        if (genStep > 1) {
            logic.skipNGens(genStep, board);
        } else {
            logic.loadNextState(board, genStep);
        }
    }
}

function drawGenInfo(board) {
    if (board.settings.displayCanvasInfo) {

        let canvasGenCounter = document.getElementById('genCounter'),
            ctxGenCounter = canvasGenCounter.getContext('2d');

        ctxGenCounter.clearRect(0, 0, canvasGenCounter.width, canvasGenCounter.height);
        // ctxGenCounter.strokeStyle = board.settings.colorScheme.strokeStyle;
        ctxGenCounter.fillStyle = board.settings.colorScheme.textColor;
        ctxGenCounter.font = `20px ${board.settings.colorScheme.font}`;
        // ctxGenCounter.strokeText(`Generation: ${board.genCount}`, 10, 25);
        ctxGenCounter.fillText(`Generation: ${board.genCount}`, 10, 25);
        ctxGenCounter.font = `15px ${board.settings.colorScheme.font}`;

        // ctxGenCounter.strokeText(`${board.status}`, 10, 45)
        ctxGenCounter.fillText(`${board.status}`, 10, 45)


        // ctxGenCounter.strokeText(`Step = ${board.settings.genStep}`, 10, 65);
        ctxGenCounter.fillText(`Step = ${board.settings.genStep}`, 10, 65);

        let delay = board.settings.delay;

        // ctxGenCounter.strokeText(`Delay = ${delay}ms`, 10, 85);
        ctxGenCounter.fillText(`Delay = ${delay}ms`, 10, 85);


    }
}

function drawCoordsInfo(board) {
    if (board.settings.displayCanvasInfo) {
        let canvasCoords = document.getElementById('coords'),
            ctxCoords = canvasCoords.getContext('2d');

        ctxCoords.textAlign = 'center';

        ctxCoords.clearRect(0, 0, canvasCoords.width, canvasCoords.height);
        // ctxCoords.strokeStyle = board.settings.colorScheme.strokeStyle;
        ctxCoords.fillStyle = board.settings.colorScheme.textColor;
        ctxCoords.font = `20px ${board.settings.colorScheme.font}`;

        let coords = board.mousePos.coords;
        let space = board.mousePos.space;

        // ctxCoords.strokeText(`(x:${coords.x},y:${coords.y})`, 300, 30);
        ctxCoords.fillText(`(x:${coords.x},y:${coords.y})`, 300, 30);
        ctxCoords.fillText(`space:${space}`, 300, 50);
        // ctxCoords.strokeText(`space:${space}`, 300, 50);
    }
}

function drawTouchFrame(board) {
    ctt.clearRect(0, 0, touchCanvas.width, touchCanvas.height);
    if (board.settings.drawGrid && board.spaceWidth >= 4) {
        drawGrid(board);
    }
    if (board.game.clipBoard.boxCoords) {
        persistSelection(board);
    }
    highlightCoord(board);
}

function flashMsg(board, message, displayCycles) {

    let counter = { cycles: displayCycles };
    window.clearInterval(board.flashKey);

    board.flashKey = window.setInterval(function (counter, board) {
        counter.cycles = counter.cycles > 0 ? counter.cycles - 0.7 : 0;
        ctf.clearRect(0, 0, flashCanvas.width, flashCanvas.height)

        ctf.globalAlpha = counter.cycles === 0 ? ctf.globalAlpha < 0.1 ? 0 : ctf.globalAlpha * 0.45 : undefined;

        ctf.fillStyle = board.settings.colorScheme.textColor;
        // ctf.strokeStyle = board.settings.colorScheme.strokeStyle;

        ctf.font = `${60 - (message.length * 2)}px ${board.settings.colorScheme.font}`;

        ctf.fillText(message, 50, 50);
        // ctf.strokeText(message, 50, 50);

        if (ctf.globalAlpha === 0) {
            window.clearInterval(board.flashKey);
            ctf.globalAlpha = 1;
        }

    }, 30, counter, board);
}


function drawSelection(board, e, fill = true, customMsg) {

    // snap to spaces if the board is zoomed in enough
    let type = board.spaceWidth >= 5 ? 'snap' : 'free';
    let precision = type === 'snap';

    // draw with absolute coords and no offset if free selection
    // or with relative and offset if we need to snap to spaces.
    let origin = precision ? utils.getEventCoords(e, board, true) : utils.getEventCoords(e, board, false, true);

    $('#touchCanvas').data('in', utils.getEventCoords(e, board, true));

    $('#touchCanvas').on('mousemove.tool', function (e1) {

        let current = precision ? utils.getEventCoords(e1, board, true) : utils.getEventCoords(e1, board, false, true);

        let originX = origin.x,
            originY = origin.y;

        let currentX = current.x,
            currentY = current.y;

        if (precision) {
            let { translatedOrigin, translatedCurrent } = utils.matchCoordsToSelection(origin, current);

            originX = translatedOrigin.x;
            originY = translatedOrigin.y;
            currentX = translatedCurrent.x;
            currentY = translatedCurrent.y;

            //maps the coords back to their space, effectively making the selection 'snap' unto the spaces
            let originSpace = utils.mapCoordsToSpace(originX, originY, board)
            let currentSpace = utils.mapCoordsToSpace(currentX, currentY, board);

            //remap the spaces to coords for drawing
            let remapOrigin = utils.mapSpaceToCoord(originSpace, board);
            let remapCurrent = utils.mapSpaceToCoord(currentSpace, board);

            let w = board.spaceWidth;

            originX = remapOrigin.x;
            originY = remapOrigin.y;
            // account for the case where selection is intended to be 1 unit wide/tall
            currentX = remapCurrent.x === remapOrigin.x ? remapCurrent.x + w : remapCurrent.x;
            currentY = remapCurrent.y === remapOrigin.y ? remapCurrent.y + w : remapCurrent.y;
        }

        //draw
        let theme = board.settings.colorScheme;

        ctt.beginPath();
        ctt.globalAlpha = 0.5;
        ctt.fillStyle = theme.fillStyle;

        ctt.setLineDash([5, 5]);
        ctt.lineWidth = 2;
        ctt.strokeStyle = theme.strokeStyle;

        ctt.moveTo(originX, originY);
        ctt.lineTo(originX, currentY);
        ctt.lineTo(currentX, currentY);
        ctt.lineTo(currentX, originY);
        ctt.lineTo(originX, originY);

        ctt.stroke();

        if (fill) {
            ctt.fillStyle = theme.textColor;
            ctt.fillRect(originX, originY, (currentX - originX), (currentY - originY));
        }

        ctt.globalAlpha = 1;

        if (customMsg) {
            ctt.fillStyle = theme.textColor;
            let textOffset = current.x < origin.x ? -40 : 15;    // get cursor text out of the way of the selection
            ctt.fillText(customMsg, currentX + textOffset, currentY);
        }

        ctt.setLineDash([]);

        $(this).data('out', utils.getEventCoords(e1, board, true));
    });
}

function persistSelection(board) {
    let boxCoords = board.game.clipBoard.boxCoords

    if (boxCoords) {
        let spaceWidth = board.spaceWidth;
        let { translatedOrigin, translatedCurrent } = utils.matchCoordsToSelection(boxCoords.inCoords, boxCoords.outCoords);

        // account for the case where selection is intended to be 1 unit wide/tall
        let boxWidth = translatedCurrent.x !== translatedOrigin.x ? (translatedCurrent.x - translatedOrigin.x) * spaceWidth : spaceWidth,
            boxHeight = translatedCurrent.y !== translatedOrigin.y ? (translatedCurrent.y - translatedOrigin.y) * spaceWidth : spaceWidth;

        let translationStep = board.settings.translationOffset.step

        let xOffset = board.settings.translationOffset.x * translationStep,
            yOffset = board.settings.translationOffset.y * translationStep;

        //draw
        ctt.fillStyle = board.settings.colorScheme.textColor;
        ctt.globalAlpha = 0.3;

        ctt.fillRect((translatedOrigin.x + xOffset) * spaceWidth, (translatedOrigin.y + yOffset) * spaceWidth, boxWidth, boxHeight);

        ctt.globalAlpha = 1;
    }

}

function drawSnapShotTemplate (board) {

    let includeInfo = board.settings.snapshotInfo;
    
    if (includeInfo) {
        ctx.fillStyle = board.settings.colorScheme.textColor;
        ctx.font = 'bold 30px monospace';
        let rulestring = utils.generateRulestring(board.rules);
        ctx.fillText(`${rulestring}`, 50, 50);
    }

    let img = canvas.toDataURL('image/png', 1.0);

    return img;
}






let canvasFuncs = {
    drawFrame: drawFrame,
    drawTouchFrame: drawTouchFrame,
    drawGrid: drawGrid,
    flashMsg: flashMsg,
    drawSelection: drawSelection,
    persistSelection: persistSelection,
    drawGenInfo: drawGenInfo,
    applySettings: applySettings,
    drawCoordsInfo: drawCoordsInfo,
    drawSnapShotTemplate : drawSnapShotTemplate
}

export { canvasFuncs }