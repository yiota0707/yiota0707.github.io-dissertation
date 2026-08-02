"use strict";


/*
    ============================================================
    INTERACTIVE DISSERTATION DEMONSTRATION
    ============================================================

    This file implements an educational browser visualisation of
    the mechanisms described in the dissertation.

    It is intentionally labelled as a demonstration because it is
    not the full Numba-optimised experimental implementation used
    to produce the dissertation's numerical results.

    Model colours:
        Baseline: #c06082
        Hybrid:   #7b6fd6

    Action colours:
        Cooperation: #7b6fd6
        Defection:   #c06082
*/


const COOPERATE = 0;
const DEFECT = 1;

const STAY = 0;
const SWITCH = 1;

const COOPERATE_COLOUR = "#7b6fd6";
const DEFECT_COLOUR = "#c06082";

const BASELINE_COLOUR = "#c06082";
const HYBRID_COLOUR = "#7b6fd6";

const CONNECTION_COLOUR = "#bbb5c0";
const TEXT_COLOUR = "#211d28";


/*
    ============================================================
    DOCUMENT ELEMENTS
    ============================================================
*/


const canvas =
    document.getElementById("agentCanvas");

const context =
    canvas.getContext("2d");


const chartCanvas =
    document.getElementById("cooperationChart");

const chartContext =
    chartCanvas.getContext("2d");


const modelSelect =
    document.getElementById("modelSelect");

const populationInput =
    document.getElementById("populationInput");

const assortativityInput =
    document.getElementById("assortativityInput");

const learningRateInput =
    document.getElementById("learningRateInput");

const discountInput =
    document.getElementById("discountInput");

const temperatureInput =
    document.getElementById("temperatureInput");

const roundsInput =
    document.getElementById("roundsInput");

const speedInput =
    document.getElementById("speedInput");


const populationOutput =
    document.getElementById("populationOutput");

const assortativityOutput =
    document.getElementById("assortativityOutput");

const learningRateOutput =
    document.getElementById("learningRateOutput");

const discountOutput =
    document.getElementById("discountOutput");

const temperatureOutput =
    document.getElementById("temperatureOutput");

const roundsOutput =
    document.getElementById("roundsOutput");

const speedOutput =
    document.getElementById("speedOutput");


const runButton =
    document.getElementById("runButton");

const stepButton =
    document.getElementById("stepButton");

const resetButton =
    document.getElementById("resetButton");

const defaultPresetButton =
    document.getElementById("defaultPresetButton");


const generationValue =
    document.getElementById("generationValue");

const cooperationMetric =
    document.getElementById("cooperationMetric");

const rewardMetric =
    document.getElementById("rewardMetric");

const switchingMetric =
    document.getElementById("switchingMetric");

const stablePairsMetric =
    document.getElementById("stablePairsMetric");


const statusDot =
    document.getElementById("statusDot");

const statusText =
    document.getElementById("statusText");

const modelExplanation =
    document.getElementById("modelExplanation");

const chartModelLabel =
    document.getElementById("chartModelLabel");

const canvasModelName =
    document.getElementById("canvasModelName");

const canvasAssortativity =
    document.getElementById("canvasAssortativity");


const ccValue =
    document.getElementById("ccValue");

const cdValue =
    document.getElementById("cdValue");

const dcValue =
    document.getElementById("dcValue");

const ddValue =
    document.getElementById("ddValue");


const ccBar =
    document.getElementById("ccBar");

const cdBar =
    document.getElementById("cdBar");

const dcBar =
    document.getElementById("dcBar");

const ddBar =
    document.getElementById("ddBar");


const mobileMenuButton =
    document.getElementById("mobileMenuButton");

const navigation =
    document.getElementById("navigation");


/*
    ============================================================
    SIMULATION STATE
    ============================================================
*/


let agents = [];
let pairs = [];

let generation = 0;
let interactionRound = 0;

let isRunning = false;
let simulationTimer = null;

let cooperationHistory = [];

let currentOutcomes = {
    cc: 0,
    cd: 0,
    dc: 0,
    dd: 0
};


let lastRematchChangedAgents = 0;
let lastRematchStablePairs = 0;


/*
    ============================================================
    AGENT
    ============================================================
*/


class Agent {

    constructor(id, x, y) {

        this.id = id;

        this.x = x;
        this.y = y;

        this.radius = 16;

        this.action =
            Math.random() < 0.5
                ? COOPERATE
                : DEFECT;

        this.previousAction =
            this.action;

        this.reward = 0;
        this.totalReward = 0;

        this.partnerId = null;
        this.previousPartnerId = null;

        this.selectedSwitchAction = STAY;


        /*
            Browser state representation:

            0 = own previous C, partner previous C
            1 = own previous C, partner previous D
            2 = own previous D, partner previous C
            3 = own previous D, partner previous D
        */

        this.state = 0;


        /*
            Prisoner's Dilemma action values:

            qValues[state][0] = cooperate
            qValues[state][1] = defect
        */

        this.qValues = [
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0]
        ];


