
import { logic } from './logic.js'
import { canvasFuncs } from './canvas.js'
import { utils } from './utilities.js'
import { patterns } from './patterns.js';

class Settings {
    constructor(delay, colorScheme, displayCanvasInfo, genStep) {
        this.delay = delay ? delay : 0;
        this.pauseOnToolUse = true;
        this.snapshotInfo = true;
        this.menuTransparent = true;
        this.randomizationDensity = 0.1;
        this.colorScheme = colorScheme ? colorScheme : {
            canvasBg: 'black',
            fillStyle: 'white',
            strokeStyle: 'white',
            textColor: 'gray',
            font: 'monospace',
            cellStyle: 'default',
            spaceShadow : 'rgba(23,45,120,0.3)'
        };
        this.displayCanvasInfo = displayCanvasInfo === undefined ? true : displayCanvasInfo;
        this.genStep = genStep ? genStep : 1;
        this.pointerSize = 1;
        this.translationOffset = {
            x: 0,
            y: 0,
            step: 1,
            calculatedX: 0,
            calculatedY: 0
        };
        this.persistSelection = true;
        this.drawGrid = true;
    };
    set setDelay(n) {
        let playing = game.current.status === 'playing';
        if (playing) {
            utils.stopBoard(game.current);
            this.delay = n;
            utils.startBoard(game.current, draw);
        } else {
            this.delay = n;
        }
    }

    set setPointerSize(n) {
        this.pointerSize = n;
        canvasFuncs.drawTouchFrame(game.current);
    }

    set setRandomizationDensity(n) {
        let adjusted = n / 100;
        this.randomizationDensity = adjusted;
    }

    set setGenStep(n) {
        let playing = game.current.status === 'playing';
        if (playing) {
            utils.stopBoard(game.current);
            this.genStep = n;
            utils.startBoard(game.current, draw);
        } else {
            this.genStep = n;
        }
    }

    set setBoardSize(n) {
        game.current.width = n;
        game.current.height = Math.floor(n / 2);
        utils.resetZoom(game.current, true);
        utils.clearBoard(game.current);
    }
};

class Board {
    constructor(width, height, rules, settings) {
        this.width = width;
        this.height = height;

        this.population = 0;
        this.genCount = 0;

        this.state = logic.buildEmptyBoardModel(this.width, this.height);
        this.nextCheck = logic.getSpaces(width, height);
        this.living = [];

        this.checkThreshold = Math.floor(width * height * 0.5);

        this.spaceWidth = 1;
        this.spaceHeight = 1;

        this.intervalKey = undefined;
        this.flashKey = undefined;

        this.cache = [];

        this.settings = settings ? settings : new Settings();
        this.rules = rules ? rules : new logic.Rules();

        this.mousePos = {
            coords: {
                x: 0,
                y: 0
            },
            space: 0
        };
        this.status = 'stopped';
        this.game = undefined;
        this.ruleBoxes = {
            spaces: {},
            birthNums: []
        }

    }
    set gen(val) {
        this.genCount = val;
        canvasFuncs.drawGenInfo(this);
    }
}

class GameOFLife {
    constructor(board) {

        this.current = board;
        this.clipBoard = {
            pattern: ``,
            boxCoords: undefined,
            cachedState: undefined,
            filePattern: undefined
        };
        this.tools = {
            current: {
                name: undefined,
                binder: undefined,
                type: undefined
            },
            lastUsed: {
                name: undefined,
                type: undefined
            },
            binders: {
                pen: function (game, ...args) {
                    $('#touchCanvas').on('mousedown.tool', function (e) {
                        console.log(e.which);
                        if (e.which === 1) {
                            e.preventDefault();

                            logic.captureState(board, true);
                            utils.applyPen(game.current, ...args);
                            canvasFuncs.drawFrame(game.current, true);
                            $(this).on('mousemove.tool', function (e1) {
                                e1.preventDefault();
                                utils.applyPen(game.current, ...args);
                                canvasFuncs.drawFrame(game.current, true);
                            });
                            $(this).on('mouseup mouseleave', function () {
                                $('#touchCanvas').off('mousemove.tool mouseup mouseleave');
                            });
                        }
                    });
                },
                selector: function (game, taskFunc, customMsg, fill, ...args) {
                    $('#touchCanvas').css('cursor', 'crosshair');
                    $('#touchCanvas').on('mousedown.tool', function (e) {
                        if (e.which === 1) {
                            game.tools.lastUsed = {
                                name: 'selector',
                                type: taskFunc
                            };
                            canvasFuncs.drawSelection(game.current, e, fill, customMsg);
                            $('#touchCanvas').on('mouseup.tool', function () {
                                $(this).off('mouseup.tool mousemove.tool');

                                let clickIn = $(this).data('in'),
                                    clickOut = $(this).data('out');

                                utils.setSelection(clickIn, clickOut, game);

                                if (taskFunc) {
                                    taskFunc(game.current, ...args);
                                }

                            });
                        }
                    });
                },
            },
        };

    }
}

