"use strict";


/* ============================================================
   CONSTANTS
   Based on dissertation model configuration
============================================================ */

const N_AGENTS = 20;
const ROUNDS_G = 20;
const GAMMA = 1.0;

const BASELINE_COLOUR = "#c06082";
const HYBRID_COLOUR = "#7b6fd6";

const BASELINE_DARK = "#954561";
const HYBRID_DARK = "#5d51b6";

const REWARD_1 = [
    [3, 0],
    [5, 1]
];

const REWARD_2 = [
    [3, 5],
    [0, 1]
];


/* ============================================================
   SEEDED RANDOM GENERATOR
============================================================ */

function mulberry32(seed) {

    return function () {

        let t = seed += 0x6D2B79F5;

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
   GENERAL HELPERS
============================================================ */

function stateToIndex(state) {

    if (state === 0) return 0;
    if (state === 1) return 1;
    if (state === 100) return 2;

    return 3;
}


function clamp(value, low, high) {

    return Math.max(
        low,
        Math.min(high, value)
    );
}


function shuffle(array, random) {

    const copy = array.slice();

    for (
        let i = copy.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                random() * (i + 1)
            );

        [
            copy[i],
            copy[j]
        ] = [
            copy[j],
            copy[i]
        ];
    }

    return copy;
}


function percentage(value) {

    return `${(value * 100).toFixed(1)}%`;
}


/* ============================================================
   CREATE Q TABLE
============================================================ */

function createQTable() {

    const Q = [];

    for (
        let agent = 0;
        agent < N_AGENTS;
        agent++
    ) {

        const states = [];

        for (
            let state = 0;
            state < 4;
            state++
        ) {

            states.push([
                0,
                0
            ]);
        }

        Q.push(states);
    }

    return Q;
}


/* ============================================================
   ACTION SELECTION

   IMPORTANT:
   This deliberately mirrors the supplied Python model:

       q0 = tau * Q[..., 0]
       q1 = tau * Q[..., 1]

   rather than changing the action-selection equation.
============================================================ */

function selectAction(
    Q,
    agent,
    state,
    tau,
    random
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

    const p0 =
        e0 / (e0 + e1);

    return (
        random() < p0
            ? 0
            : 1
    );
}


/* ============================================================
   PAIRING
============================================================ */

function randomPairsFromIds(
    ids,
    random
) {

    const shuffled =
        shuffle(ids, random);

    const pairs = [];

    for (
        let i = 0;
        i + 1 < shuffled.length;
        i += 2
    ) {

        pairs.push([
            shuffled[i],
            shuffled[i + 1]
        ]);
    }

    return pairs;
}


function randomPairs(
    n,
    random
) {

    return randomPairsFromIds(
        Array.from(
            { length: n },
            (_, index) => index
        ),
        random
    );
}


/*
    Mirrors create_assortative_pairs /
    assortative_pairing_n.

    Agents whose previous PD action is C
    are paired with C agents where possible.

    Previous D agents are paired with D
    agents where possible.

    Leftovers are pooled and paired.
*/

function assortativePairs(
    ids,
    actionsPD,
    random
) {

    const cooperators = [];
    const defectors = [];

    ids.forEach(agent => {

        if (
            actionsPD[agent] === 0
        ) {
            cooperators.push(agent);
        } else {
            defectors.push(agent);
        }
    });


    const C =
        shuffle(cooperators, random);

    const D =
        shuffle(defectors, random);


    const pairs = [];
    const leftovers = [];


    let index = 0;

    while (
        index + 1 < C.length
    ) {

        pairs.push([
            C[index],
            C[index + 1]
        ]);

        index += 2;
    }

    if (
        index < C.length
    ) {
        leftovers.push(C[index]);
    }


    index = 0;

    while (
        index + 1 < D.length
    ) {

        pairs.push([
            D[index],
            D[index + 1]
        ]);

        index += 2;
    }

    if (
        index < D.length
    ) {
        leftovers.push(D[index]);
    }


    const leftoverPairs =
        randomPairsFromIds(
            leftovers,
            random
        );

    pairs.push(
        ...leftoverPairs
    );

    return pairs;
}


/* ============================================================
   MEMORY AND Q UPDATE
============================================================ */

function createMemories() {

    return Array.from(
        { length: N_AGENTS },
        () => []
    );
}


function storeExperience(
    memories,
    agent,
    state,
    action,
    reward
) {

    memories[agent].push({
        state,
        action,
        reward
    });
}


/*
    Mirrors:

        running = reward + gamma * running

        Q = (1-lr)Q + lr*running

    and processes each trajectory backwards.
*/

function updateQValues(
    Q,
    memories,
    learningRate
) {

    for (
        let agent = 0;
        agent < N_AGENTS;
        agent++
    ) {

        let running = 0;

        const memory =
            memories[agent];


        for (
            let k = memory.length - 1;
            k >= 0;
            k--
        ) {

            const experience =
                memory[k];

            running =
                experience.reward +
                GAMMA * running;


            const si =
                stateToIndex(
                    experience.state
                );

            const action =
                experience.action;


            Q[agent][si][action] =
                (1 - learningRate) *
                    Q[agent][si][action]
                +
                learningRate *
                    running;
        }


        memories[agent] = [];
    }
}


/* ============================================================
   MODEL CLASS
============================================================ */

class MARLModel {

    constructor(type) {

        this.type = type;

        this.seed =
            type === "baseline"
                ? 1235
                : 1235;

        this.reset();
    }


    reset() {

        this.random =
            mulberry32(this.seed);


        this.Q =
            createQTable();


        this.actionsPD =
            Array.from(
                { length: N_AGENTS },
                () =>
                    this.random() < 0.5
                        ? 0
                        : 1
            );


        this.groups =
            randomPairs(
                N_AGENTS,
                this.random
            );


        this.memories =
            createMemories();


        this.iteration = 0;

        this.lastCooperation = 0;

        this.lastSwitchRate =
            this.type === "baseline"
                ? 1
                : 0;

        this.history = [];

        this.switchHistory = [];
    }


    /* ========================================================
       BASELINE REMATCHING
    ======================================================== */

    rematchBaseline(m) {

        const ids =
            Array.from(
                { length: N_AGENTS },
                (_, index) => index
            );


        if (
            this.random() < m
        ) {

            this.groups =
                assortativePairs(
                    ids,
                    this.actionsPD,
                    this.random
                );

        } else {

            this.groups =
                randomPairs(
                    N_AGENTS,
                    this.random
                );
        }
    }


    /* ========================================================
       HYBRID REMATCHING
    ======================================================== */

    rematchHybrid(
        m,
        tau
    ) {

        const groupsStay = [];
        const switchPool = [];

        let switchActions = 0;


        for (
            const pair of this.groups
        ) {

            const i = pair[0];
            const j = pair[1];


            /*
                Switching state is the partner's
                previous PD action:

                    0 = previous C
                    1 = previous D
            */

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
                    this.random
                );


            const actionJ =
                selectAction(
                    this.Q,
                    j,
                    stateJ,
                    tau,
                    this.random
                );


            /*
                Zero immediate reward for the
                relationship decision.

                Later PD rewards propagate backwards.
            */

            storeExperience(
                this.memories,
                i,
                stateI,
                actionI,
                0
            );


            storeExperience(
                this.memories,
                j,
                stateJ,
                actionJ,
                0
            );


            switchActions +=
                actionI + actionJ;


            /*
                Relationship continues ONLY if
                both agents choose stay.

                If either selects switch,
                both agents enter rematching.
            */

            if (
                actionI === 1 ||
                actionJ === 1
            ) {

                switchPool.push(i);
                switchPool.push(j);

            } else {

                groupsStay.push([
                    i,
                    j
                ]);
            }
        }


        let rematchedGroups = [];


        if (
            switchPool.length > 0
        ) {

            if (
                this.random() < m
            ) {

                rematchedGroups =
                    assortativePairs(
                        switchPool,
                        this.actionsPD,
                        this.random
                    );

            } else {

                rematchedGroups =
                    randomPairsFromIds(
                        switchPool,
                        this.random
                    );
            }
        }


        this.groups = [
            ...groupsStay,
            ...rematchedGroups
        ];


        return (
            switchActions /
            N_AGENTS
        );
    }


    /* ========================================================
       ONE FULL TRAINING ITERATION
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

        let totalSwitchRate = 0;


        for (
            let round = 0;
            round < ROUNDS_G;
            round++
        ) {

            /*
                REMATCHING OCCURS BEFORE
                EACH PD INTERACTION ROUND.
            */

            if (
                this.type === "baseline"
            ) {

                this.rematchBaseline(m);

                totalSwitchRate += 1;

            } else {

                totalSwitchRate +=
                    this.rematchHybrid(
                        m,
                        tau
                    );
            }


            /* ================================================
               PLAY PD FOR EACH CURRENT PAIR
            ================================================= */

            for (
                const pair of this.groups
            ) {

                const i = pair[0];
                const j = pair[1];


                const previousI =
                    this.actionsPD[i];

                const previousJ =
                    this.actionsPD[j];


                /*
                    PD state labels follow Python:

                    100 = partner previously C
                    101 = partner previously D
                */

                const stateI =
                    100 + previousJ;

                const stateJ =
                    100 + previousI;


                const actionI =
                    selectAction(
                        this.Q,
                        i,
                        stateI,
                        tau,
                        this.random
                    );


                const actionJ =
                    selectAction(
                        this.Q,
                        j,
                        stateJ,
                        tau,
                        this.random
                    );


                const rewardI =
                    REWARD_1[actionI][actionJ];

                const rewardJ =
                    REWARD_2[actionI][actionJ];


                storeExperience(
                    this.memories,
                    i,
                    stateI,
                    actionI,
                    rewardI
                );


                storeExperience(
                    this.memories,
                    j,
                    stateJ,
                    actionJ,
                    rewardJ
                );


                /*
                    Count PD outcome
                */

                if (
                    actionI === 0 &&
                    actionJ === 0
                ) {
                    CC++;
                }

                else if (
                    actionI === 0 &&
                    actionJ === 1
                ) {
                    CD++;
                }

                else if (
                    actionI === 1 &&
                    actionJ === 0
                ) {
                    DC++;
                }

                else {
                    DD++;
                }


                this.actionsPD[i] =
                    actionI;

                this.actionsPD[j] =
                    actionJ;
            }
        }


        /*
            Q VALUES UPDATE ONCE AFTER THE
            20-ROUND REPEATED GAME.
        */

        updateQValues(
            this.Q,
            this.memories,
            learningRate
        );


        const totalOutcomes =
            CC + CD + DC + DD;


        const cooperation =
            totalOutcomes > 0
                ?
                (
                    2 * CC +
                    CD +
                    DC
                )
                /
                (
                    2 *
                    totalOutcomes
                )
                :
                0;


        this.iteration++;

        this.lastCooperation =
            cooperation;


        this.lastSwitchRate =
            totalSwitchRate /
            ROUNDS_G;


        this.history.push(
            cooperation
        );


        this.switchHistory.push(
            this.lastSwitchRate
        );


        /*
            Browser graph does not need
            tens of thousands of points.
        */

        if (
            this.history.length > 500
        ) {

            this.history.shift();

            this.switchHistory.shift();
        }
    }


    getCooperatorCount() {

        let count = 0;

        for (
            const action of this.actionsPD
        ) {

            if (
                action === 0
            ) {
                count++;
            }
        }

        return count;
    }
}