        /*
            Hybrid stay-or-switch values:

            switchQ[state][0] = stay
            switchQ[state][1] = switch
        */

        this.switchQ = [
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0]
        ];

    }

}


/*
    ============================================================
    CANVAS SIZE
    ============================================================
*/


function resizeCanvases() {

    resizeCanvasForDisplay(
        canvas,
        context
    );

    resizeCanvasForDisplay(
        chartCanvas,
        chartContext
    );


    positionAgentsInCircle();
    drawSimulation();
    drawChart();

}


function resizeCanvasForDisplay(
    targetCanvas,
    targetContext
) {

    const rectangle =
        targetCanvas.getBoundingClientRect();

    const pixelRatio =
        window.devicePixelRatio || 1;


    targetCanvas.width =
        Math.max(
            1,
            Math.round(
                rectangle.width
                *
                pixelRatio
            )
        );

    targetCanvas.height =
        Math.max(
            1,
            Math.round(
                rectangle.height
                *
                pixelRatio
            )
        );


    targetContext.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0
    );

}


function getCanvasSize() {

    const rectangle =
        canvas.getBoundingClientRect();

    return {
        width: rectangle.width,
        height: rectangle.height
    };

}


/*
    ============================================================
    INITIALISATION
    ============================================================
*/


function initialiseSimulation() {

    stopSimulation();

    generation = 0;
    interactionRound = 0;

    cooperationHistory = [];

    currentOutcomes = {
        cc: 0,
        cd: 0,
        dc: 0,
        dd: 0
    };

    lastRematchChangedAgents = 0;
    lastRematchStablePairs = 0;


    const population =
        makePopulationEven(
            Number(
                populationInput.value
            )
        );


    populationInput.value =
        String(population);

    populationOutput.textContent =
        String(population);


    agents = [];


    const size =
        getCanvasSize();

    const centreX =
        size.width / 2;

    const centreY =
        size.height / 2;

    const circleRadius =
        calculateAgentCircleRadius(
            size.width,
            size.height
        );


    for (
        let index = 0;
        index < population;
        index += 1
    ) {

        const angle =
            (
                Math.PI
                *
                2
                *
                index
            )
            /
            population;


        const x =
            centreX
            +
            Math.cos(angle)
            *
            circleRadius;

        const y =
            centreY
            +
            Math.sin(angle)
            *
            circleRadius;


        agents.push(
            new Agent(
                index,
                x,
                y
            )
        );

    }


    pairAllAgentsRandomly();


    cooperationHistory.push(
        calculateCooperationRate()
    );


    updateControlDisplays();
    updateModelDescription();
    updateInterface();

    drawSimulation();
    drawChart();

}


function makePopulationEven(value) {

    const rounded =
        Math.round(value);

    return rounded % 2 === 0
        ? rounded
        : rounded + 1;

}


function calculateAgentCircleRadius(
    width,
    height
) {

    const populationAdjustment =
        agents.length > 50
            ? 0.43
            : 0.39;


    return (
        Math.min(
            width,
            height
        )
        *
        populationAdjustment
    );

}


function positionAgentsInCircle() {

    if (agents.length === 0) {
        return;
    }


    const size =
        getCanvasSize();

    const centreX =
        size.width / 2;

    const centreY =
        size.height / 2;

    const circleRadius =
        calculateAgentCircleRadius(
            size.width,
            size.height
        );


    agents.forEach(
        function positionAgent(agent, index) {

            const angle =
                (
                    Math.PI
                    *
                    2
                    *
                    index
                )
                /
                agents.length;


            agent.x =
                centreX
                +
                Math.cos(angle)
                *
                circleRadius;

            agent.y =
                centreY
                +
                Math.sin(angle)
                *
                circleRadius;


            agent.radius =
                agents.length > 70
                    ? 9
                    : agents.length > 40
                        ? 12
                        : 16;

        }
    );

}


/*
    ============================================================
    ARRAY UTILITIES
    ============================================================
*/


function shuffleArray(array) {

    const copy =
        [...array];


    for (
        let index = copy.length - 1;
        index > 0;
        index -= 1
    ) {

        const randomIndex =
            Math.floor(
                Math.random()
                *
                (
                    index
                    +
                    1
                )
            );


        [
            copy[index],
            copy[randomIndex]
        ]
        =
        [
            copy[randomIndex],
            copy[index]
        ];

    }


    return copy;

}


/*
    ============================================================
    PAIR CREATION
    ============================================================
*/


function createPair(
    firstAgent,
    secondAgent,
    pairCollection = pairs
) {

    if (
        !firstAgent
        ||
        !secondAgent
        ||
        firstAgent.id === secondAgent.id
    ) {
        return;
    }


    firstAgent.partnerId =
        secondAgent.id;

    secondAgent.partnerId =
        firstAgent.id;


    pairCollection.push([
        firstAgent.id,
        secondAgent.id
    ]);

}


