"use strict";

/* ============================================================
   MODEL SETTINGS
============================================================ */

const N_AGENTS = 20;
const ROUNDS_PER_ITERATION = 20;
const GAMMA = 1.0;

const BASELINE = "#c06082";
const BASELINE_DARK = "#994662";

const HYBRID = "#7b6fd6";
const HYBRID_DARK = "#594db4";


// Prisoner's Dilemma
// 0 = cooperate
// 1 = defect

const REWARD_1 = [
    [3, 0],
    [5, 1]
];

const REWARD_2 = [
    [3, 5],
    [0, 1]
];


/* ============================================================
   RANDOM NUMBER GENERATOR
============================================================ */

function seededRandom(seed) {

    return function () {

        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;

        let t = seed;

        t = Math.imul(
            t ^ (t >>> 15),
            t | 1
        );

        t ^= t + Math.imul(
            t ^ (t >>> 7),
            t | 61
        );

        return (
            (t ^ (t >>> 14)) >>> 0
        ) / 4294967296;
    };
}


/* ============================================================
   BASIC HELPERS
============================================================ */

function stateToIndex(state) {

    if (state === 0) return 0;
    if (state === 1) return 1;
    if (state === 100) return 2;

    return 3;
}


function shuffle(array, rng) {

    const result = array.slice();

    for (let i = result.length - 1; i > 0; i--) {

        const j = Math.floor(
            rng() * (i + 1)
        );

        const temp = result[i];

        result[i] = result[j];
        result[j] = temp;
    }

    return result;
}


function formatPercent(value) {

    return (value * 100).toFixed(1) + "%";
}


/* ============================================================
   Q TABLE
============================================================ */

function createQTable() {

    return Array.from(
        { length: N_AGENTS },
        () =>
            Array.from(
                { length: 4 },
                () => [0, 0]
            )
    );
}


/* ============================================================
   ACTION SELECTION

   Mirrors the supplied dissertation implementation:
       exp(tau * Q)
============================================================ */

function selectAction(
    Q,
    agent,
    state,
    tau,
    rng
) {

    const si = stateToIndex(state);

    const q0 =
        tau * Q[agent][si][0];

    const q1 =
        tau * Q[agent][si][1];

    const maxQ = Math.max(q0, q1);

    const e0 =
        Math.exp(q0 - maxQ);

    const e1 =
        Math.exp(q1 - maxQ);

    const p0 =
        e0 / (e0 + e1);

    return rng() < p0 ? 0 : 1;
}


/* ============================================================
   RANDOM PAIRING
============================================================ */

function randomPairsFromIds(ids, rng) {

    const ordered =
        shuffle(ids, rng);

    const pairs = [];

    for (
        let i = 0;
        i + 1 < ordered.length;
        i += 2
    ) {

        pairs.push([
            ordered[i],
            ordered[i + 1]
        ]);
    }

    return pairs;
}


function randomPairs(count, rng) {

    const ids =
        Array.from(
            { length: count },
            (_, i) => i
        );

    return randomPairsFromIds(
        ids,
        rng
    );
}


/* ============================================================
   ASSORTATIVE PAIRING

   Previous cooperators preferentially pair together.
   Previous defectors preferentially pair together.
============================================================ */

function assortativePairs(
    ids,
    actionsPD,
    rng
) {

    const cooperators = [];
    const defectors = [];

    for (const id of ids) {

        if (actionsPD[id] === 0) {
            cooperators.push(id);
        } else {
            defectors.push(id);
        }
    }


    const C = shuffle(cooperators, rng);
    const D = shuffle(defectors, rng);

    const pairs = [];
    const leftovers = [];


    let i = 0;

    while (i + 1 < C.length) {

        pairs.push([
            C[i],
            C[i + 1]
        ]);

        i += 2;
    }

    if (i < C.length) {
        leftovers.push(C[i]);
    }


    i = 0;

    while (i + 1 < D.length) {

        pairs.push([
            D[i],
            D[i + 1]
        ]);

        i += 2;
    }

    if (i < D.length) {
        leftovers.push(D[i]);
    }


    if (leftovers.length >= 2) {

        pairs.push([
            leftovers[0],
            leftovers[1]
        ]);
    }


    return pairs;
}


/* ============================================================
   MEMORY
============================================================ */

function createMemory() {

    return Array.from(
        { length: N_AGENTS },
        () => []
    );
}


function storeExperience(
    memory,
    agent,
    state,
    action,
    reward
) {

    memory[agent].push({
        state: state,
        action: action,
        reward: reward
    });
}


/* ============================================================
   Q UPDATE

   Same backward-return update as Python code.
============================================================ */