/* ============================================================
   CREATE MODELS
============================================================ */

const baseline =
    new MARLModel("baseline");

const hybrid =
    new MARLModel("hybrid");


/* ============================================================
   DOM
============================================================ */

const mSlider =
    document.getElementById("mSlider");

const lrSlider =
    document.getElementById("lrSlider");

const tauSlider =
    document.getElementById("tauSlider");

const speedSlider =
    document.getElementById("speedSlider");


const mValue =
    document.getElementById("mValue");

const lrValue =
    document.getElementById("lrValue");

const tauValue =
    document.getElementById("tauValue");

const speedValue =
    document.getElementById("speedValue");


const startButton =
    document.getElementById("startButton");

const pauseButton =
    document.getElementById("pauseButton");

const resetButton =
    document.getElementById("resetButton");

const simulationStatus =
    document.getElementById("simulationStatus");


const baselineNetwork =
    document.getElementById(
        "baselineNetwork"
    );

const hybridNetwork =
    document.getElementById(
        "hybridNetwork"
    );


const baselineChart =
    document.getElementById(
        "baselineChart"
    );

const hybridChart =
    document.getElementById(
        "hybridChart"
    );


/* ============================================================
   NETWORK NODE POSITIONS
============================================================ */

const agentPositions = [];


function generateAgentPositions() {

    agentPositions.length = 0;

    const centerX = 300;
    const centerY = 210;

    const outerRadius = 166;
    const innerRadius = 105;


    for (
        let i = 0;
        i < N_AGENTS;
        i++
    ) {

        const ring =
            i % 2 === 0
                ? outerRadius
                : innerRadius;


        const angle =
            (
                Math.PI * 2 *
                i /
                N_AGENTS
            )
            -
            Math.PI / 2;


        const x =
            centerX +
            ring *
            Math.cos(angle);


        const y =
            centerY +
            ring *
            Math.sin(angle);


        agentPositions.push({
            x,
            y
        });
    }
}