let customSettings = new Settings(0, {
    canvasBg: 'white',
    fillStyle: 'black',
    strokeStyle: 'black',
    textColor: 'tomato',
    font: 'monospace',
    cellStyle : 'default',
    spaceShadow : 'rgba(23,45,120,0.3)'
}, true, 1);


let newBoard = new Board(600, 300, undefined, customSettings);

let game = new GameOFLife(newBoard);

let canvas = document.getElementById('drawCanvas');

console.log(canvas);

newBoard.game = game;


function draw() {
    // Use requestAnimationFrame for best performance
    // or setInterval if a delay is desired.
    if (canvas.getContext) {
        if (game.current.settings.delay === 0 && game.current.settings.genStep === 1) {
            canvasFuncs.drawFrame(game.current, false, game.current.settings.genStep);
            game.current.intervalKey = window.requestAnimationFrame(draw);
        } else {
            game.current.intervalKey = window.setInterval(canvasFuncs.drawFrame, game.current.settings.delay, game.current, false, game.current.settings.genStep);
        }
    }
}


// ------ Button Event Handlers ------- //

$('.captureImage').click( function () {
    let img = canvasFuncs.drawSnapShotTemplate(game.current);
    $(this).attr('href',img);
});

$('.start').on('click', function () {
    let status = game.current.status;
    if (status !== 'playing') {
        $(this).html('<i class="fas fa-stop">');
        canvasFuncs.flashMsg(game.current, 'Playing', 30);
        utils.startBoard(game.current, draw);
    } else {
        $(this).html('<i class="fas fa-play">');
        utils.stopBoard(game.current);
        canvasFuncs.flashMsg(game.current, 'Stopped', 30);
    }
});

$('.forwardOne').click(() => {
    canvasFuncs.drawFrame(game.current, false, game.current.settings.genStep);
    canvasFuncs.drawFrame(game.current, true);
});

$('.rewindOne').click(function() {
    let ctrlZ = new $.Event('keydown');
    ctrlZ.which = 90;
    ctrlZ.ctrlKey = true;
    logic.rewindState(game.current);
    canvasFuncs.drawFrame(game.current, true);
})

$('.zoomIn').on('click', function () {
    utils.changeTool('selector', game, utils.applyZoom, 'zoom', false);
});

// $('.changeBoardSize').click(() => {
//     game.current.width = 100;
//     game.current.height = 50;
//     utils.resetZoom(game.current, true);
// });

$('.randomRules').on('click', function () {
    canvasFuncs.flashMsg(game.current, `Rules Randomized`, 30);
    utils.setRules('random', game.current);
})

$('.randomize').click(function () {
    utils.initializeRandomBoard(game.current);
    canvasFuncs.flashMsg(game.current, 'Board Randomized',30);
})

$('.bugsRules').click(() => {
    canvasFuncs.flashMsg(game.current, `Rules Randomized`, 30);
    utils.setRules('randomLTL', game.current);
})

$('.increaseGenstep').click(() => {
    game.current.settings.genStep = game.current.settings.genStep + 1;
});

$('.defaultRules').click(() => {
    let newRules = new logic.Rules();
    utils.setRules(newRules, game.current);
    canvasFuncs.flashMsg(game.current, `Rules Reset`, 30);
});