function updateQValues(
    Q,
    memory,
    learningRate
) {

    for (
        let agent = 0;
        agent < N_AGENTS;
        agent++
    ) {

        let running = 0;

        const experiences =
            memory[agent];

        for (
            let k = experiences.length - 1;
            k >= 0;
            k--
        ) {

            const e =
                experiences[k];

            running =
                e.reward +
                GAMMA * running;

            const si =
                stateToIndex(e.state);

            Q[agent][si][e.action] =
                (1 - learningRate)
                *
                Q[agent][si][e.action]
                +
                learningRate
                *
                running;
        }

        memory[agent] = [];
    }
}


/* ============================================================
   MODEL
============================================================ */

class Model {

    constructor(type) {

        this.type = type;

        this.reset();
    }


    reset() {

        this.rng =
            seededRandom(1235);

        this.Q =
            createQTable();

        this.memory =
            createMemory();

        this.actionsPD =
            Array.from(
                { length: N_AGENTS },
                () =>
                    this.rng() < 0.5
                    ? 0
                    : 1
            );

        this.groups =
            randomPairs(
                N_AGENTS,
                this.rng
            );

        this.iteration = 0;

        this.cooperation = 0;

        this.switchRate =
            this.type === "baseline"
            ? 1
            : 0;

        this.positions =
            Array.from(
                { length: N_AGENTS },
                () => ({
                    x: 0.5,
                    y: 0.5
                })
            );

        this.targets =
            Array.from(
                { length: N_AGENTS },
                () => ({
                    x: 0.5,
                    y: 0.5
                })
            );

        assignPairTargets(this);

        for (
            let i = 0;
            i < N_AGENTS;
            i++
        ) {

            this.positions[i].x =
                this.targets[i].x;

            this.positions[i].y =
                this.targets[i].y;
        }
    }


    /* ========================================================
       BASELINE REMATCHING
    ======================================================== */

    baselineRematch(m) {

        const ids =
            Array.from(
                { length: N_AGENTS },
                (_, i) => i
            );

        if (this.rng() < m) {

            this.groups =
                assortativePairs(
                    ids,
                    this.actionsPD,
                    this.rng
                );

        } else {

            this.groups =
                randomPairsFromIds(
                    ids,
                    this.rng
                );
        }
    }


    /* ========================================================
       HYBRID PARTNER RETENTION
    ======================================================== */

    hybridRematch(m, tau) {

        const stayingPairs = [];
        const switchingAgents = [];

        let switchCount = 0;


        for (const pair of this.groups) {

            const i = pair[0];
            const j = pair[1];


            const stateI =
                this.actionsPD[j];

            const stateJ =
                this.actionsPD[i];


            const actionI =
                selectAction(
                    this.Q,
                    i,
                    stateI,
                    tau,
                    this.rng
                );

            const actionJ =
                selectAction(
                    this.Q,
                    j,
                    stateJ,
                    tau,
                    this.rng
                );


            storeExperience(
                this.memory,
                i,
                stateI,
                actionI,
                0
            );

            storeExperience(
                this.memory,
                j,
                stateJ,
                actionJ,
                0
            );


            switchCount +=
                actionI + actionJ;


            /*
                Both must choose stay.
            */

            if (
                actionI === 0 &&
                actionJ === 0
            ) {

                stayingPairs.push([
                    i,
                    j
                ]);

            } else {

                switchingAgents.push(i);
                switchingAgents.push(j);
            }
        }


        let rematched = [];


        if (switchingAgents.length > 0) {

            if (this.rng() < m) {

                rematched =
                    assortativePairs(
                        switchingAgents,
                        this.actionsPD,
                        this.rng
                    );

            } else {

                rematched =
                    randomPairsFromIds(
                        switchingAgents,
                        this.rng
                    );
            }
        }


        this.groups = [
            ...stayingPairs,
            ...rematched
        ];


        return (
            switchCount /
            N_AGENTS
        );
    }


    /* ========================================================
       ONE ITERATION
    ======================================================== */