generateAgentPositions();


/* ============================================================
   DRAW NETWORK
============================================================ */

function drawNetwork(
    svg,
    model,
    colour,
    darkColour
) {

    svg.innerHTML = "";


    /*
        Partnership lines first
    */

    for (
        const pair of model.groups
    ) {

        const a =
            agentPositions[pair[0]];

        const b =
            agentPositions[pair[1]];


        const line =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line"
            );


        line.setAttribute(
            "x1",
            a.x
        );

        line.setAttribute(
            "y1",
            a.y
        );

        line.setAttribute(
            "x2",
            b.x
        );

        line.setAttribute(
            "y2",
            b.y
        );


        line.setAttribute(
            "class",
            `edge ${model.type}`
        );


        svg.appendChild(line);
    }


    /*
        Agents
    */

    for (
        let i = 0;
        i < N_AGENTS;
        i++
    ) {

        const position =
            agentPositions[i];

        const cooperating =
            model.actionsPD[i] === 0;


        const group =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "g"
            );


        const circle =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "circle"
            );


        circle.setAttribute(
            "cx",
            position.x
        );

        circle.setAttribute(
            "cy",
            position.y
        );

        circle.setAttribute(
            "r",
            "19"
        );


        circle.setAttribute(
            "fill",
            cooperating
                ? colour
                : "#ffffff"
        );


        circle.setAttribute(
            "stroke",
            darkColour
        );


        circle.setAttribute(
            "class",
            "agent-circle"
        );


        const text =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "text"
            );


        text.setAttribute(
            "x",
            position.x
        );

        text.setAttribute(
            "y",
            position.y + 0.5
        );


        text.setAttribute(
            "class",
            cooperating
                ?
                "agent-text"
                :
                "agent-text defector-text"
        );


        text.textContent =
            cooperating
                ? "C"
                : "D";


        group.appendChild(circle);
        group.appendChild(text);

        svg.appendChild(group);
    }
}