function pairAllAgentsRandomly() {

    pairs = [];

    pairSubsetRandomly(
        agents,
        pairs
    );

}


function pairSubsetRandomly(
    subset,
    targetPairs
) {

    const shuffled =
        shuffleArray(subset);


    for (
        let index = 0;
        index < shuffled.length;
        index += 2
    ) {

        if (!shuffled[index + 1]) {
            break;
        }


        createPair(
            shuffled[index],
            shuffled[index + 1],
            targetPairs
        );

    }

}


function pairSubsetAssortatively(
    subset,
    targetPairs
) {

    const cooperators =
        shuffleArray(
            subset.filter(
                function selectCooperators(agent) {
                    return (
                        agent.previousAction
                        ===
                        COOPERATE
                    );
                }
            )
        );


    const defectors =
        shuffleArray(
            subset.filter(
                function selectDefectors(agent) {
                    return (
                        agent.previousAction
                        ===
                        DEFECT
                    );
                }
            )
        );


    const unmatched = [];


    pairWithinBehaviourGroup(
        cooperators,
        unmatched,
        targetPairs
    );

    pairWithinBehaviourGroup(
        defectors,
        unmatched,
        targetPairs
    );


    if (unmatched.length > 1) {

        pairSubsetRandomly(
            unmatched,
            targetPairs
        );

    }

}


function pairWithinBehaviourGroup(
    group,
    unmatched,
    targetPairs
) {

    for (
        let index = 0;
        index < group.length;
        index += 2
    ) {

        if (!group[index + 1]) {

            unmatched.push(
                group[index]
            );

            continue;

        }


        createPair(
            group[index],
            group[index + 1],
            targetPairs
        );

    }

}


/*
    ============================================================
    ASSORTATIVE REMATCHING
    ============================================================
*/


function createRematchedPairs(subset) {

    const assortativity =
        Number(
            assortativityInput.value
        );


    const generatedPairs = [];


    if (
        Math.random()
        <
        assortativity
    ) {

        pairSubsetAssortatively(
            subset,
            generatedPairs
        );

    } else {

        pairSubsetRandomly(
            subset,
            generatedPairs
        );

    }


    return generatedPairs;

}


/*
    ============================================================
    BASELINE REMATCHING
    ============================================================
*/


function rematchBaseline() {

    preservePreviousPartners();


    const newPairs =
        createRematchedPairs(
            agents
        );


    pairs =
        newPairs;


    calculateRematchingStatistics();

}


/*
    ============================================================
    HYBRID PARTNER PROCESS
    ============================================================
*/


function rematchHybrid() {

    preservePreviousPartners();


    const retainedPairs = [];
    const rematchingPool = [];


    pairs.forEach(
        function evaluateCurrentPair(pair) {

            const firstAgent =
                agents[pair[0]];

            const secondAgent =
                agents[pair[1]];


            const firstDecision =
                chooseSwitchAction(
                    firstAgent
                );

            const secondDecision =
                chooseSwitchAction(
                    secondAgent
                );


            firstAgent.selectedSwitchAction =
                firstDecision;

            secondAgent.selectedSwitchAction =
                secondDecision;


            if (
                firstDecision === STAY
                &&
                secondDecision === STAY
            ) {

                createPair(
                    firstAgent,
                    secondAgent,
                    retainedPairs
                );

            } else {

                rematchingPool.push(
                    firstAgent,
                    secondAgent
                );

            }

        }
    );


    const rematchedPairs =
        createRematchedPairs(
            rematchingPool
        );


    pairs = [
        ...retainedPairs,
        ...rematchedPairs
    ];


    calculateRematchingStatistics();

}


function preservePreviousPartners() {

    agents.forEach(
        function preservePartner(agent) {

            agent.previousPartnerId =
                agent.partnerId;

        }
    );

}


function calculateRematchingStatistics() {

    lastRematchChangedAgents =
        agents.filter(
            function didAgentChangePartner(agent) {

                return (
                    agent.previousPartnerId !== null
                    &&
                    agent.previousPartnerId
                    !==
                    agent.partnerId
                );

            }
        ).length;


    lastRematchStablePairs =
        pairs.filter(
            function isRetainedPair(pair) {

                const firstAgent =
                    agents[pair[0]];

                const secondAgent =
                    agents[pair[1]];


                return (
                    firstAgent.previousPartnerId
                    ===
                    secondAgent.id
                    &&
                    secondAgent.previousPartnerId
                    ===
                    firstAgent.id
                );

            }
        ).length;

}


/*
    ============================================================
    STATE AND ACTION SELECTION
    ============================================================
*/


