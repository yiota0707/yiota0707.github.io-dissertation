"use strict";

/* ============================================================
   DISSERTATION CONFIGURATION
============================================================ */

const N_AGENTS = 20;
const ROUNDS_PER_ITERATION = 20;
const GAMMA = 1.0;

const BASELINE = "#c06082";
const BASELINE_DARK = "#994662";

const HYBRID = "#7b6fd6";
const HYBRID_DARK = "#594db4";


/*
    Prisoner's Dilemma reward matrices.

    action 0 = Cooperate
    action 1 = Defect
*/

const REWARD_1 = [
    [3, 0],
    [5, 1]
];

const REWARD_2 = [
    [3, 5],
    [0, 1]
];


/* ============================================================
   SEEDED RANDOMNESS
============================================================ */

function seededRandom(seed) {

    return function () {

        seed |= 0;

        seed =
            seed + 0x6D2B79F5 | 0;

        let t = seed;

        t =
            Math.imul(
                t ^ t >>> 15,
                t | 1
            );

        t ^=
            t +
            Math.imul(
                t ^ t >>> 7,
                t | 61
            );

        return (
            (
                t ^ t >>> 14
            ) >>> 0
        ) / 4294967296;
    };
}


/* ============================================================
   GENERAL HELPERS
============================================================ */

function stateToIndex(state) {

    if (state === 0) {
        return 0;
    }

    if (state === 1) {
        return 1;
    }

    if (state === 100) {
        return 2;
    }

    return 3;
}


function shuffle(array, rng) {

    const result =
        array.slice();

    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                rng() *
                (i + 1)
            );

        [
            result[i],
            result[j]
        ]
        =
        [
            result[j],
            result[i]
        ];
    }

    return result;
}