/* ============================================================
   CANVAS CHART
============================================================ */

function prepareCanvas(canvas) {

    const rect =
        canvas.getBoundingClientRect();

    const ratio =
        window.devicePixelRatio || 1;


    canvas.width =
        rect.width * ratio;

    canvas.height =
        rect.height * ratio;


    const context =
        canvas.getContext("2d");


    context.setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0
    );


    return {
        context,
        width: rect.width,
        height: rect.height
    };
}


function drawChart(
    canvas,
    values,
    colour
) {

    const {
        context: ctx,
        width,
        height
    } = prepareCanvas(canvas);


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    const padding = {
        left: 34,
        right: 10,
        top: 9,
        bottom: 23
    };


    const chartWidth =
        width -
        padding.left -
        padding.right;


    const chartHeight =
        height -
        padding.top -
        padding.bottom;


    /*
        Grid
    */

    ctx.strokeStyle =
        "#eceaf0";

    ctx.lineWidth = 1;

    ctx.fillStyle =
        "#8c8993";

    ctx.font =
        "10px sans-serif";


    for (
        let tick = 0;
        tick <= 4;
        tick++
    ) {

        const value =
            tick / 4;


        const y =
            padding.top +
            chartHeight *
            (1 - value);


        ctx.beginPath();

        ctx.moveTo(
            padding.left,
            y
        );

        ctx.lineTo(
            width -
            padding.right,
            y
        );

        ctx.stroke();


        ctx.fillText(
            value.toFixed(2),
            2,
            y + 3
        );
    }


    /*
        Axes
    */

    ctx.strokeStyle =
        "#c9c6d0";

    ctx.beginPath();

    ctx.moveTo(
        padding.left,
        padding.top
    );

    ctx.lineTo(
        padding.left,
        height -
        padding.bottom
    );

    ctx.lineTo(
        width -
        padding.right,
        height -
        padding.bottom
    );

    ctx.stroke();


    if (
        values.length < 2
    ) {

        ctx.fillStyle =
            "#a5a2ab";

        ctx.font =
            "12px sans-serif";

        ctx.fillText(
            "Run the simulation to generate a trajectory.",
            padding.left + 13,
            padding.top + 25
        );

        return;
    }


    /*
        Cooperation trajectory
    */

    ctx.strokeStyle =
        colour;

    ctx.lineWidth = 2.5;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";


    ctx.beginPath();


    values.forEach(
        (value, index) => {

            const x =
                padding.left +
                (
                    index /
                    (values.length - 1)
                )
                *
                chartWidth;


            const y =
                padding.top +
                (
                    1 -
                    clamp(value, 0, 1)
                )
                *
                chartHeight;


            if (
                index === 0
            ) {

                ctx.moveTo(
                    x,
                    y
                );

            } else {

                ctx.lineTo(
                    x,
                    y
                );
            }
        }
    );


    ctx.stroke();
}