    step(
        m,
        learningRate,
        tau
    ) {

        let CC = 0;
        let CD = 0;
        let DC = 0;
        let DD = 0;

        let switchSum = 0;


        for (
            let round = 0;
            round < ROUNDS_PER_ITERATION;
            round++
        ) {

            /*
                Relationship stage
            */

            if (this.type === "baseline") {

                this.baselineRematch(m);

                switchSum += 1;

            } else {

                switchSum +=
                    this.hybridRematch(
                        m,
                        tau
                    );
            }


            /*
                PD interaction
            */

            for (const pair of this.groups) {

                const a = pair[0];
                const b = pair[1];


                const previousA =
                    this.actionsPD[a];

                const previousB =
                    this.actionsPD[b];


                const stateA =
                    100 + previousB;

                const stateB =
                    100 + previousA;


                const actionA =
                    selectAction(
                        this.Q,
                        a,
                        stateA,
                        tau,
                        this.rng
                    );

                const actionB =
                    selectAction(
                        this.Q,
                        b,
                        stateB,
                        tau,
                        this.rng
                    );


                const rewardA =
                    REWARD_1
                    [actionA]
                    [actionB];

                const rewardB =
                    REWARD_2
                    [actionA]
                    [actionB];


                storeExperience(
                    this.memory,
                    a,
                    stateA,
                    actionA,
                    rewardA
                );

                storeExperience(
                    this.memory,
                    b,
                    stateB,
                    actionB,
                    rewardB
                );


                if (
                    actionA === 0 &&
                    actionB === 0
                ) {

                    CC++;

                } else if (
                    actionA === 0 &&
                    actionB === 1
                ) {

                    CD++;

                } else if (
                    actionA === 1 &&
                    actionB === 0
                ) {

                    DC++;

                } else {

                    DD++;
                }


                this.actionsPD[a] =
                    actionA;

                this.actionsPD[b] =
                    actionB;
            }
        }


        updateQValues(
            this.Q,
            this.memory,
            learningRate
        );


        const games =
            CC + CD + DC + DD;


        if (games > 0) {

            this.cooperation =
                (
                    2 * CC +
                    CD +
                    DC
                )
                /
                (
                    2 * games
                );

        } else {

            this.cooperation = 0;
        }


        this.switchRate =
            switchSum /
            ROUNDS_PER_ITERATION;


        this.iteration++;


        assignPairTargets(this);
    }


    cooperatorCount() {

        let count = 0;

        for (
            const action of
            this.actionsPD
        ) {

            if (action === 0) {
                count++;
            }
        }

        return count;
    }
}


/* ============================================================
   VISUAL PAIR POSITIONS
============================================================ */

function assignPairTargets(model) {

    const slots = [

        { x: 0.25, y: 0.16 },
        { x: 0.75, y: 0.16 },

        { x: 0.25, y: 0.33 },
        { x: 0.75, y: 0.33 },

        { x: 0.25, y: 0.50 },
        { x: 0.75, y: 0.50 },

        { x: 0.25, y: 0.67 },
        { x: 0.75, y: 0.67 },

        { x: 0.25, y: 0.84 },
        { x: 0.75, y: 0.84 }

    ];


    model.groups.forEach(
        (pair, index) => {

            const slot =
                slots[index];

            if (!slot) return;


            model.targets[pair[0]] = {
                x: slot.x - 0.06,
                y: slot.y
            };

            model.targets[pair[1]] = {
                x: slot.x + 0.06,
                y: slot.y
            };
        }
    );
}


/* ============================================================
   CANVAS RESIZING
============================================================ */

function resizeCanvas(canvas) {

    const rect =
        canvas.getBoundingClientRect();

    const ratio =
        window.devicePixelRatio || 1;


    canvas.width =
        Math.max(
            1,
            Math.floor(
                rect.width * ratio
            )
        );

    canvas.height =
        Math.max(
            1,
            Math.floor(
                rect.height * ratio
            )
        );


    const ctx =
        canvas.getContext("2d");


    ctx.setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0
    );


    return {
        ctx,
        width: rect.width,
        height: rect.height
    };
}


/* ============================================================
   MANUAL ROUNDED RECTANGLE

   Avoids ctx.roundRect browser compatibility problems.
============================================================ */

function drawRoundedRect(
    ctx,
    x,
    y,
    width,
    height,
    radius
) {

    const r =
        Math.min(
            radius,
            width / 2,
            height / 2
        );


    ctx.beginPath();

    ctx.moveTo(
        x + r,
        y
    );

    ctx.lineTo(
        x + width - r,
        y
    );

    ctx.quadraticCurveTo(
        x + width,
        y,
        x + width,
        y + r
    );

    ctx.lineTo(
        x + width,
        y + height - r
    );

    ctx.quadraticCurveTo(
        x + width,
        y + height,
        x + width - r,
        y + height
    );

    ctx.lineTo(
        x + r,
        y + height
    );

    ctx.quadraticCurveTo(
        x,
        y + height,
        x,
        y + height - r
    );

    ctx.lineTo(
        x,
        y + r
    );

    ctx.quadraticCurveTo(
        x,
        y,
        x + r,
        y
    );

    ctx.closePath();
}


