"use strict";


/* ============================================================
   PRIMARY DISSERTATION CONFIGURATION
============================================================ */

const N_AGENTS = 20;
const ROUNDS = 20;

const ALPHA = 0.05;
const TAU = 1.0;
const GAMMA = 1.0;

const TRAINING_HORIZON = 100000;
const N_SIM = 10;


/*
    These are the exact reported means from the
    dissertation primary assortativity experiment.
*/

const DISSERTATION_RESULTS = {

    "0.0": {
        baseline: 0.258,
        hybrid: 0.766
    },

    "0.3": {
        baseline: 0.076,
        hybrid: 0.788
    },

    "0.5": {
        baseline: 0.064,
        hybrid: 0.715
    },

    "0.7": {
        baseline: 0.052,
        hybrid: 0.717
    },

    "1.0": {
        baseline: 0.039,
        hybrid: 0.716
    }

};


/*
    PD payoff matrices from the authoritative code.

    action 0 = cooperate
    action 1 = defect
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
   RANDOMNESS
============================================================ */

function seededRandom(seed) {

    return function () {

        seed |= 0;

        seed =
            (
                seed +
                0x6D2B79F5
            )
            | 0;

        let t = seed;

        t =
            Math.imul(
                t ^ (t >>> 15),
                t | 1
            );

        t ^=
            t +
            Math.imul(
                t ^ (t >>> 7),
                t | 61
            );

        return (
            (
                t ^
                (t >>> 14)
            )
            >>> 0
        )
        /
        4294967296;
    };
}


/* ============================================================
   HELPERS
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


function shuffle(values, rng) {

    const output =
        values.slice();

    for (
        let i =
            output.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                rng() *
                (i + 1)
            );

        const temp =
            output[i];

        output[i] =
            output[j];

        output[j] =
            temp;
    }

    return output;
}


function formatPercent(value) {

    return (
        value *
        100
    ).toFixed(1) + "%";
}


/* ============================================================
   Q TABLE
============================================================ */

function createQTable() {

    return Array.from(

        {
            length: N_AGENTS
        },

        () =>

            Array.from(

                {
                    length: 4
                },

                () => [
                    0,
                    0
                ]

            )

    );
}


/* ============================================================
   BOLTZMANN ACTION SELECTION

   Matches supplied implementation:

       q0 = tau * Q
       q1 = tau * Q

============================================================ */

function selectAction(
    Q,
    agent,
    state,
    rng
) {

    const si =
        stateToIndex(state);


    const q0 =
        TAU *
        Q[agent][si][0];


    const q1 =
        TAU *
        Q[agent][si][1];


    const maxQ =
        Math.max(
            q0,
            q1
        );


    const e0 =
        Math.exp(
            q0 -
            maxQ
        );


    const e1 =
        Math.exp(
            q1 -
            maxQ
        );


    const p0 =
        e0 /
        (
            e0 +
            e1
        );


    return (
        rng() <
        p0
    )
        ?
        0
        :
        1;
}


/* ============================================================
   PAIRING
============================================================ */

function randomPairsFromIds(
    ids,
    rng
) {

    const shuffled =
        shuffle(
            ids,
            rng
        );


    const pairs = [];


    for (
        let i = 0;
        i + 1 <
        shuffled.length;
        i += 2
    ) {

        pairs.push(
            [
                shuffled[i],
                shuffled[i + 1]
            ]
        );
    }


    return pairs;
}


function randomPairs(rng) {

    const ids =
        Array.from(
            {
                length: N_AGENTS
            },
            (_, i) => i
        );


    return randomPairsFromIds(
        ids,
        rng
    );
}


/*
    Behavioural assortativity:
    previous C with previous C,
    previous D with previous D,
    wherever possible.
*/

function assortativePairs(
    ids,
    actionsPD,
    rng
) {

    const C = [];
    const D = [];


    for (
        const agent of ids
    ) {

        if (
            actionsPD[agent]
            ===
            0
        ) {

            C.push(agent);

        } else {

            D.push(agent);
        }
    }


    const cooperators =
        shuffle(
            C,
            rng
        );


    const defectors =
        shuffle(
            D,
            rng
        );


    const pairs = [];

    const leftovers = [];


    let index = 0;


    while (
        index + 1 <
        cooperators.length
    ) {

        pairs.push(
            [
                cooperators[index],
                cooperators[index + 1]
            ]
        );

        index += 2;
    }


    if (
        index <
        cooperators.length
    ) {

        leftovers.push(
            cooperators[index]
        );
    }


    index = 0;


    while (
        index + 1 <
        defectors.length
    ) {

        pairs.push(
            [
                defectors[index],
                defectors[index + 1]
            ]
        );

        index += 2;
    }


    if (
        index <
        defectors.length
    ) {

        leftovers.push(
            defectors[index]
        );
    }


    const extra =
        randomPairsFromIds(
            leftovers,
            rng
        );


    pairs.push(
        ...extra
    );


    return pairs;
}