$('.addRuleBox').click(function () {
    let disabled = $(this).hasClass('disabled');
    if (!disabled) {
        try {
            let inputVal = $('#inputBar').val();
            let parsed = utils.parseRulestring(inputVal);
            let newRules = new logic.Rules(parsed.birth, parsed.survive, parsed.spread, parsed.includeCenter);
            utils.setRuleBox(game, newRules);
            let rulestring = utils.generateRulestring(game.current.rules);
            $('#inputBar').val(rulestring);
            canvasFuncs.flashMsg(game.current, 'Rulebox Set', 30);
        } catch (error) {
            console.error(error);
            canvasFuncs.flashMsg(game.current, 'Invalid Rulestring!', 30);
        }
    }
});

$('.clearSelection').click(() => {
    utils.clearSelection(game.current);
    canvasFuncs.flashMsg(game.current, 'Selection Cleared', 30);
    canvasFuncs.drawFrame(game.current, true);
});

$('.clear').click(() => {
    utils.clearBoard(game.current);
    utils.clearRuleBoxes(game.current);
    game.current.gen = 0;
    canvasFuncs.flashMsg(game.current, `Board Cleared`, 30);
    canvasFuncs.drawFrame(game.current, true);
});


$('.savePattern').data('saveCount', 0);
$('.savePattern').click(() => {
    let copyOccured = utils.copySelection(game);
    
    if (copyOccured) {
        let pattern = game.clipBoard.pattern;
        let saveCount = $('.savePattern').data('saveCount');
        let name = ` ● Saved Pattern ${saveCount}`;

        patterns[name] = pattern;
        utils.clearSelection(game.current);
        patterns.setLoadablePatterns();
        game.clipBoard.filePattern = pattern;
        $('#patternSelection').val(name);
        canvasFuncs.flashMsg(game.current, 'Pattern Saved', 30);
        $('.savePattern').data('saveCount', saveCount + 1);
    }
});

$('.loadPattern').click(() => {
    logic.captureState(game.current, true);
    let boxCoords = game.clipBoard.boxCoords;
    let pattern = game.clipBoard.filePattern;
    if (pattern) {
        if (boxCoords) {
            let { inCoords, outCoords } = game.clipBoard.boxCoords;
            let a = utils.returnAverage(inCoords.x, outCoords.x);
            let b = utils.returnAverage(inCoords.y, outCoords.y);
            utils.loadPattern(pattern, game.current, a, b);
            utils.unsetSelection(game);
            canvasFuncs.drawTouchFrame(game.current)
        } else {
            let a = Math.round(game.current.width / 3); 
            let b = Math.round(game.current.height / 3);
            utils.loadPattern(pattern, game.current, a, b);
        }
        canvasFuncs.flashMsg(game.current, `Pattern Loaded`, 30);
    } 
});

$('.selectPen').click(() => {
    canvasFuncs.flashMsg(game.current, `Tool : Pen `, 15);
    utils.changeTool('pen', game, 'draw');
});

$('.selectEraser').click(() => {
    canvasFuncs.flashMsg(game.current, `Tool : Eraser `, 15);
    utils.changeTool('pen', game, 'erase');
});

$('.selector').click(() => {
    canvasFuncs.flashMsg(game.current, `Tool : Selector`, 15);
    utils.changeTool('selector', game, false);
});

$('.copy').click(function() {
    let disabled = $(this).hasClass('disabled');
    console.log($(this));
    if (!disabled) {
        utils.copySelection(game);
        canvasFuncs.flashMsg(game.current, 'Copied', 15);
    }
})

$('.paste').click(function() {
    let disabled = $(this).hasClass('disabled');
    if (!disabled) {
        logic.captureState(game.current, true);
        utils.pasteSelection(game);
    }
})


$('.captureState').click(() => {
    game.clipBoard.cachedState = logic.captureState(game.current, false);
    canvasFuncs.flashMsg(game.current, 'State Captured', 30);
});

$('.restoreState').click(() => {
    let cachedState = game.clipBoard.cachedState;
    if (cachedState) {
        logic.restoreState(game.current, game.clipBoard.cachedState);
        canvasFuncs.drawFrame(game.current, true);
        canvasFuncs.flashMsg(game.current, 'State Restored', 30);
    }
});