function determineState(
    ownPreviousAction,
    partnerPreviousAction
) {

    if (
        ownPreviousAction === COOPERATE
        &&
        partnerPreviousAction === COOPERATE
    ) {
        return 0;
    }


    if (
        ownPreviousAction === COOPERATE
        &&
        partnerPreviousAction === DEFECT
    ) {
        return 1;
    }


    if (
        ownPreviousAction === DEFECT
        &&
        partnerPreviousAction === COOPERATE
    ) {
        return 2;
    }


    return 3;

}


function boltzmannAction(
    values,
    temperature
) {

    const safeTemperature =
        Math.max(
            temperature,
            0.01
        );


    const maximum =
        Math.max(
            values[0],
            values[1]
        );


    const firstExponent =
        Math.exp(
            (
                values[0]
                -
                maximum
            )
            /
            safeTemperature
        );


    const secondExponent =
        Math.exp(
            (
                values[1]
                -
                maximum
            )
            /
            safeTemperature
        );


    const total =
        firstExponent
        +
        secondExponent;


    if (
        !Number.isFinite(total)
        ||
        total <= 0
    ) {

        return (
            Math.random() < 0.5
                ? 0
                : 1
        );

    }


    const probabilityFirst =
        firstExponent
        /
        total;


    return (
        Math.random()
        <
        probabilityFirst
    )
        ? 0
        : 1;

}


function choosePrisonersDilemmaAction(agent) {

    return boltzmannAction(
        agent.qValues[
            agent.state
        ],
        Number(
            temperatureInput.value
        )
    );

}


function chooseSwitchAction(agent) {

    return boltzmannAction(
        agent.switchQ[
            agent.state
        ],
        Number(
            temperatureInput.value
        )
    );

}


/*
    ============================================================
    PAYOFFS
    ============================================================
*/


function getRewards(
    firstAction,
    secondAction
) {

    if (
        firstAction === COOPERATE
        &&
        secondAction === COOPERATE
    ) {

        return [3, 3];

    }


    if (
        firstAction === COOPERATE
        &&
        secondAction === DEFECT
    ) {

        return [0, 5];

    }


    if (
        firstAction === DEFECT
        &&
        secondAction === COOPERATE
    ) {

        return [5, 0];

    }


    return [1, 1];

}


/*
    ============================================================
    Q-LEARNING UPDATES
    ============================================================
*/


function updateActionQValue(
    agent,
    previousState,
    action,
    reward,
    nextState
) {

    const learningRate =
        Number(
            learningRateInput.value
        );

    const discountFactor =
        Number(
            discountInput.value
        );


    const currentValue =
        agent.qValues[
            previousState
        ][action];


    const nextMaximum =
        Math.max(
            agent.qValues[
                nextState
            ][COOPERATE],
            agent.qValues[
                nextState
            ][DEFECT]
        );


    const target =
        reward
        +
        discountFactor
        *
        nextMaximum;


    agent.qValues[
        previousState
    ][action]
    =
    currentValue
    +
    learningRate
    *
    (
        target
        -
        currentValue
    );

}


function updateSwitchQValue(
    agent,
    previousState,
    switchAction
) {

    const learningRate =
        Number(
            learningRateInput.value
        );

    const discountFactor =
        Number(
            discountInput.value
        );


    /*
        Browser demonstration reward for the partner decision.

        Retaining a productive interaction receives the observed
        reward. Leaving a low-reward interaction is represented as
        comparatively useful.

        This educational approximation is not presented as the
        complete dissertation switching update.
    */

    let switchReward;


    if (switchAction === STAY) {

        switchReward =
            agent.reward;

    } else {

        switchReward =
            Math.max(
                0,
                3 - agent.reward
            );

    }


    const currentValue =
        agent.switchQ[
            previousState
        ][switchAction];


    const nextMaximum =
        Math.max(
            agent.switchQ[
                agent.state
            ][STAY],
            agent.switchQ[
                agent.state
            ][SWITCH]
        );


    const target =
        switchReward
        +
        discountFactor
        *
        nextMaximum;


    agent.switchQ[
        previousState
    ][switchAction]
    =
    currentValue
    +
    learningRate
    *
    (
        target
        -
        currentValue
    );

}


/*
    ============================================================
    ONE DEMONSTRATION STEP
    ============================================================
*/