/* ============================================================
   MEMORY
============================================================ */

function createMemory() {

    return Array.from(
        {
            length: N_AGENTS
        },
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
   Q UPDATE
============================================================ */

function updateQ(
    Q,
    memory
) {

    for (
        let agent = 0;
        agent <
        N_AGENTS;
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
                e.reward
                +
                GAMMA
                *
                running;


            const si =
                stateToIndex(
                    e.state
                );


            Q[agent][si][e.action]
                =
                (
                    1 -
                    ALPHA
                )
                *
                Q[agent][si][e.action]
                +
                ALPHA
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

        this.type =
            type;

        this.reset();
    }


    reset() {

        this.rng =
            seededRandom(
                this.type === "baseline"
                ?
                1235
                :
                1235
            );


        this.Q =
            createQTable();


        this.memory =
            createMemory();


        /*
            Match the model's binary
            initial PD action state.
        */

        this.actionsPD =
            Array.from(

                {
                    length:
                        N_AGENTS
                },

                () =>
                    this.rng() <
                    0.5
                    ?
                    0
                    :
                    1

            );


        this.groups =
            randomPairs(
                this.rng
            );


        this.iteration =
            0;


        this.cooperation =
            0;


        this.positions =
            Array.from(
                {
                    length:
                        N_AGENTS
                },
                () => ({
                    left: 50,
                    top: 50
                })
            );


        this.targets =
            Array.from(
                {
                    length:
                        N_AGENTS
                },
                () => ({
                    left: 50,
                    top: 50
                })
            );


        assignTargets(this);
    }


    baselineRematch(m) {

        const ids =
            Array.from(
                {
                    length:
                        N_AGENTS
                },
                (_, i) => i
            );


        if (
            this.rng() <
            m
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


    hybridRematch(m) {

        const stayPairs = [];

        const switchPool = [];


        for (
            const pair of
            this.groups
        ) {

            const i =
                pair[0];

            const j =
                pair[1];


            const stateI =
                this.actionsPD[j];

            const stateJ =
                this.actionsPD[i];


            const actionI =
                selectAction(
                    this.Q,
                    i,
                    stateI,
                    this.rng
                );


            const actionJ =
                selectAction(
                    this.Q,
                    j,
                    stateJ,
                    this.rng
                );


            /*
                Relationship decision
                has zero immediate reward.
            */

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


            /*
                Relationship remains only
                when both choose stay.
            */

            if (
                actionI === 0
                &&
                actionJ === 0
            ) {

                stayPairs.push(
                    [
                        i,
                        j
                    ]
                );

            } else {

                switchPool.push(i);
                switchPool.push(j);
            }
        }


        let newPairs = [];


        if (
            switchPool.length >
            0
        ) {

            if (
                this.rng() <
                m
            ) {

                newPairs =
                    assortativePairs(
                        switchPool,
                        this.actionsPD,
                        this.rng
                    );

            } else {

                newPairs =
                    randomPairsFromIds(
                        switchPool,
                        this.rng
                    );
            }
        }


        this.groups = [
            ...stayPairs,
            ...newPairs
        ];
    }


    step(m) {

        let CC = 0;
        let CD = 0;
        let DC = 0;
        let DD = 0;


        for (
            let round = 0;
            round < ROUNDS;
            round++
        ) {

            if (
                this.type
                ===
                "baseline"
            ) {

                this.baselineRematch(m);

            } else {

                this.hybridRematch(m);
            }


            for (
                const pair of
                this.groups
            ) {

                const i =
                    pair[0];

                const j =
                    pair[1];


                const previousI =
                    this.actionsPD[i];

                const previousJ =
                    this.actionsPD[j];


                const stateI =
                    100
                    +
                    previousJ;


                const stateJ =
                    100
                    +
                    previousI;


                const actionI =
                    selectAction(
                        this.Q,
                        i,
                        stateI,
                        this.rng
                    );


                const actionJ =
                    selectAction(
                        this.Q,
                        j,
                        stateJ,
                        this.rng
                    );


                const rewardI =
                    REWARD_1
                    [actionI]
                    [actionJ];


                const rewardJ =
                    REWARD_2
                    [actionI]
                    [actionJ];


                storeExperience(
                    this.memory,
                    i,
                    stateI,
                    actionI,
                    rewardI
                );


                storeExperience(
                    this.memory,
                    j,
                    stateJ,
                    actionJ,
                    rewardJ
                );


                if (
                    actionI === 0
                    &&
                    actionJ === 0
                ) {

                    CC++;

                }

                else if (
                    actionI === 0
                    &&
                    actionJ === 1
                ) {

                    CD++;

                }

                else if (
                    actionI === 1
                    &&
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


        updateQ(
            this.Q,
            this.memory
        );


        const outcomes =
            CC
            +
            CD
            +
            DC
            +
            DD;


        this.cooperation =
            (
                2 * CC
                +
                CD
                +
                DC
            )
            /
            (
                2 *
                outcomes
            );


        this.iteration++;


        assignTargets(
            this
        );
    }
}


/* ============================================================
   VISUAL POSITIONS
============================================================ */

const SLOTS = [

    [25, 14],
    [75, 14],

    [25, 31],
    [75, 31],

    [25, 48],
    [75, 48],

    [25, 65],
    [75, 65],

    [25, 82],
    [75, 82]

];


function assignTargets(model) {

    model.groups.forEach(
        (pair, index) => {

            const slot =
                SLOTS[index];


            if (!slot) {
                return;
            }


            model.targets[
                pair[0]
            ] = {

                left:
                    slot[0]
                    -
                    5.5,

                top:
                    slot[1]

            };


            model.targets[
                pair[1]
            ] = {

                left:
                    slot[0]
                    +
                    5.5,

                top:
                    slot[1]

            };
        }
    );
}


/* ============================================================
   DOM CREATION
============================================================ */

function createAgentElements(
    model,
    container,
    type
) {

    container.innerHTML =
        "";


    for (
        let i = 0;
        i <
        N_AGENTS;
        i++
    ) {

        const agent =
            document.createElement(
                "div"
            );


        agent.className =
            `agent ${type}`;


        agent.dataset.agent =
            i;


        const action =
            document.createElement(
                "span"
            );


        action.className =
            "agent-action";


        const number =
            document.createElement(
                "span"
            );


        number.className =
            "agent-number";


        number.textContent =
            i + 1;


        agent.appendChild(
            action
        );


        agent.appendChild(
            number
        );


        container.appendChild(
            agent
        );
    }
}


/* ============================================================
   DRAW MODEL
============================================================ */

function drawModel(
    model,
    agentLayer,
    lineLayer,
    colour
) {

    const agents =
        agentLayer.querySelectorAll(
            ".agent"
        );


    agents.forEach(
        (element, index) => {

            const target =
                model.targets[index];


            element.style.left =
                target.left +
                "%";


            element.style.top =
                target.top +
                "%";


            const cooperation =
                model.actionsPD[index]
                ===
                0;


            element.classList.toggle(
                "cooperate",
                cooperation
            );


            element.classList.toggle(
                "defect",
                !cooperation
            );


            element
                .querySelector(
                    ".agent-action"
                )
                .textContent =
                    cooperation
                    ?
                    "C"
                    :
                    "D";
        }
    );


    lineLayer.innerHTML =
        "";


    const rect =
        lineLayer
            .getBoundingClientRect();


    lineLayer.setAttribute(
        "viewBox",
        `0 0 ${rect.width} ${rect.height}`
    );


    for (
        const pair of
        model.groups
    ) {

        const a =
            model.targets[
                pair[0]
            ];


        const b =
            model.targets[
                pair[1]
            ];


        const line =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line"
            );


        line.setAttribute(
            "x1",
            rect.width *
            a.left /
            100
        );


        line.setAttribute(
            "y1",
            rect.height *
            a.top /
            100
        );


        line.setAttribute(
            "x2",
            rect.width *
            b.left /
            100
        );


        line.setAttribute(
            "y2",
            rect.height *
            b.top /
            100
        );


        line.setAttribute(
            "stroke",
            colour
        );


        line.setAttribute(
            "stroke-width",
            "4"
        );


        line.setAttribute(
            "stroke-opacity",
            "0.55"
        );


        lineLayer.appendChild(
            line
        );
    }
}


/* ============================================================
   MODELS + ELEMENTS
============================================================ */

const baseline =
    new Model(
        "baseline"
    );


const hybrid =
    new Model(
        "hybrid"
    );


const baselineAgents =
    document.getElementById(
        "baselineAgents"
    );


const hybridAgents =
    document.getElementById(
        "hybridAgents"
    );


const baselineLines =
    document.getElementById(
        "baselineLines"
    );


const hybridLines =
    document.getElementById(
        "hybridLines"
    );


createAgentElements(
    baseline,
    baselineAgents,
    "baseline"
);


createAgentElements(
    hybrid,
    hybridAgents,
    "hybrid"
);


/* ============================================================
   SELECTED M
============================================================ */

let selectedM = 0.0;


/* ============================================================
   REPORTED RESULTS
============================================================ */

function resultKey(m) {

    return Number(m)
        .toFixed(1);
}


function updateReportedResults() {

    const key =
        resultKey(
            selectedM
        );


    const values =
        DISSERTATION_RESULTS[
            key
        ];


    document
        .getElementById(
            "baselineReported"
        )
        .textContent =
            formatPercent(
                values.baseline
            );


    document
        .getElementById(
            "hybridReported"
        )
        .textContent =
            formatPercent(
                values.hybrid
            );


    document
        .getElementById(
            "baselineResult"
        )
        .textContent =
            formatPercent(
                values.baseline
            );


    document
        .getElementById(
            "hybridResult"
        )
        .textContent =
            formatPercent(
                values.hybrid
            );


    document
        .getElementById(
            "resultM"
        )
        .textContent =
            key;


    document
        .getElementById(
            "baselineBar"
        )
        .style.width =
            (
                values.baseline *
                100
            )
            +
            "%";


    document
        .getElementById(
            "hybridBar"
        )
        .style.width =
            (
                values.hybrid *
                100
            )
            +
            "%";
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
            "baselineLive"
        )
        .textContent =
            baseline.iteration
            ===
            0
            ?
            "—"
            :
            formatPercent(
                baseline.cooperation
            );


    document
        .getElementById(
            "hybridLive"
        )
        .textContent =
            hybrid.iteration
            ===
            0
            ?
            "—"
            :
            formatPercent(
                hybrid.cooperation
            );
}


/* ============================================================
   RENDER
============================================================ */

function render() {

    drawModel(
        baseline,
        baselineAgents,
        baselineLines,
        "#c06082"
    );


    drawModel(
        hybrid,
        hybridAgents,
        hybridLines,
        "#7b6fd6"
    );


    updateMetrics();
}


/* ============================================================
   M BUTTONS
============================================================ */

document
    .querySelectorAll(
        ".m-button"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    selectedM =
                        Number(
                            button.dataset.m
                        );


                    document
                        .querySelectorAll(
                            ".m-button"
                        )
                        .forEach(
                            b =>
                                b.classList
                                    .remove(
                                        "active"
                                    )
                        );


                    button
                        .classList
                        .add(
                            "active"
                        );


                    updateReportedResults();


                    resetSimulation();
                }
            );
        }
    );


/* ============================================================
   SIMULATION LOOP
============================================================ */

let running =
    false;


let timer =
    null;


const speedSlider =
    document.getElementById(
        "speedSlider"
    );


const speedValue =
    document.getElementById(
        "speedValue"
    );


function tick() {

    if (!running) {
        return;
    }


    const speed =
        Number(
            speedSlider.value
        );


    /*
        Multiple actual model iterations
        per visual update.
    */

    const steps =
        Math.max(
            1,
            speed
        );


    for (
        let i = 0;
        i < steps;
        i++
    ) {

        baseline.step(
            selectedM
        );


        hybrid.step(
            selectedM
        );
    }


    render();


    timer =
        window.setTimeout(
            tick,
            Math.max(
                80,
                600
                -
                speed * 48
            )
        );
}


/* ============================================================
   BUTTONS
============================================================ */

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


runButton.addEventListener(
    "click",
    () => {

        if (running) {
            return;
        }


        running =
            true;


        runButton.disabled =
            true;


        pauseButton.disabled =
            false;


        status.textContent =
            "Running";


        status.classList.add(
            "running"
        );


        tick();
    }
);


pauseButton.addEventListener(
    "click",
    () => {

        running =
            false;


        if (
            timer !== null
        ) {

            clearTimeout(
                timer
            );


            timer =
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


function resetSimulation() {

    running =
        false;


    if (
        timer !== null
    ) {

        clearTimeout(
            timer
        );


        timer =
            null;
    }


    baseline.reset();

    hybrid.reset();


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


resetButton.addEventListener(
    "click",
    resetSimulation
);


/* ============================================================
   SPEED
============================================================ */

speedSlider.addEventListener(
    "input",
    () => {

        speedValue.textContent =
            speedSlider.value
            +
            "×";
    }
);


/* ============================================================
   START
============================================================ */

updateReportedResults();

render();

console.log(
    "Dissertation simulation loaded."
);