$('.applyStyle').on('click', function () {
    let themeSettings = $('.colorSchemeSetting');
    for (let setting of themeSettings) {
        let prop = $(setting).attr('property');
        let val = $(setting).val();
        val =  val === '' ? game.current.settings.colorScheme[prop] : val; 
        game.current.settings.colorScheme[prop] = val;
        $(setting).val(val);
        console.log(  $(setting).siblings('i'));
        $(setting).parents('.styleContainer').children('i').css('color',val);
    }
    canvasFuncs.drawFrame(game.current, true);
    canvasFuncs.drawTouchFrame(game.current);
    $('#drawCanvas').css('background-color', game.current.settings.colorScheme.canvasBg);
});


$('.checkbox').click(function() {
    let checked = $(this).hasClass('checked');
    let checkbox =  $(this).children('i');
    let prop = $(this).attr('property');
    if (checked) {
       checkbox.removeClass('fa-check-square');
       checkbox.addClass('fa-square');
       $(this).removeClass('checked');
    } else {
       checkbox.addClass('fa-check-square');
       checkbox.removeClass('fa-square');
       $(this).addClass('checked');
    }
    game.current.settings[prop] = !checked;
    console.log(game.current.settings[prop]);
})

$('.showMsg').click(function () {
    let msgType = $(this).attr('msgType');
    let transitionIn = {
        'transform' : 'translateX(-0.5vw)',
        'opacity' : '1'
    };

    $('.outermostContainer').css('opacity','0.3');

    switch (msgType) {
        case 'shortcuts':
            $('.windowName').text(`Shortcuts`);
            $('.entry').css('display', 'flex');
            break;
        case 'welcome':
            $('.windowName').text(`Welcome!`);
            $('.welcomeMsg').css('display', 'initial');
            break;
    }

    utils.transitionIn('.messageWindow', transitionIn, true);

    // click anywhere outside the message window to exit it.
    // setTimeout is used so that the click which triggers the window does not also close it.
    window.setTimeout(function () {
        $('.outermostContainer').on('click.messageWindow', function() {
            $('.exitWindow').trigger('click');
        })
    }, 0);
});

$('.exitWindow').click(function() {

    $('.welcomeMsg, .entry').css('display','none');

    $('.outermostContainer').off('click.messageWindow');

    $('.outermostContainer').css({
        opacity : '1'
    })

let transitionOut = {
        'transform' : 'translateX(0.5vw)',
        'opacity' : '0'
    }

    utils.transitionOut('.messageWindow',transitionOut, true);
});
// ------ Button Event Handlers ------- //





// ------ Behaviour Handlers ------- //

// display hint on first click
$('#inputBar').data('firstClick', true);
$('#inputBar').focus(function (e) {
    e.preventDefault();

    let firstClick = $('#inputBar').data('firstClick');

    if (firstClick) {
        let transitionIn = {
            'transform' : 'translateX(-0.5vw)',
            'opacity' : '1'
        }
    
        let transitionOut = {
            'transform' : 'translateX(0.5vw)',
            'opacity' : '0'
        }
    
        utils.transitionIn('.hint div', transitionIn, true);
        utils.transitionOut('.hint div', transitionOut, 5000, true);

        $('#inputBar').data('firstClick', false);
    }
});

$('.canvasInfo').on('mouseenter', function () {
    let topPos = $(this).css('top');
    $('.canvasInfo').css({
        'top': `${topPos === '0px' ? '80%' : '0px'}`
    });
})

$('.controlsContainer').on('mouseenter', function () {
    $('.canvasInfo').css('display', 'none');
})

$('.controlsContainer').on('mouseleave', function () {
    if (game.current.settings.displayCanvasInfo) {
        $('.canvasInfo').css('display', 'flex');
    }
})


$('#touchCanvas').on('mousemove', function (e) {
    let currentCoords = utils.getEventCoords(e, game.current, true);
    let currentSpace = utils.mapCoordsToSpace(currentCoords.x, currentCoords.y, game.current);

    game.current.mousePos.coords.x = currentCoords.x;
    game.current.mousePos.coords.y = currentCoords.y;
    game.current.mousePos.space = currentSpace;

    canvasFuncs.drawCoordsInfo(game.current, e);
    canvasFuncs.drawTouchFrame(game.current);
});