function runGeneration() {

    generation += 1;
    interactionRound += 1;


    currentOutcomes = {
        cc: 0,
        cd: 0,
        dc: 0,
        dd: 0
    };


    agents.forEach(
        function preservePreviousAction(agent) {

            agent.previousAction =
                agent.action;

        }
    );


    pairs.forEach(
        function runPairInteraction(pair) {

            const firstAgent =
                agents[pair[0]];

            const secondAgent =
                agents[pair[1]];


            const firstPreviousState =
                determineState(
                    firstAgent.previousAction,
                    secondAgent.previousAction
                );


            const secondPreviousState =
                determineState(
                    secondAgent.previousAction,
                    firstAgent.previousAction
                );


            firstAgent.state =
                firstPreviousState;

            secondAgent.state =
                secondPreviousState;


            const firstAction =
                choosePrisonersDilemmaAction(
                    firstAgent
                );


            const secondAction =
                choosePrisonersDilemmaAction(
                    secondAgent
                );


            firstAgent.action =
                firstAction;

            secondAgent.action =
                secondAction;


            const rewards =
                getRewards(
                    firstAction,
                    secondAction
                );


            firstAgent.reward =
                rewards[0];

            secondAgent.reward =
                rewards[1];


            firstAgent.totalReward +=
                firstAgent.reward;

            secondAgent.totalReward +=
                secondAgent.reward;


            updateOutcomeCounts(
                firstAction,
                secondAction
            );


            const firstNextState =
                determineState(
                    firstAction,
                    secondAction
                );


            const secondNextState =
                determineState(
                    secondAction,
                    firstAction
                );


            updateActionQValue(
                firstAgent,
                firstPreviousState,
                firstAction,
                firstAgent.reward,
                firstNextState
            );


            updateActionQValue(
                secondAgent,
                secondPreviousState,
                secondAction,
                secondAgent.reward,
                secondNextState
            );


            firstAgent.state =
                firstNextState;

            secondAgent.state =
                secondNextState;

        }
    );


    const roundsPerInteraction =
        Number(
            roundsInput.value
        );


    if (
        interactionRound
        >=
        roundsPerInteraction
    ) {

        interactionRound = 0;


        if (
            modelSelect.value
            ===
            "hybrid"
        ) {

            /*
                Select and update partner actions before rematching.
            */

            agents.forEach(
                function prepareSwitchDecision(agent) {

                    agent.selectedSwitchAction =
                        chooseSwitchAction(
                            agent
                        );

                }
            );


            agents.forEach(
                function learnSwitchDecision(agent) {

                    updateSwitchQValue(
                        agent,
                        agent.state,
                        agent.selectedSwitchAction
                    );

                }
            );


            rematchHybrid();

        } else {

            rematchBaseline();

        }

    }


    cooperationHistory.push(
        calculateCooperationRate()
    );


    if (
        cooperationHistory.length
        >
        120
    ) {

        cooperationHistory.shift();

    }


    updateInterface();
    drawSimulation();
    drawChart();

}


/*
    ============================================================
    OUTCOME COUNTS
    ============================================================
*/


function updateOutcomeCounts(
    firstAction,
    secondAction
) {

    if (
        firstAction === COOPERATE
        &&
        secondAction === COOPERATE
    ) {

        currentOutcomes.cc += 1;
        return;

    }


    if (
        firstAction === COOPERATE
        &&
        secondAction === DEFECT
    ) {

        currentOutcomes.cd += 1;
        return;

    }


    if (
        firstAction === DEFECT
        &&
        secondAction === COOPERATE
    ) {

        currentOutcomes.dc += 1;
        return;

    }


    currentOutcomes.dd += 1;

}


/*
    ============================================================
    METRICS
    ============================================================
*/


function calculateCooperationRate() {

    if (agents.length === 0) {
        return 0;
    }


    const cooperativeAgents =
        agents.filter(
            function countCooperators(agent) {

                return (
                    agent.action
                    ===
                    COOPERATE
                );

            }
        ).length;


    return (
        cooperativeAgents
        /
        agents.length
    );

}


function calculateMeanReward() {

    if (agents.length === 0) {
        return 0;
    }


    const total =
        agents.reduce(
            function sumReward(sum, agent) {

                return (
                    sum
                    +
                    agent.reward
                );

            },
            0
        );


    return (
        total
        /
        agents.length
    );

}


function calculatePartnerChangeRate() {

    if (agents.length === 0) {
        return 0;
    }


    return (
        lastRematchChangedAgents
        /
        agents.length
    );

}


/*
    ============================================================
    INTERFACE
    ============================================================
*/


function updateInterface() {

    generationValue.textContent =
        String(generation);


    cooperationMetric.textContent =
        (
            calculateCooperationRate()
            *
            100
        ).toFixed(0)
        +
        "%";


    rewardMetric.textContent =
        calculateMeanReward()
            .toFixed(2);


    switchingMetric.textContent =
        (
            calculatePartnerChangeRate()
            *
            100
        ).toFixed(0)
        +
        "%";


    stablePairsMetric.textContent =
        String(
            lastRematchStablePairs
        );


    updateOutcomeInterface();

}


function updateOutcomeInterface() {

    const totalPairs =
        Math.max(
            currentOutcomes.cc
            +
            currentOutcomes.cd
            +
            currentOutcomes.dc
            +
            currentOutcomes.dd,
            1
        );


    ccValue.textContent =
        String(
            currentOutcomes.cc
        );

    cdValue.textContent =
        String(
            currentOutcomes.cd
        );

    dcValue.textContent =
        String(
            currentOutcomes.dc
        );

    ddValue.textContent =
        String(
            currentOutcomes.dd
        );


    setOutcomeBarWidth(
        ccBar,
        currentOutcomes.cc,
        totalPairs
    );

    setOutcomeBarWidth(
        cdBar,
        currentOutcomes.cd,
        totalPairs
    );

    setOutcomeBarWidth(
        dcBar,
        currentOutcomes.dc,
        totalPairs
    );

    setOutcomeBarWidth(
        ddBar,
        currentOutcomes.dd,
        totalPairs
    );

}