/* ============================================================
   POSITION ANIMATION
============================================================ */

function animatePositions(model) {

    for (
        let i = 0;
        i < N_AGENTS;
        i++
    ) {

        model.positions[i].x +=
            (
                model.targets[i].x -
                model.positions[i].x
            ) * 0.12;

        model.positions[i].y +=
            (
                model.targets[i].y -
                model.positions[i].y
            ) * 0.12;
    }
}


/* ============================================================
   DRAW MODEL
============================================================ */

function drawModel(
    canvas,
    model,
    colour,
    darkColour
) {

    const size =
        resizeCanvas(canvas);

    const ctx =
        size.ctx;

    const width =
        size.width;

    const height =
        size.height;


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    animatePositions(model);


    /*
        10 partnership slots
    */

    const slotYs = [
        0.16,
        0.33,
        0.50,
        0.67,
        0.84
    ];


    ctx.lineWidth = 1;

    ctx.strokeStyle =
        "rgba(70, 65, 80, 0.09)";


    for (const y of slotYs) {

        for (const x of [0.25, 0.75]) {

            const boxWidth =
                width * 0.34;

            const boxHeight =
                62;

            const bx =
                x * width -
                boxWidth / 2;

            const by =
                y * height -
                boxHeight / 2;


            drawRoundedRect(
                ctx,
                bx,
                by,
                boxWidth,
                boxHeight,
                12
            );

            ctx.stroke();
        }
    }


    /*
        Partnership lines
    */

    for (const pair of model.groups) {

        const p1 =
            model.positions[
                pair[0]
            ];

        const p2 =
            model.positions[
                pair[1]
            ];


        ctx.beginPath();

        ctx.moveTo(
            p1.x * width,
            p1.y * height
        );

        ctx.lineTo(
            p2.x * width,
            p2.y * height
        );

        ctx.strokeStyle =
            colour;

        ctx.globalAlpha =
            0.55;

        ctx.lineWidth =
            4;

        ctx.stroke();

        ctx.globalAlpha =
            1;
    }


    /*
        Draw 20 agents
    */

    for (
        let agent = 0;
        agent < N_AGENTS;
        agent++
    ) {

        const position =
            model.positions[agent];


        const x =
            position.x * width;

        const y =
            position.y * height;


        const cooperating =
            model.actionsPD[agent] === 0;


        /*
            Shadow
        */

        ctx.beginPath();

        ctx.arc(
            x,
            y + 3,
            22,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "rgba(30, 25, 40, 0.10)";

        ctx.fill();


        /*
            Agent node
        */

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            21,
            0,
            Math.PI * 2
        );


        ctx.fillStyle =
            cooperating
            ? colour
            : "#ffffff";

        ctx.fill();


        ctx.strokeStyle =
            darkColour;

        ctx.lineWidth =
            3;

        ctx.stroke();


        /*
            C / D
        */

        ctx.fillStyle =
            cooperating
            ? "#ffffff"
            : darkColour;

        ctx.font =
            "bold 13px Arial";

        ctx.textAlign =
            "center";

        ctx.textBaseline =
            "middle";

        ctx.fillText(
            cooperating
            ? "C"
            : "D",
            x,
            y
        );


        /*
            Agent number
        */

        ctx.fillStyle =
            "#8f8b96";

        ctx.font =
            "10px Arial";

        ctx.fillText(
            String(agent + 1),
            x,
            y + 35
        );
    }
}


/* ============================================================
   CREATE MODELS
============================================================ */

const baselineModel =
    new Model("baseline");

const hybridModel =
    new Model("hybrid");


/* ============================================================
   DOM ELEMENTS
============================================================ */

const baselineCanvas =
    document.getElementById(
        "baselineCanvas"
    );

const hybridCanvas =
    document.getElementById(
        "hybridCanvas"
    );


const mSlider =
    document.getElementById(
        "mSlider"
    );

const alphaSlider =
    document.getElementById(
        "alphaSlider"
    );

const tauSlider =
    document.getElementById(
        "tauSlider"
    );

const speedSlider =
    document.getElementById(
        "speedSlider"
    );


const mValue =
    document.getElementById(
        "mValue"
    );

const alphaValue =
    document.getElementById(
        "alphaValue"
    );

const tauValue =
    document.getElementById(
        "tauValue"
    );

const speedValue =
    document.getElementById(
        "speedValue"
    );


const runButton =
    document.getElementById(
        "runButton"
    );

const pauseButton =
    document.getElementById(
        "pauseButton"
    );