$('#touchCanvas').on('contextmenu', function () {
    utils.resetZoom(game.current, true);
});



$('.button, .tabSpan').on('mousedown', function (e) {
    // stop text selection on buttons/tabs
    e.preventDefault();
})

 

$('#touchCanvas').on('mousedown', function () {
    $('input').blur();

    let toolPause = game.current.settings.pauseOnToolUse && game.current.status !== 'stopped';
    utils.unsetSelection(game);
    canvasFuncs.drawTouchFrame(game.current)
    if (toolPause) {
        utils.stopBoard(game.current);
    }
    $(this).on('mouseup', function () {
        if (toolPause) {
            utils.startBoard(game.current, draw);
        }
        $(this).off('mouseup');
    })
});

// ------ Behaviour Handlers ------- //




// ------ Keyboard Shortcuts ------- //

$(document).on('keydown.shortcuts', function (e) {
    
    let enter = new $.Event('keydown');
    enter.which = 13;

    let typing = $('input').is(':focus');

    if (typing) {
        return;
    }

    switch (e.which) {

        // r
        case 82:
            if (e.ctrlKey) {
                e.preventDefault();
                if (e.shiftKey) {
                    $('#inputBar').val('default');
                } else {
                    $('#inputBar').val('random');
                }
                $('#inputBar').trigger(enter);
            } else {
                $('.randomize').trigger('click');
            }
            break;

        // i
        case 73:
            $('.toggleCanvasInfo').trigger('click');
            break;

        // x
        case 88:
            if (e.ctrlKey) {
                $('.clear').trigger('click');
            } else {
                $('.clearSelection').trigger('click');
            }
            break;

        // s
        case 83:
            if (e.ctrlKey) {
                if (e.shiftKey) {
                    $('.restoreState').trigger('click');
                } else {
                    e.preventDefault();
                    $('.captureState').trigger('click');
                }
            }
            break;

        // arrow up/down
        case 38:
        case 40:
            utils.incrementSlider('.toolSlider', e, 38);
            break;

        // arrow left/right
        case 39:
        case 37:
            utils.incrementSlider('.genStepSlider', e, 39);
            break;

        // tab
        case 9:
            e.preventDefault();
            $('.addRuleBox').trigger('click');
            break;

        // +/-
        case 107:
        case 109:
            utils.incrementSlider('.delaySlider', e, 107);
            break;

        // space
        case 32:
            e.preventDefault();
            $('.start').trigger('click');
            break;

        // v
        case 86:
            if (e.ctrlKey) {
                if (e.shiftKey) {
                    $('.loadPattern').trigger('click');
                } else {
                    $('.paste').trigger('click');
                }
            }
            break;

        // e
        case 69:
            $('.selectEraser').trigger('click');
            break;

        // p
        case 80:
            $('.selectPen').trigger('click');
            break;

        // c
        case 67:
            if (e.ctrlKey) {
                $('.copy').trigger('click');
            }
            break;

        // z
        case 90:
            if (e.ctrlKey) {
                e.preventDefault();
                $('.rewindOne').trigger('click');
            }
            break;
    }
});

// hold ctrl for selection or alt for zoom...
$(document).on('keydown.shortcuts', function (e) {
    let typing = $('input').is(':focus');

    if (typing) {
        return;
    }

    if (game.tools.current.name !== 'selector') {
        let clone = {};
        Object.assign(clone, game.tools.current);
        $(document).data('switchTool', clone);
    }

    if (e.ctrlKey && e.which === 17) {
        $('.selector').trigger('click');
    }

    if (!e.ctrlKey && e.which === 18) {
        $('.zoomIn').trigger('click');
    }
})

// ...switch back to original tool on keyup.
$(document).on('keyup.shortcuts', function (e) {
    let typing = $('input').is(':focus');

    if (typing) {
        return;
    }

    if (e.which === 17 || e.which === 18) {
        let switchTool = $(this).data('switchTool');
        $(`.${switchTool.type}`).trigger('click');
    }
});