function setOutcomeBarWidth(
    element,
    value,
    total
) {

    element.style.width =
        (
            value
            /
            total
            *
            100
        )
        +
        "%";

}


/*
    ============================================================
    SIMULATION DRAWING
    ============================================================
*/


function drawSimulation() {

    const size =
        getCanvasSize();


    context.clearRect(
        0,
        0,
        size.width,
        size.height
    );


    drawBackgroundPattern(
        size.width,
        size.height
    );


    drawInteractionRing(
        size.width,
        size.height
    );


    pairs.forEach(
        function drawCurrentPair(pair) {

            const firstAgent =
                agents[pair[0]];

            const secondAgent =
                agents[pair[1]];


            if (
                firstAgent
                &&
                secondAgent
            ) {

                drawConnection(
                    firstAgent,
                    secondAgent
                );

            }

        }
    );


    agents.forEach(
        function drawAgent(agent) {

            drawSingleAgent(
                agent
            );

        }
    );

}


function drawBackgroundPattern(
    width,
    height
) {

    context.save();


    context.fillStyle =
        "rgba(123, 111, 214, 0.055)";


    for (
        let x = 25;
        x < width;
        x += 39
    ) {

        for (
            let y = 25;
            y < height;
            y += 39
        ) {

            context.beginPath();

            context.arc(
                x,
                y,
                1.15,
                0,
                Math.PI * 2
            );

            context.fill();

        }

    }


    context.restore();

}


function drawInteractionRing(
    width,
    height
) {

    context.save();


    const centreX =
        width / 2;

    const centreY =
        height / 2;

    const radius =
        calculateAgentCircleRadius(
            width,
            height
        );


    context.beginPath();

    context.arc(
        centreX,
        centreY,
        radius,
        0,
        Math.PI * 2
    );


    context.strokeStyle =
        "rgba(123, 111, 214, 0.10)";

    context.lineWidth = 1;

    context.setLineDash([
        4,
        7
    ]);

    context.stroke();

    context.restore();

}


function drawConnection(
    firstAgent,
    secondAgent
) {

    context.save();


    context.beginPath();

    context.moveTo(
        firstAgent.x,
        firstAgent.y
    );

    context.lineTo(
        secondAgent.x,
        secondAgent.y
    );


    const bothCooperate =
        firstAgent.action === COOPERATE
        &&
        secondAgent.action === COOPERATE;


    const bothDefect =
        firstAgent.action === DEFECT
        &&
        secondAgent.action === DEFECT;


    if (bothCooperate) {

        context.strokeStyle =
            "rgba(123, 111, 214, 0.70)";

        context.lineWidth = 3;

    } else if (bothDefect) {

        context.strokeStyle =
            "rgba(192, 96, 130, 0.60)";

        context.lineWidth = 2.3;

    } else {

        context.strokeStyle =
            CONNECTION_COLOUR;

        context.lineWidth = 1.5;

    }


    context.stroke();

    context.restore();

}


function drawSingleAgent(agent) {

    context.save();


    const outerRadius =
        agent.radius + 4;


    context.beginPath();

    context.arc(
        agent.x,
        agent.y,
        outerRadius,
        0,
        Math.PI * 2
    );


    context.fillStyle =
        agent.action === COOPERATE
            ? "rgba(123, 111, 214, 0.15)"
            : "rgba(192, 96, 130, 0.15)";


    context.fill();


    context.beginPath();

    context.arc(
        agent.x,
        agent.y,
        agent.radius,
        0,
        Math.PI * 2
    );


    context.fillStyle =
        agent.action === COOPERATE
            ? COOPERATE_COLOUR
            : DEFECT_COLOUR;


    context.shadowColor =
        "rgba(44, 35, 57, 0.18)";

    context.shadowBlur =
        agents.length > 50
            ? 5
            : 11;


    context.fill();

    context.shadowBlur = 0;


    if (
        agent.radius
        >=
        12
    ) {

        context.fillStyle =
            "#ffffff";

        context.font =
            agent.radius >= 15
                ? "800 11px Inter, sans-serif"
                : "800 9px Inter, sans-serif";

        context.textAlign =
            "center";

        context.textBaseline =
            "middle";


        context.fillText(
            agent.action === COOPERATE
                ? "C"
                : "D",
            agent.x,
            agent.y
        );

    }


    if (
        generation > 0
        &&
        agents.length <= 40
    ) {

        context.fillStyle =
            TEXT_COLOUR;

        context.font =
            "650 8px Inter, sans-serif";

        context.textAlign =
            "center";

        context.fillText(
            "+" + agent.reward,
            agent.x,
            agent.y - agent.radius - 10
        );

    }


    context.restore();

}