const resetButton =
    document.getElementById(
        "resetButton"
    );

const statusElement =
    document.getElementById(
        "status"
    );


/* ============================================================
   UPDATE TEXT
============================================================ */

function updateMetrics() {

    document.getElementById(
        "baselineIteration"
    ).textContent =
        baselineModel.iteration;


    document.getElementById(
        "hybridIteration"
    ).textContent =
        hybridModel.iteration;


    document.getElementById(
        "baselineCooperation"
    ).textContent =
        baselineModel.iteration === 0
        ? "—"
        : formatPercent(
            baselineModel.cooperation
        );


    document.getElementById(
        "hybridCooperation"
    ).textContent =
        hybridModel.iteration === 0
        ? "—"
        : formatPercent(
            hybridModel.cooperation
        );


    document.getElementById(
        "baselineCooperators"
    ).textContent =
        baselineModel.cooperatorCount()
        + " / 20";


    document.getElementById(
        "hybridCooperators"
    ).textContent =
        hybridModel.cooperatorCount()
        + " / 20";


    document.getElementById(
        "hybridSwitching"
    ).textContent =
        hybridModel.iteration === 0
        ? "—"
        : formatPercent(
            hybridModel.switchRate
        );
}


/* ============================================================
   RENDER LOOP
============================================================ */

function render() {

    drawModel(
        baselineCanvas,
        baselineModel,
        BASELINE,
        BASELINE_DARK
    );


    drawModel(
        hybridCanvas,
        hybridModel,
        HYBRID,
        HYBRID_DARK
    );


    updateMetrics();
}


function visualLoop() {

    render();

    window.requestAnimationFrame(
        visualLoop
    );
}


window.requestAnimationFrame(
    visualLoop
);


/* ============================================================
   SIMULATION LOOP
============================================================ */

let running = false;
let timer = null;


function simulationTick() {

    if (!running) {
        return;
    }


    const m =
        Number(
            mSlider.value
        );

    const alpha =
        Number(
            alphaSlider.value
        );

    const tau =
        Number(
            tauSlider.value
        );

    const speed =
        Number(
            speedSlider.value
        );


    const iterationsPerTick =
        Math.max(
            1,
            Math.ceil(
                speed / 4
            )
        );


    for (
        let i = 0;
        i <
        iterationsPerTick;
        i++
    ) {

        baselineModel.step(
            m,
            alpha,
            tau
        );

        hybridModel.step(
            m,
            alpha,
            tau
        );
    }


    const delay =
        Math.max(
            80,
            600 -
            speed * 20
        );


    timer =
        window.setTimeout(
            simulationTick,
            delay
        );
}


/* ============================================================
   RUN
============================================================ */

runButton.addEventListener(
    "click",
    function () {

        if (running) {
            return;
        }

        running = true;

        runButton.disabled =
            true;

        pauseButton.disabled =
            false;


        statusElement.textContent =
            "Running";

        statusElement.classList.add(
            "running"
        );


        simulationTick();
    }
);


/* ============================================================
   PAUSE
============================================================ */

pauseButton.addEventListener(
    "click",
    function () {

        running = false;


        if (timer !== null) {

            clearTimeout(timer);

            timer = null;
        }


        runButton.disabled =
            false;

        pauseButton.disabled =
            true;


        statusElement.textContent =
            "Paused";

        statusElement.classList.remove(
            "running"
        );
    }
);


/* ============================================================
   RESET
============================================================ */

resetButton.addEventListener(
    "click",
    function () {

        running = false;


        if (timer !== null) {

            clearTimeout(timer);

            timer = null;
        }


        baselineModel.reset();
        hybridModel.reset();


        runButton.disabled =
            false;

        pauseButton.disabled =
            true;


        statusElement.textContent =
            "Ready";

        statusElement.classList.remove(
            "running"
        );


        render();
    }
);


/* ============================================================
   SLIDERS
============================================================ */

mSlider.addEventListener(
    "input",
    function () {

        mValue.textContent =
            Number(
                mSlider.value
            ).toFixed(2);
    }
);


alphaSlider.addEventListener(
    "input",
    function () {

        alphaValue.textContent =
            Number(
                alphaSlider.value
            ).toFixed(2);
    }
);


tauSlider.addEventListener(
    "input",
    function () {

        tauValue.textContent =
            Number(
                tauSlider.value
            ).toFixed(2);
    }
);


speedSlider.addEventListener(
    "input",
    function () {

        speedValue.textContent =
            speedSlider.value +
            "×";
    }
);


/* ============================================================
   START
============================================================ */

render();

console.log(
    "Dissertation simulation loaded successfully."
);