// Enter defined seperately because it should (only) be usuable when inputs are in focus
$(document).on('keydown', function (e) {

    let inputBarFocused = $('#inputBar').is(':focus');
    let styleInputFocused = $('.colorSchemeSetting').is(':focus');

    let focused = $('input').is(':focus');

    if (e.which === 13 && focused) {

        if (inputBarFocused) {

            let val = $('#inputBar').val();
            val = val === undefined ? '' : val;
            let parsed;

            try {
                parsed = utils.parseRulestring(val);
                if (game.clipBoard.boxCoords) {
                    $('.addRuleBox').trigger('click');
                    canvasFuncs.flashMsg(game.current, 'Rulebox Set', 30)
                } else {
                    utils.setRules(parsed, game.current);

                    // if the rule can be identically expressed as B/S notation, switch to B/S.
                    let isLtL = parsed.spread > 1 || parsed.includeCenter;
                    let selectedRuleFamily = $('#inputBar').attr('rule');
                    if (!isLtL && selectedRuleFamily === 'LtL') {
                        $('.toggleRuleType').trigger('click');
                    }

                    canvasFuncs.flashMsg(game.current, 'Rules Set', 30);
                }
            } catch (error) {
                console.error(error);
                canvasFuncs.flashMsg(game.current, 'Invalid Rulestring!', 30);
            }
        }

        if (styleInputFocused) {
            $('.applyStyle').trigger('click');
        }
        $('input').blur();
    }
});

// ------ Keyboard Shortcuts ------- //





/// ---------- Drag & Drop ------------ ///

// This can be done through jQuery, but jQuery events by default don't
// have the event.dataTransfer property. It can be fetched 
// with event.originalEvent.dataTransfer, but this is simpler.

function dropHandler(e) {
    e.preventDefault();

    for (let i = 0; i < e.dataTransfer.items.length; i++) {
        let file = e.dataTransfer.items[i].getAsFile();
        let fileName = file.name;
        let [patternName, fileType] = fileName.split('.');

        if (fileType === 'cells') {
            file.text().then(text => {
                let commentIndicator = '!';
                while (text.indexOf(commentIndicator) !== -1) {
                    let commentEnd = text.indexOf('\n');
                    text = text.slice(commentEnd + 1);
                }
                game.clipBoard.filePattern = text;
                patterns[patternName] = text;
                patterns.setLoadablePatterns();
                $('#patternSelection').val(patternName);
                canvasFuncs.flashMsg(game.current, 'Pattern Extracted', 30);
            });
        } else {
            canvasFuncs.flashMsg(game.current, 'Not a .cells file!', 30);
        }
    }
}

// must be set along with drop to prevent all default behavior.
function dragOverHandler(e) {
    e.preventDefault();
}

let element = document.getElementsByClassName('patternDrop')[0];

element.addEventListener('dragover', dragOverHandler, false);
element.addEventListener('drop', dropHandler, false);

/// ---------- Drag & Drop ------------ ///








/// ---------- General Styling ------------ ///


$('.toggleMenu').click(() => {
    $('.controlsContainer').toggleClass('hidden');
    $('.sliderInfo').css('opacity', '0');
    $('.slider').toggleClass('dnone');
    $('.canvasInfo').toggleClass('menuExpandedInfo');
});

$('.tool').click(function () {
    $('.tool').removeClass('activeTool');
    $(this).addClass('activeTool')
});

$('.tabSpan').click(function () {
    $('.tabSpan').removeClass('currentTab');
    $('.menu').removeClass('currentMenu');
    let targetMenu = $(this).attr('target');
    $(this).addClass('currentTab');
    $(`.${targetMenu}`).addClass('currentMenu');
})

$('.fa-question-circle').hover(function () {
        // over
        let tooltip = $(this).siblings('.tooltip');
        let tooltipShowing = tooltip.css('display') !== 'none';
    if (!tooltipShowing) {
        let inTransitions = {
            'z-index': '999',
            'opacity': '1',
        };
        utils.transitionIn(tooltip, inTransitions);
    }

}, function () {
    // out
    let tooltip = $(this).siblings('.tooltip');
    let tooltipShowing = tooltip.css('display') !== 'none';
    if (tooltipShowing) {
        let sticky = tooltip.hasClass('sticky');
        let stayingTime = sticky ? 1500 : 100;
        let outTransitions = {
            'z-index': '-1',
            'opacity': '0',
        };
        utils.transitionOut(tooltip, outTransitions, stayingTime);
        }
    }
);