/*
    ============================================================
    CHART
    ============================================================
*/


function drawChart() {

    const rectangle =
        chartCanvas.getBoundingClientRect();

    const width =
        rectangle.width;

    const height =
        rectangle.height;


    chartContext.clearRect(
        0,
        0,
        width,
        height
    );


    const padding = {
        top: 20,
        right: 18,
        bottom: 33,
        left: 43
    };


    const chartWidth =
        Math.max(
            1,
            width
            -
            padding.left
            -
            padding.right
        );


    const chartHeight =
        Math.max(
            1,
            height
            -
            padding.top
            -
            padding.bottom
        );


    drawChartGrid(
        padding,
        chartWidth,
        chartHeight
    );


    if (
        cooperationHistory.length
        <
        2
    ) {
        return;
    }


    const modelColour =
        modelSelect.value === "baseline"
            ? BASELINE_COLOUR
            : HYBRID_COLOUR;


    const points =
        cooperationHistory.map(
            function createPoint(value, index) {

                return {
                    x:
                        padding.left
                        +
                        (
                            index
                            /
                            (
                                cooperationHistory.length
                                -
                                1
                            )
                        )
                        *
                        chartWidth,

                    y:
                        padding.top
                        +
                        (
                            1
                            -
                            value
                        )
                        *
                        chartHeight
                };

            }
        );


    chartContext.save();

    chartContext.beginPath();


    points.forEach(
        function drawPoint(point, index) {

            if (index === 0) {

                chartContext.moveTo(
                    point.x,
                    point.y
                );

            } else {

                chartContext.lineTo(
                    point.x,
                    point.y
                );

            }

        }
    );


    chartContext.strokeStyle =
        modelColour;

    chartContext.lineWidth = 3;

    chartContext.lineJoin =
        "round";

    chartContext.lineCap =
        "round";

    chartContext.stroke();


    const gradient =
        chartContext.createLinearGradient(
            0,
            padding.top,
            0,
            padding.top
            +
            chartHeight
        );


    if (
        modelSelect.value
        ===
        "baseline"
    ) {

        gradient.addColorStop(
            0,
            "rgba(192, 96, 130, 0.23)"
        );

        gradient.addColorStop(
            1,
            "rgba(192, 96, 130, 0)"
        );

    } else {

        gradient.addColorStop(
            0,
            "rgba(123, 111, 214, 0.23)"
        );

        gradient.addColorStop(
            1,
            "rgba(123, 111, 214, 0)"
        );

    }


    chartContext.lineTo(
        padding.left
        +
        chartWidth,
        padding.top
        +
        chartHeight
    );


    chartContext.lineTo(
        padding.left,
        padding.top
        +
        chartHeight
    );


    chartContext.closePath();

    chartContext.fillStyle =
        gradient;

    chartContext.fill();

    chartContext.restore();

}


function drawChartGrid(
    padding,
    chartWidth,
    chartHeight
) {

    chartContext.save();


    chartContext.font =
        "11px Inter, sans-serif";

    chartContext.fillStyle =
        "#827b88";

    chartContext.strokeStyle =
        "rgba(222, 216, 226, 0.90)";

    chartContext.lineWidth = 1;


    const values = [
        0,
        0.25,
        0.5,
        0.75,
        1
    ];


    values.forEach(
        function drawGridLine(value) {

            const y =
                padding.top
                +
                (
                    1
                    -
                    value
                )
                *
                chartHeight;


            chartContext.beginPath();

            chartContext.moveTo(
                padding.left,
                y
            );

            chartContext.lineTo(
                padding.left
                +
                chartWidth,
                y
            );

            chartContext.stroke();


            chartContext.textAlign =
                "right";


            chartContext.fillText(
                Math.round(
                    value
                    *
                    100
                )
                +
                "%",
                padding.left - 8,
                y + 4
            );

        }
    );


    chartContext.textAlign =
        "left";

    chartContext.fillText(
        "Earlier",
        padding.left,
        padding.top
        +
        chartHeight
        +
        23
    );


    chartContext.textAlign =
        "right";

    chartContext.fillText(
        "Current",
        padding.left
        +
        chartWidth,
        padding.top
        +
        chartHeight
        +
        23
    );


    chartContext.restore();

}


/*
    ============================================================
    RUN, PAUSE AND SPEED
    ============================================================
*/


function startSimulation() {

    if (isRunning) {

        stopSimulation();
        return;

    }


    isRunning = true;

    runButton.textContent =
        "Pause";

    statusText.textContent =
        "Running";

    statusDot.classList.add(
        "running"
    );


    scheduleNextGeneration();

}


function scheduleNextGeneration() {

    if (!isRunning) {
        return;
    }


    runGeneration();


    const speed =
        Number(
            speedInput.value
        );


    const interval =
        1120
        -
        speed
        *
        190;


    simulationTimer =
        window.setTimeout(
            scheduleNextGeneration,
            Math.max(
                interval,
                140
            )
        );

}