/* ============================================================
   METRICS
============================================================ */

function updateMetrics() {

    document
        .getElementById(
            "baselineIteration"
        )
        .textContent =
            baseline.iteration
                .toLocaleString();


    document
        .getElementById(
            "hybridIteration"
        )
        .textContent =
            hybrid.iteration
                .toLocaleString();


    document
        .getElementById(
            "baselineCooperation"
        )
        .textContent =
            baseline.iteration === 0
                ? "—"
                : percentage(
                    baseline.lastCooperation
                );


    document
        .getElementById(
            "hybridCooperation"
        )
        .textContent =
            hybrid.iteration === 0
                ? "—"
                : percentage(
                    hybrid.lastCooperation
                );


    document
        .getElementById(
            "baselineCooperators"
        )
        .textContent =
            baseline.getCooperatorCount() +
            " / " +
            N_AGENTS;


    document
        .getElementById(
            "hybridCooperators"
        )
        .textContent =
            hybrid.getCooperatorCount() +
            " / " +
            N_AGENTS;


    document
        .getElementById(
            "baselineSwitching"
        )
        .textContent =
            "100%";


    document
        .getElementById(
            "hybridSwitching"
        )
        .textContent =
            hybrid.iteration === 0
                ? "—"
                : percentage(
                    hybrid.lastSwitchRate
                );
}


/* ============================================================
   RENDER EVERYTHING
============================================================ */

function render() {

    drawNetwork(
        baselineNetwork,
        baseline,
        BASELINE_COLOUR,
        BASELINE_DARK
    );


    drawNetwork(
        hybridNetwork,
        hybrid,
        HYBRID_COLOUR,
        HYBRID_DARK
    );


    drawChart(
        baselineChart,
        baseline.history,
        BASELINE_COLOUR
    );


    drawChart(
        hybridChart,
        hybrid.history,
        HYBRID_COLOUR
    );


    updateMetrics();
}


/* ============================================================
   RUN LOOP
============================================================ */

let running = false;
let animationFrame = null;
let lastFrame = 0;


function simulationLoop(timestamp) {

    if (!running) {
        return;
    }


    /*
        Limit browser visual refresh rate
        while multiple model iterations
        can happen per frame.
    */

    if (
        timestamp - lastFrame >= 35
    ) {

        lastFrame = timestamp;


        const m =
            Number(mSlider.value);

        const learningRate =
            Number(lrSlider.value);

        const tau =
            Number(tauSlider.value);

        const steps =
            Number(speedSlider.value);


        for (
            let s = 0;
            s < steps;
            s++
        ) {

            baseline.step(
                m,
                learningRate,
                tau
            );


            hybrid.step(
                m,
                learningRate,
                tau
            );
        }


        render();
    }


    animationFrame =
        requestAnimationFrame(
            simulationLoop
        );
}


/* ============================================================
   BUTTONS
============================================================ */

startButton.addEventListener(
    "click",
    () => {

        if (running) return;


        running = true;

        startButton.disabled = true;
        pauseButton.disabled = false;

        simulationStatus.textContent =
            "Running";


        animationFrame =
            requestAnimationFrame(
                simulationLoop
            );
    }
);


pauseButton.addEventListener(
    "click",
    () => {

        running = false;

        startButton.disabled = false;
        pauseButton.disabled = true;

        simulationStatus.textContent =
            "Paused";


        if (
            animationFrame !== null
        ) {

            cancelAnimationFrame(
                animationFrame
            );

            animationFrame = null;
        }
    }
);


resetButton.addEventListener(
    "click",
    () => {

        running = false;


        if (
            animationFrame !== null
        ) {

            cancelAnimationFrame(
                animationFrame
            );

            animationFrame = null;
        }


        baseline.reset();
        hybrid.reset();


        startButton.disabled = false;
        pauseButton.disabled = true;

        simulationStatus.textContent =
            "Ready";


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


lrSlider.addEventListener(
    "input",
    () => {

        lrValue.textContent =
            Number(
                lrSlider.value
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
   WINDOW RESIZE
============================================================ */

window.addEventListener(
    "resize",
    () => {

        drawChart(
            baselineChart,
            baseline.history,
            BASELINE_COLOUR
        );


        drawChart(
            hybridChart,
            hybrid.history,
            HYBRID_COLOUR
        );
    }
);


/* ============================================================
   INITIAL RENDER
============================================================ */

render();