$('#patternSelection').on('change', function(e) {
    let val = $(this).val();
    game.clipBoard.filePattern = patterns[val];
})


$('.toggleRuleType').on('click', function (e) {
    e.preventDefault();

    let LtLTooltip = `<div>
    <div> LtL rule following the notation : </div>
    <div class = 'notation' >
        Rr,Cc,Mm,Ss<sub>min</sub>..s<sub>max</sub>,Bb<sub>min</sub>..b<sub>max</sub>,Nn
    </div>

    <div>
    Where : <br>

    <ul>
      <li> <i><b>r</b></i> is the range of the neighbourhood</li>
      <li> <i><b>c</b></i> is the number of possible states </li>
      <li> <i><b>m</b></i> specifies if the center itself is a neighbour </li>
      <li> <i><b>s<sub>min</sub>..s<sub>max</sub></b></i> is the survival range </li>
      <li> <i><b>b<sub>min</sub>..b<sub>max</sub></b></i> is the birth range </li>
      <li> <i><b>n</b></i> specifies the neighbourhood type </li>
    </ul>

    </div>
    <div>In this editor, <i>Cc</i> may only indicate two states (<i><b>c</b></i> <= 2), and only Moore Neighbourhood is supported (<i>NM</i>). These values are assumed and can be omitted.</div>
    <a href = 'https://www.conwaylife.com/wiki/Larger_than_Life#Notation' target="_blank" >https://www.conwaylife.com/wiki/Larger_than_Life#Notation</a>
    `

    let BSTooltip = `<div>
    <div>A B/S notation Rulestring to use.</div>
    <a href="https://www.conwaylife.com/wiki/Rulestring" target="_blank">https://www.conwaylife.com/wiki/Rulestring</a> 
    </div>`

    let ruleSpan = $(this).children('span');
    let ruleSpanTxt = ruleSpan.text();
    let toggled = ruleSpanTxt === 'LtL' ? 'B/S' : 'LtL';
    let tooltip = toggled === 'LtL' ? LtLTooltip : BSTooltip;
    ruleSpan.text(toggled);
    $('.rulestringDiv .tooltip').html(tooltip);
    $('#inputBar').attr('rule', toggled);

    utils.setLoadableRulePresets(toggled, game.current);

    //select and apply the default (first) rule of the rule family
    let firstOptionVal = $('#ruleSelect').children('option').val();
    $('#ruleSelect').val(firstOptionVal).trigger('change');

});

$('#ruleSelect').on('change', function (e) {
    let val = $(this).val();
    $('#inputBar').val(val);
    let enter = new $.Event('keydown');
    enter.which = 13;
    $('#inputBar').focus();
    $('#inputBar').trigger(enter);
    $('#ruleSelect').blur();
});

/// ---------- general styling ------------ ///








/// ---------- sliders ------------ ///

let sliderInTransitions = {
    'z-index' : '999',
    'opacity' : '1'
};
let sliderOutTransitions = {
    'z-index' : '-1',
    'opacity' : '0'
};

function sliderHandler(sliderKnob, slider, e) {
    utils.transitionIn(sliderKnob.siblings('.sliderInfo'), sliderInTransitions, false);


    // get x coords relative to slider.
     // e.offsetX is not used because it grabs the offset relative to
     // the current event element (which can be the slider button, for example).
    let x = e.pageX - slider.offset().left;
    let sliderWidth = parseInt(slider.css('width'));

    sliderWidth = sliderWidth <= 10 ? 500 : sliderWidth;

    console.log(sliderWidth);

    x = x > sliderWidth ? sliderWidth : x < 0 ? 0 : x;

    let step = parseInt(slider.attr('step'), 10);

    let maxVal = parseInt(slider.attr('max')),
        minVal = parseInt(slider.attr('min'));

    // how many steps are possible
    let numOfVals = Math.round(maxVal / step);
    // the length of one step represented on the slider.
    let sectionLen = sliderWidth / numOfVals;

    // how many steps the x coord is based on its length
    let val = Math.round(x / sectionLen) * step;
    val = val >= maxVal ? maxVal : val <= minVal ? minVal : val;

    // update/display value
    slider.attr('value', val);
    let propToUpdate = slider.attr('property');

    if (propToUpdate) {
        game.current.settings[propToUpdate] = val;
    }

    let unit = slider.attr('unit');
    unit = unit ? unit : '';

    if (slider.hasClass('boardSizeSlider')) {
        unit = `x${Math.floor(val/2)} ${unit}`;
    }

    slider.find('.sliderInfoBox').text(`${val}${unit}`);

    slider.find('.sliderInfoTriangle').css('left', x);
    slider.find('.sliderInfoBox').css('left', x - 20);
    slider.find('.sliderKnob').css('left', x);
    slider.find('.valueFill').css('width', x);
}