function formatPercent(value) {

    return (
        value * 100
    ).toFixed(1) + "%";
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
   BOLTZMANN ACTION SELECTION

   This intentionally mirrors the supplied Python implementation:

       q0 = tau * Q
       q1 = tau * Q

============================================================ */

function selectAction(
    Q,
    agent,
    state,
    tau,
    rng
) {

    const si =
        stateToIndex(state);

    const q0 =
        tau *
        Q[agent][si][0];

    const q1 =
        tau *
        Q[agent][si][1];

    const maxQ =
        Math.max(q0, q1);

    const e0 =
        Math.exp(q0 - maxQ);

    const e1 =
        Math.exp(q1 - maxQ);

    const pCooperate =
        e0 /
        (e0 + e1);

    return (
        rng() <
        pCooperate
    )
        ? 0
        : 1;
}


/* ============================================================
   RANDOM PAIRING
============================================================ */

function randomPairsFromIds(
    ids,
    rng
) {

    const ordered =
        shuffle(ids, rng);

    const pairs = [];

    for (
        let i = 0;
        i + 1 < ordered.length;
        i += 2
    ) {

        pairs.push(
            [
                ordered[i],
                ordered[i + 1]
            ]
        );
    }

    return pairs;
}


function randomPairs(
    count,
    rng
) {

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

   Previous C agents are preferentially paired with C.
   Previous D agents are preferentially paired with D.

============================================================ */

function assortativePairs(
    ids,
    actionsPD,
    rng
) {

    const cooperators = [];
    const defectors = [];


    for (
        const id of ids
    ) {

        if (
            actionsPD[id] === 0
        ) {

            cooperators.push(id);

        } else {

            defectors.push(id);
        }
    }


    const C =
        shuffle(
            cooperators,
            rng
        );

    const D =
        shuffle(
            defectors,
            rng
        );


    const pairs = [];
    const leftovers = [];


    /* Cooperators */

    let i = 0;

    while (
        i + 1 < C.length
    ) {

        pairs.push(
            [
                C[i],
                C[i + 1]
            ]
        );

        i += 2;
    }


    if (
        i < C.length
    ) {

        leftovers.push(
            C[i]
        );
    }


    /* Defectors */

    i = 0;

    while (
        i + 1 < D.length
    ) {

        pairs.push(
            [
                D[i],
                D[i + 1]
            ]
        );

        i += 2;
    }


    if (
        i < D.length
    ) {

        leftovers.push(
            D[i]
        );
    }


    /*
        If one C and one D are left,
        they are paired together.
    */

    const leftoverPairs =
        randomPairsFromIds(
            leftovers,
            rng
        );


    pairs.push(
        ...leftoverPairs
    );


    return pairs;
}


/* ============================================================
   EXPERIENCE MEMORY
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

    memory[agent].push(
        {
            state,
            action,
            reward
        }
    );
}


/* ============================================================
   BACKWARD RETURN Q UPDATE

   running = reward + gamma * running

   Q = (1-alpha)Q + alpha * running

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
            let k =
                experiences.length - 1;
            k >= 0;
            k--
        ) {

            const e =
                experiences[k];


            running =
                e.reward +
                GAMMA *
                running;


            const si =
                stateToIndex(
                    e.state
                );


            Q[agent][si][e.action]
                =
                (
                    1 -
                    learningRate
                )
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

        /*
            Same deterministic starting seed
            for visual comparability.
        */

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
                    (
                        this.rng() <
                        0.5
                    )
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
            this.type ===
            "baseline"
                ? 1
                : 0;


        /*
            Smooth animation positions.
        */

        this.positions =
            Array.from(
                { length: N_AGENTS },
                () => ({
                    x: 0,
                    y: 0
                })
            );


        this.targets =
            Array.from(
                { length: N_AGENTS },
                () => ({
                    x: 0,
                    y: 0
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
       BASELINE REMATCH
    ======================================================== */

    baselineRematch(m) {

        const ids =
            Array.from(
                { length: N_AGENTS },
                (_, i) => i
            );


        if (
            this.rng() < m
        ) {

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
       HYBRID STAY/SWITCH + REMATCH
    ======================================================== */

    hybridRematch(
        m,
        tau
    ) {

        const stayingPairs = [];

        const switchingAgents = [];

        let switchCount = 0;


        for (
            const pair of this.groups
        ) {

            const i = pair[0];
            const j = pair[1];


            /*
                Switching state:
                partner's previous PD action.
            */

            const stateI =
                this.actionsPD[j];

            const stateJ =
                this.actionsPD[i];


            const switchI =
                selectAction(
                    this.Q,
                    i,
                    stateI,
                    tau,
                    this.rng
                );


            const switchJ =
                selectAction(
                    this.Q,
                    j,
                    stateJ,
                    tau,
                    this.rng
                );


            /*
                Switching experiences have
                zero immediate reward.
            */

            storeExperience(
                this.memory,
                i,
                stateI,
                switchI,
                0
            );


            storeExperience(
                this.memory,
                j,
                stateJ,
                switchJ,
                0
            );


            switchCount +=
                switchI +
                switchJ;


            /*
                Pair survives ONLY if
                both agents choose stay.
            */

            if (
                switchI === 0 &&
                switchJ === 0
            ) {

                stayingPairs.push(
                    [i, j]
                );

            } else {

                switchingAgents.push(i);
                switchingAgents.push(j);
            }
        }


        let newPairs = [];


        if (
            switchingAgents.length > 0
        ) {

            if (
                this.rng() < m
            ) {

                newPairs =
                    assortativePairs(
                        switchingAgents,
                        this.actionsPD,
                        this.rng
                    );

            } else {

                newPairs =
                    randomPairsFromIds(
                        switchingAgents,
                        this.rng
                    );
            }
        }


        this.groups = [
            ...stayingPairs,
            ...newPairs
        ];


        return (
            switchCount /
            N_AGENTS
        );
    }


    /* ========================================================
       ONE TRAINING ITERATION
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
            round <
            ROUNDS_PER_ITERATION;
            round++
        ) {

            /*
                Relationship stage.
            */

            if (
                this.type ===
                "baseline"
            ) {

                this.baselineRematch(
                    m
                );

                switchSum += 1;

            } else {

                switchSum +=
                    this.hybridRematch(
                        m,
                        tau
                    );
            }


            /*
                Prisoner's Dilemma stage.
            */

            for (
                const pair of
                this.groups
            ) {

                const a = pair[0];
                const b = pair[1];


                const previousA =
                    this.actionsPD[a];

                const previousB =
                    this.actionsPD[b];


                /*
                    PD state:

                    100 = partner previously C
                    101 = partner previously D
                */

                const stateA =
                    100 +
                    previousB;

                const stateB =
                    100 +
                    previousA;


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


        /*
            Exactly as in model:
            update after repeated game.
        */

        updateQValues(
            this.Q,
            this.memory,
            learningRate
        );


        const games =
            CC +
            CD +
            DC +
            DD;


        this.cooperation =
            games > 0
                ?
                (
                    2 * CC +
                    CD +
                    DC
                )
                /
                (
                    2 *
                    games
                )
                :
                0;


        this.switchRate =
            switchSum /
            ROUNDS_PER_ITERATION;


        this.iteration++;


        assignPairTargets(
            this
        );
    }


    cooperatorCount() {

        let total = 0;

        for (
            const action of
            this.actionsPD
        ) {

            if (
                action === 0
            ) {
                total++;
            }
        }

        return total;
    }
}


/* ============================================================
   PAIR DISPLAY LAYOUT

   Each current partnership occupies a visible slot.

   This is what makes rematching obvious:
   agents physically move into different pair positions.
============================================================ */

function assignPairTargets(model) {

    /*
        10 partnership slots:
        2 columns × 5 rows.
    */

    const pairSlots = [

        { x: 0.25, y: 0.15 },
        { x: 0.75, y: 0.15 },

        { x: 0.25, y: 0.32 },
        { x: 0.75, y: 0.32 },

        { x: 0.25, y: 0.49 },
        { x: 0.75, y: 0.49 },

        { x: 0.25, y: 0.66 },
        { x: 0.75, y: 0.66 },

        { x: 0.25, y: 0.83 },
        { x: 0.75, y: 0.83 }

    ];


    model.groups.forEach(
        (pair, index) => {

            const slot =
                pairSlots[index];


            if (!slot) {
                return;
            }


            /*
                Both partners shown close together.
            */

            model.targets[
                pair[0]
            ] = {

                x:
                    slot.x -
                    0.055,

                y:
                    slot.y

            };


            model.targets[
                pair[1]
            ] = {

                x:
                    slot.x +
                    0.055,

                y:
                    slot.y

            };
        }
    );
}


/* ============================================================
   CANVAS DRAWING
============================================================ */

function resizeCanvas(canvas) {

    const rect =
        canvas.getBoundingClientRect();

    const scale =
        window.devicePixelRatio ||
        1;


    if (
        canvas.width !==
        Math.floor(
            rect.width *
            scale
        )
        ||
        canvas.height !==
        Math.floor(
            rect.height *
            scale
        )
    ) {

        canvas.width =
            Math.floor(
                rect.width *
                scale
            );

        canvas.height =
            Math.floor(
                rect.height *
                scale
            );
    }


    const ctx =
        canvas.getContext("2d");


    ctx.setTransform(
        scale,
        0,
        0,
        scale,
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
   ANIMATION
============================================================ */

function animatePositions(model) {

    for (
        let i = 0;
        i < N_AGENTS;
        i++
    ) {

        model.positions[i].x
            +=
            (
                model.targets[i].x -
                model.positions[i].x
            )
            *
            0.14;


        model.positions[i].y
            +=
            (
                model.targets[i].y -
                model.positions[i].y
            )
            *
            0.14;
    }
}


/* ============================================================
   DRAW ONE MODEL
============================================================ */

function drawModel(
    canvas,
    model,
    colour,
    darkColour
) {

    const {
        ctx,
        width,
        height
    } =
        resizeCanvas(canvas);


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    animatePositions(
        model
    );


    /*
        Pairing boxes.
    */

    ctx.strokeStyle =
        "rgba(110,105,120,0.08)";

    ctx.lineWidth = 1;


    const slotYs = [
        0.15,
        0.32,
        0.49,
        0.66,
        0.83
    ];


    for (
        const yNorm of
        slotYs
    ) {

        for (
            const xNorm of
            [0.25, 0.75]
        ) {

            const boxWidth =
                width * 0.32;

            const boxHeight =
                58;


            const bx =
                width *
                xNorm -
                boxWidth / 2;

            const by =
                height *
                yNorm -
                boxHeight / 2;


            roundedRect(
                ctx,
                bx,
                by,
                boxWidth,
                boxHeight,
                11
            );


            ctx.stroke();
        }
    }


    /*
        Draw partnership lines first.
    */

    for (
        const pair of
        model.groups
    ) {

        const first =
            model.positions[
                pair[0]
            ];

        const second =
            model.positions[
                pair[1]
            ];


        ctx.beginPath();


        ctx.moveTo(
            first.x * width,
            first.y * height
        );


        ctx.lineTo(
            second.x * width,
            second.y * height
        );


        ctx.strokeStyle =
            colour;

        ctx.globalAlpha =
            model.type ===
            "baseline"
                ? 0.55
                : 0.68;

        ctx.lineWidth = 4;

        ctx.stroke();

        ctx.globalAlpha = 1;
    }


    /*
        Agents.
    */

    for (
        let agent = 0;
        agent <
        N_AGENTS;
        agent++
    ) {

        const position =
            model.positions[
                agent
            ];


        const x =
            position.x *
            width;

        const y =
            position.y *
            height;


        const cooperating =
            model.actionsPD[
                agent
            ] === 0;


        /*
            Shadow.
        */

        ctx.beginPath();

        ctx.arc(
            x,
            y + 3,
            21,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "rgba(40,35,50,0.08)";

        ctx.fill();


        /*
            Node.
        */

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            20,
            0,
            Math.PI * 2
        );


        ctx.fillStyle =
            cooperating
                ? colour
                : "#ffffff";


        ctx.fill();


        ctx.lineWidth = 3;

        ctx.strokeStyle =
            darkColour;

        ctx.stroke();


        /*
            C / D
        */

        ctx.font =
            "700 12px Inter, sans-serif";

        ctx.textAlign =
            "center";

        ctx.textBaseline =
            "middle";


        ctx.fillStyle =
            cooperating
                ? "#ffffff"
                : darkColour;


        ctx.fillText(
            cooperating
                ? "C"
                : "D",
            x,
            y
        );


        /*
            Tiny agent number.
        */

        ctx.font =
            "9px Inter, sans-serif";

        ctx.fillStyle =
            "#9a96a0";


        ctx.fillText(
            String(
                agent + 1
            ),
            x,
            y + 34
        );
    }
}


/* ============================================================
   ROUNDED RECT
============================================================ */

function roundedRect(
    ctx,
    x,
    y,
    width,
    height,
    radius
) {

    ctx.beginPath();

    ctx.roundRect(
        x,
        y,
        width,
        height,
        radius
    );
}


/* ============================================================
   MODELS
============================================================ */

const baselineModel =
    new Model(
        "baseline"
    );

const hybridModel =
    new Model(
        "hybrid"
    );


/* ============================================================
   ELEMENTS
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


const status =
    document.getElementById(
        "status"
    );


/* ============================================================
   METRICS
============================================================ */

function updateMetrics() {

    document.getElementById(
        "baselineIteration"
    ).textContent =
        baselineModel
            .iteration
            .toLocaleString();


    document.getElementById(
        "hybridIteration"
    ).textContent =
        hybridModel
            .iteration
            .toLocaleString();


    document.getElementById(
        "baselineCooperation"
    ).textContent =
        baselineModel.iteration === 0
            ? "—"
            :
            formatPercent(
                baselineModel.cooperation
            );


    document.getElementById(
        "hybridCooperation"
    ).textContent =
        hybridModel.iteration === 0
            ? "—"
            :
            formatPercent(
                hybridModel.cooperation
            );


    document.getElementById(
        "baselineCooperators"
    ).textContent =
        baselineModel
            .cooperatorCount()
        +
        " / 20";


    document.getElementById(
        "hybridCooperators"
    ).textContent =
        hybridModel
            .cooperatorCount()
        +
        " / 20";


    document.getElementById(
        "hybridSwitching"
    ).textContent =
        hybridModel.iteration === 0
            ? "—"
            :
            formatPercent(
                hybridModel.switchRate
            );
}


/* ============================================================
   RENDER
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


/* ============================================================
   SIMULATION TIMER

   Simulation steps are intentionally separated from the
   visual animation loop so agents visibly move between pairs.
============================================================ */

let running = false;

let simulationTimer = null;


/*
    Every simulation tick executes the number
    of iterations selected by "speed".
*/

function runSimulationTick() {

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


    /*
        Keep visual motion readable.

        Higher speed executes more training
        iterations per simulation tick.
    */

    const steps =
        Math.max(
            1,
            Math.ceil(
                speed / 3
            )
        );


    for (
        let i = 0;
        i < steps;
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


    /*
        Delay shrinks as speed increases.
    */

    const delay =
        Math.max(
            70,
            550 -
            speed * 18
        );


    simulationTimer =
        setTimeout(
            runSimulationTick,
            delay
        );
}


/* ============================================================
   VISUAL LOOP
============================================================ */

function animationLoop() {

    render();

    requestAnimationFrame(
        animationLoop
    );
}


requestAnimationFrame(
    animationLoop
);


/* ============================================================
   RUN BUTTON
============================================================ */

runButton.addEventListener(
    "click",
    () => {

        if (running) {
            return;
        }


        running = true;


        runButton.disabled =
            true;

        pauseButton.disabled =
            false;


        status.textContent =
            "Running";

        status.classList.add(
            "running"
        );


        runSimulationTick();
    }
);


/* ============================================================
   PAUSE
============================================================ */

pauseButton.addEventListener(
    "click",
    () => {

        running = false;


        if (
            simulationTimer
        ) {

            clearTimeout(
                simulationTimer
            );

            simulationTimer =
                null;
        }


        runButton.disabled =
            false;

        pauseButton.disabled =
            true;


        status.textContent =
            "Paused";

        status.classList.remove(
            "running"
        );
    }
);


/* ============================================================
   RESET
============================================================ */

resetButton.addEventListener(
    "click",
    () => {

        running = false;


        if (
            simulationTimer
        ) {

            clearTimeout(
                simulationTimer
            );

            simulationTimer =
                null;
        }


        baselineModel.reset();

        hybridModel.reset();


        runButton.disabled =
            false;

        pauseButton.disabled =
            true;


        status.textContent =
            "Ready";

        status.classList.remove(
            "running"
        );


        render();
    }
);


/* ============================================================
   CONTROL LABELS
============================================================ */

mSlider.addEventListener(
    "input",
    () => {

        mValue.textContent =
            Number(
                mSlider.value
            )
            .toFixed(2);
    }
);


alphaSlider.addEventListener(
    "input",
    () => {

        alphaValue.textContent =
            Number(
                alphaSlider.value
            )
            .toFixed(2);
    }
);


tauSlider.addEventListener(
    "input",
    () => {

        tauValue.textContent =
            Number(
                tauSlider.value
            )
            .toFixed(2);
    }
);


speedSlider.addEventListener(
    "input",
    () => {

        speedValue.textContent =
            speedSlider.value +
            "×";
    }
);


/* ============================================================
   INITIAL DISPLAY
============================================================ */

render();