function stopSimulation() {

    isRunning = false;

    runButton.textContent =
        "Run";


    statusText.textContent =
        generation === 0
            ? "Ready"
            : "Paused";


    statusDot.classList.remove(
        "running"
    );


    if (simulationTimer !== null) {

        window.clearTimeout(
            simulationTimer
        );

        simulationTimer = null;

    }

}


/*
    ============================================================
    CONTROL DISPLAY
    ============================================================
*/


function updateControlDisplays() {

    populationOutput.textContent =
        populationInput.value;


    assortativityOutput.textContent =
        Number(
            assortativityInput.value
        ).toFixed(2);


    learningRateOutput.textContent =
        Number(
            learningRateInput.value
        ).toFixed(2);


    discountOutput.textContent =
        Number(
            discountInput.value
        ).toFixed(2);


    temperatureOutput.textContent =
        Number(
            temperatureInput.value
        ).toFixed(2);


    roundsOutput.textContent =
        roundsInput.value;


    speedOutput.textContent =
        speedInput.value
        +
        "×";


    canvasAssortativity.textContent =
        "m = "
        +
        Number(
            assortativityInput.value
        ).toFixed(2);

}


function updateModelDescription() {

    if (
        modelSelect.value
        ===
        "baseline"
    ) {

        modelExplanation.textContent =
            "Agents learn Prisoner's Dilemma actions but do not learn a separate stay-or-switch policy. Rematching is random with probability 1 − m and assortative with probability m.";

        chartModelLabel.textContent =
            "Baseline";

        chartModelLabel.style.color =
            "#9f4968";

        chartModelLabel.style.background =
            "#f8e7ed";

        canvasModelName.textContent =
            "Baseline model";

    } else {

        modelExplanation.textContent =
            "Agents learn both Prisoner's Dilemma actions and whether to remain with or leave their current partner. Agents entering the pool are rematched randomly or assortatively.";

        chartModelLabel.textContent =
            "Hybrid";

        chartModelLabel.style.color =
            "#5d51bd";

        chartModelLabel.style.background =
            "#ece9fb";

        canvasModelName.textContent =
            "Hybrid model";

    }


    drawChart();

}


/*
    ============================================================
    RESEARCH DEFAULT PRESET
    ============================================================
*/


function applyResearchDefaults() {

    stopSimulation();


    modelSelect.value =
        "hybrid";

    populationInput.value =
        "20";

    assortativityInput.value =
        "1";

    learningRateInput.value =
        "0.05";

    discountInput.value =
        "1";

    temperatureInput.value =
        "1";

    roundsInput.value =
        "20";

    speedInput.value =
        "3";


    updateControlDisplays();
    updateModelDescription();
    initialiseSimulation();

}


/*
    ============================================================
    EVENTS
    ============================================================
*/


runButton.addEventListener(
    "click",
    startSimulation
);


stepButton.addEventListener(
    "click",
    function stepSimulation() {

        stopSimulation();
        runGeneration();

    }
);


resetButton.addEventListener(
    "click",
    initialiseSimulation
);


defaultPresetButton.addEventListener(
    "click",
    applyResearchDefaults
);


populationInput.addEventListener(
    "input",
    updateControlDisplays
);


populationInput.addEventListener(
    "change",
    initialiseSimulation
);


assortativityInput.addEventListener(
    "input",
    function assortativityChanged() {

        updateControlDisplays();

    }
);


learningRateInput.addEventListener(
    "input",
    updateControlDisplays
);


discountInput.addEventListener(
    "input",
    updateControlDisplays
);


temperatureInput.addEventListener(
    "input",
    updateControlDisplays
);


roundsInput.addEventListener(
    "input",
    updateControlDisplays
);


speedInput.addEventListener(
    "input",
    updateControlDisplays
);


modelSelect.addEventListener(
    "change",
    function modelChanged() {

        updateModelDescription();
        initialiseSimulation();

    }
);


mobileMenuButton.addEventListener(
    "click",
    function toggleMobileMenu() {

        const navigationIsOpen =
            navigation.classList.toggle(
                "open"
            );


        mobileMenuButton.setAttribute(
            "aria-expanded",
            String(
                navigationIsOpen
            )
        );

    }
);


navigation
    .querySelectorAll("a")
    .forEach(
        function addNavigationListener(link) {

            link.addEventListener(
                "click",
                function closeNavigation() {

                    navigation.classList.remove(
                        "open"
                    );


                    mobileMenuButton.setAttribute(
                        "aria-expanded",
                        "false"
                    );

                }
            );

        }
    );


window.addEventListener(
    "resize",
    resizeCanvases
);


/*
    ============================================================
    START-UP
    ============================================================
*/


updateControlDisplays();
updateModelDescription();
resizeCanvases();
initialiseSimulation();