$('.sliderKnob').on('mousedown', function (e) {
    $('body').css('cursor', 'grabbing');
    $(this).css('cursor', 'grabbing');

    e.preventDefault();

    let sliderKnob = $(this);
    let slider = sliderKnob.parents('.slider');

    let sliderVal = $(this).parents('.slider').attr('value');
    $(this).find('.sliderInfoBox').text(`${sliderVal}%`)

    $('body').on('mousemove', function (e1) {
        sliderHandler(sliderKnob, slider, e1);
    });

    $('body').on('mouseup', function () {
        $('.sliderKnob').css('cursor', 'grab');
        $('body').css('cursor', 'initial');

        $('body').off('mousemove');
        slider.find('.sliderInfo').css('z-index', '-1');

        slider.find('.sliderInfo').css('opacity', '0');

        utils.transitionOut(slider.find('.sliderInfo'), sliderOutTransitions, 300, false);

    });
});

$('.slider').hover(function () {
    let val = $(this).attr('value');
    let unit = $(this).attr('unit');
    if ($(this).hasClass('boardSizeSlider')) {
        unit = `x${Math.floor(val/2)} ${unit}`;
    }
    $(this).find('.sliderInfoBox').text(`${val}${unit}`)

    utils.transitionIn($(this).find('.sliderInfo'), sliderInTransitions, false);
}, function () {

    utils.transitionOut( $(this).find('.sliderInfo'), sliderOutTransitions, 300 ,false);
}
);

$('.slider').on('click', function (e) {
    let sliderKnob = $(this).find('.sliderKnob');
    let slider = $(this);
    sliderHandler(sliderKnob, slider, e);
})

$('body').on('mousedown keydown', function () {
    $('.sliderInfo').css('opacity', '0');
});

$('.toggleMenuTransparency').on('click', function () {
    let transparent = game.current.settings.menuTransparent;
    let controlsContainer = $('.controlsContainer');
    if (transparent) {
        controlsContainer.css({
            'background-color': 'rgba(255, 255, 255, 0.25)',  
            'backdrop-filter': 'blur(3px)'
        })
    } else {
        controlsContainer.css({
            'background-color': 'rgba(255, 255, 255, 1)',  
            'backdrop-filter': 'none'
        })
    }
})

/// ---------- sliders ------------ ///


// height and width must be set through attributes to avoid problems.

let cW = $('.canvasContainer').css('width');
let cH = $('.canvasContainer').css('height');

$(window).on('resize', function () {
    cW = $('.canvasContainer').css('width');
    cH = $('.canvasContainer').css('height');
    $('#drawCanvas').attr('width', cW);
    $('#drawCanvas').attr('height', cH);
    $('#touchCanvas').attr('width', cW);
    $('#touchCanvas').attr('height', cH);
    utils.resetZoom(game.current, true);
});


$(document).ready(function () {
    console.log('--- Document Ready ---');
    $('#drawCanvas').attr('width', cW);
    $('#drawCanvas').attr('height', cH);
    $('#touchCanvas').attr('width', cW);
    $('#touchCanvas').attr('height', cH);
    utils.changeTool('pen', game, 'draw');
    $('.applyStyle').trigger('click')
    $('.showWelcome').trigger('click');
    utils.setLoadableRulePresets('B/S', game.current);
    utils.initializeSliders();
    patterns.setLoadablePatterns();
    canvasFuncs.applySettings(game.current);
    utils.resetZoom(game.current, true);
});
