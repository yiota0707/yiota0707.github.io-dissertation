"use strict";


/*
    Interactive MARL demonstration
    --------------------------------
    This is a browser-based educational representation of the
    mechanisms used in the dissertation.

    Cooperation colour: #7b6fd6
    Defection colour: #c06082
*/


const COOPERATE = 0;
const DEFECT = 1;

const COOPERATE_COLOUR = "#7b6fd6";
const DEFECT_COLOUR = "#c06082";
const CONNECTION_COLOUR = "#bbb5c0";
const TEXT_COLOUR = "#211d28";


const canvas = document.getElementById("agentCanvas");
const context = canvas.getContext("2d");

const chartCanvas = document.getElementById("cooperationChart");
const chartContext = chartCanvas.getContext("2d");


const modelSelect =
    document.getElementById("modelSelect");

const populationInput =
    document.getElementById("populationInput");

const assortativityInput =
    document.getElementById("assortativityInput");

const learningRateInput =
    document.getElementById("learningRateInput");

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


let agents = [];
let pairs = [];

let generation = 0;
let isRunning = false;
let simulationTimer = null;

let cooperationHistory = [];
let currentOutcomes = {
    cc: 0,
    cd: 0,
    dc: 0,
    dd: 0
};


class Agent {

    constructor(id, x, y) {

        this.id = id;

        this.x = x;
        this.y = y;

        this.targetX = x;
        this.targetY = y;

        this.radius = 17;

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

        this.switched = false;


        /*
            State values:

            0 = previous self C, previous partner C
            1 = previous self C, previous partner D
            2 = previous self D, previous partner C
            3 = previous self D, previous partner D
        */

        this.state = 0;


        /*
            Two Q-values per state:

            action 0 = cooperate
            action 1 = defect
        */

        this.qValues = [
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0]
        ];


        /*
            Hybrid switching values:

            0 = stay
            1 = switch
        */

        this.switchQ = [
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0]
        ];

    }

}


function resizeCanvases() {

    const agentRectangle =
        canvas.getBoundingClientRect();

    const agentPixelRatio =
        window.devicePixelRatio || 1;

    canvas.width =
        agentRectangle.width
        *
        agentPixelRatio;

    canvas.height =
        agentRectangle.height
        *
        agentPixelRatio;

    context.setTransform(
        agentPixelRatio,
        0,
        0,
        agentPixelRatio,
        0,
        0
    );


    const chartRectangle =
        chartCanvas.getBoundingClientRect();

    const chartPixelRatio =
        window.devicePixelRatio || 1;

    chartCanvas.width =
        chartRectangle.width
        *
        chartPixelRatio;

    chartCanvas.height =
        chartRectangle.height
        *
        chartPixelRatio;

    chartContext.setTransform(
        chartPixelRatio,
        0,
        0,
        chartPixelRatio,
        0,
        0
    );


    positionAgentsInCircle();
    drawSimulation();
    drawChart();

}


function getCanvasSize() {

    const rectangle =
        canvas.getBoundingClientRect();

    return {
        width: rectangle.width,
        height: rectangle.height
    };

}


function initialiseSimulation() {

    stopSimulation();

    generation = 0;

    cooperationHistory = [];

    currentOutcomes = {
        cc: 0,
        cd: 0,
        dc: 0,
        dd: 0
    };


    const population =
        Number(populationInput.value);

    agents = [];


    const size =
        getCanvasSize();

    const centreX =
        size.width / 2;

    const centreY =
        size.height / 2;

    const circleRadius =
        Math.min(
            size.width,
            size.height
        )
        *
        0.36;


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


    pairAgentsRandomly();

    cooperationHistory.push(
        calculateCooperationRate()
    );


    updateInterface();
    drawSimulation();
    drawChart();

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
        Math.min(
            size.width,
            size.height
        )
        *
        0.36;


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

            agent.targetX =
                agent.x;

            agent.targetY =
                agent.y;

        }
    );

}


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


function pairAgentsRandomly() {

    const shuffledAgents =
        shuffleArray(agents);


    pairs = [];


    for (
        let index = 0;
        index < shuffledAgents.length;
        index += 2
    ) {

        if (!shuffledAgents[index + 1]) {
            continue;
        }


        const firstAgent =
            shuffledAgents[index];

        const secondAgent =
            shuffledAgents[index + 1];


        createPair(
            firstAgent,
            secondAgent
        );

    }

}


function createPair(firstAgent, secondAgent) {

    firstAgent.previousPartnerId =
        firstAgent.partnerId;

    secondAgent.previousPartnerId =
        secondAgent.partnerId;


    firstAgent.partnerId =
        secondAgent.id;

    secondAgent.partnerId =
        firstAgent.id;


    firstAgent.switched =
        firstAgent.previousPartnerId !== null
        &&
        firstAgent.previousPartnerId !== secondAgent.id;

    secondAgent.switched =
        secondAgent.previousPartnerId !== null
        &&
        secondAgent.previousPartnerId !== firstAgent.id;


    pairs.push([
        firstAgent.id,
        secondAgent.id
    ]);

}


function pairAgentsAssortatively() {

    const cooperators =
        shuffleArray(
            agents.filter(
                function filterCooperators(agent) {
                    return agent.action === COOPERATE;
                }
            )
        );


    const defectors =
        shuffleArray(
            agents.filter(
                function filterDefectors(agent) {
                    return agent.action === DEFECT;
                }
            )
        );


    const unmatched = [];

    pairs = [];


    pairWithinGroup(
        cooperators,
        unmatched
    );

    pairWithinGroup(
        defectors,
        unmatched
    );


    const shuffledUnmatched =
        shuffleArray(unmatched);


    for (
        let index = 0;
        index < shuffledUnmatched.length;
        index += 2
    ) {

        if (!shuffledUnmatched[index + 1]) {
            continue;
        }


        createPair(
            shuffledUnmatched[index],
            shuffledUnmatched[index + 1]
        );

    }

}


function pairWithinGroup(group, unmatched) {

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
            group[index + 1]
        );

    }

}


function rematchAgents() {

    const assortativity =
        Number(
            assortativityInput.value
        );


    const model =
        modelSelect.value;


    if (model === "baseline") {

        /*
            Baseline representation:

            Rematching is controlled directly by the assortativity
            probability.
        */

        if (
            Math.random()
            <
            assortativity
        ) {

            pairAgentsAssortatively();

        } else {

            pairAgentsRandomly();

        }

        return;

    }


    /*
        Hybrid representation:

        Agents first express learned switching decisions.

        Agents that remain together keep their pair where possible.
        Switching agents are then rematched.
    */

    const stayingPairs = [];
    const switchingAgents = [];


    pairs.forEach(
        function evaluatePair(pair) {

            const firstAgent =
                agents[pair[0]];

            const secondAgent =
                agents[pair[1]];


            const firstSwitch =
                chooseSwitchAction(
                    firstAgent
                );

            const secondSwitch =
                chooseSwitchAction(
                    secondAgent
                );


            if (
                !firstSwitch
                &&
                !secondSwitch
            ) {

                stayingPairs.push([
                    firstAgent,
                    secondAgent
                ]);

            } else {

                switchingAgents.push(
                    firstAgent,
                    secondAgent
                );

            }

        }
    );


    pairs = [];


    stayingPairs.forEach(
        function keepPair(pair) {

            createPair(
                pair[0],
                pair[1]
            );

        }
    );


    if (
        switchingAgents.length
        >
        1
    ) {

        if (
            Math.random()
            <
            assortativity
        ) {

            pairSubsetAssortatively(
                switchingAgents
            );

        } else {

            pairSubsetRandomly(
                switchingAgents
            );

        }

    }

}


function pairSubsetRandomly(subset) {

    const shuffled =
        shuffleArray(subset);


    for (
        let index = 0;
        index < shuffled.length;
        index += 2
    ) {

        if (!shuffled[index + 1]) {
            continue;
        }


        createPair(
            shuffled[index],
            shuffled[index + 1]
        );

    }

}


function pairSubsetAssortatively(subset) {

    const cooperators =
        shuffleArray(
            subset.filter(
                function filterCooperators(agent) {
                    return agent.action === COOPERATE;
                }
            )
        );


    const defectors =
        shuffleArray(
            subset.filter(
                function filterDefectors(agent) {
                    return agent.action === DEFECT;
                }
            )
        );


    const unmatched = [];


    pairWithinGroup(
        cooperators,
        unmatched
    );

    pairWithinGroup(
        defectors,
        unmatched
    );


    pairSubsetRandomly(
        unmatched
    );

}


function chooseSwitchAction(agent) {

    const temperature =
        Number(
            temperatureInput.value
        );


    const values =
        agent.switchQ[agent.state];


    return (
        boltzmannAction(
            values,
            temperature
        )
        ===
        1
    );

}


function boltzmannAction(values, temperature) {

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


function runGeneration() {

    generation += 1;


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


            firstAgent.state =
                determineState(
                    firstAgent.previousAction,
                    secondAgent.previousAction
                );


            secondAgent.state =
                determineState(
                    secondAgent.previousAction,
                    firstAgent.previousAction
                );


            firstAgent.action =
                boltzmannAction(
                    firstAgent.qValues[
                        firstAgent.state
                    ],
                    Number(
                        temperatureInput.value
                    )
                );


            secondAgent.action =
                boltzmannAction(
                    secondAgent.qValues[
                        secondAgent.state
                    ],
                    Number(
                        temperatureInput.value
                    )
                );


            const rewards =
                getRewards(
                    firstAgent.action,
                    secondAgent.action
                );


            firstAgent.reward =
                rewards[0];

            secondAgent.reward =
                rewards[1];


            firstAgent.totalReward +=
                rewards[0];

            secondAgent.totalReward +=
                rewards[1];


            updateOutcomeCounts(
                firstAgent.action,
                secondAgent.action
            );


            updateQValue(
                firstAgent,
                firstAgent.action,
                firstAgent.reward
            );


            updateQValue(
                secondAgent,
                secondAgent.action,
                secondAgent.reward
            );


            if (
                modelSelect.value
                ===
                "hybrid"
            ) {

                updateSwitchQValue(
                    firstAgent
                );

                updateSwitchQValue(
                    secondAgent
                );

            }

        }
    );


    const roundsPerPartner =
        Number(
            roundsInput.value
        );


    if (
        generation
        %
        roundsPerPartner
        ===
        0
    ) {

        rematchAgents();

    }


    cooperationHistory.push(
        calculateCooperationRate()
    );


    if (
        cooperationHistory.length
        >
        100
    ) {

        cooperationHistory.shift();

    }


    updateInterface();
    drawSimulation();
    drawChart();

}


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


function updateQValue(
    agent,
    action,
    reward
) {

    const learningRate =
        Number(
            learningRateInput.value
        );


    const currentValue =
        agent.qValues[
            agent.state
        ][action];


    /*
        Immediate-reward Q update for the browser demonstration.
    */

    agent.qValues[
        agent.state
    ][action]
    =
    currentValue
    +
    learningRate
    *
    (
        reward
        -
        currentValue
    );

}


function updateSwitchQValue(agent) {

    const learningRate =
        Number(
            learningRateInput.value
        );


    /*
        Staying is given action index 0.
        Switching is given action index 1.

        Low rewards make switching comparatively more attractive.
    */

    const switchingAction =
        agent.reward < 2
            ? 1
            : 0;


    const switchingReward =
        switchingAction === 1
            ? 3 - agent.reward
            : agent.reward;


    const currentValue =
        agent.switchQ[
            agent.state
        ][switchingAction];


    agent.switchQ[
        agent.state
    ][switchingAction]
    =
    currentValue
    +
    learningRate
    *
    (
        switchingReward
        -
        currentValue
    );

}


function calculateCooperationRate() {

    if (
        agents.length
        ===
        0
    ) {
        return 0;
    }


    const cooperativeAgents =
        agents.filter(
            function countCooperators(agent) {
                return agent.action === COOPERATE;
            }
        ).length;


    return (
        cooperativeAgents
        /
        agents.length
    );

}


function calculateMeanReward() {

    if (
        agents.length
        ===
        0
    ) {
        return 0;
    }


    const total =
        agents.reduce(
            function addReward(sum, agent) {
                return sum + agent.reward;
            },
            0
        );


    return (
        total
        /
        agents.length
    );

}


function calculateSwitchingRate() {

    if (
        agents.length
        ===
        0
    ) {
        return 0;
    }


    const switchedAgents =
        agents.filter(
            function countSwitching(agent) {
                return agent.switched;
            }
        ).length;


    return (
        switchedAgents
        /
        agents.length
    );

}


function calculateStablePairs() {

    return pairs.filter(
        function countStablePairs(pair) {

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


function updateInterface() {

    generationValue.textContent =
        generation;


    cooperationMetric.textContent =
        Math.round(
            calculateCooperationRate()
            *
            100
        )
        +
        "%";


    rewardMetric.textContent =
        calculateMeanReward()
            .toFixed(2);


    switchingMetric.textContent =
        Math.round(
            calculateSwitchingRate()
            *
            100
        )
        +
        "%";


    stablePairsMetric.textContent =
        calculateStablePairs();


    updateOutcomeInterface();

}


function updateOutcomeInterface() {

    const totalPairs =
        Math.max(
            pairs.length,
            1
        );


    ccValue.textContent =
        currentOutcomes.cc;

    cdValue.textContent =
        currentOutcomes.cd;

    dcValue.textContent =
        currentOutcomes.dc;

    ddValue.textContent =
        currentOutcomes.dd;


    ccBar.style.width =
        (
            currentOutcomes.cc
            /
            totalPairs
            *
            100
        )
        +
        "%";


    cdBar.style.width =
        (
            currentOutcomes.cd
            /
            totalPairs
            *
            100
        )
        +
        "%";


    dcBar.style.width =
        (
            currentOutcomes.dc
            /
            totalPairs
            *
            100
        )
        +
        "%";


    ddBar.style.width =
        (
            currentOutcomes.dd
            /
            totalPairs
            *
            100
        )
        +
        "%";

}


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


    pairs.forEach(
        function drawPair(pair) {

            const firstAgent =
                agents[pair[0]];

            const secondAgent =
                agents[pair[1]];


            drawConnection(
                firstAgent,
                secondAgent
            );

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
        let x = 30;
        x < width;
        x += 42
    ) {

        for (
            let y = 30;
            y < height;
            y += 42
        ) {

            context.beginPath();

            context.arc(
                x,
                y,
                1.25,
                0,
                Math.PI * 2
            );

            context.fill();

        }

    }


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
            "rgba(123, 111, 214, 0.65)";

        context.lineWidth = 3;

    } else if (bothDefect) {

        context.strokeStyle =
            "rgba(192, 96, 130, 0.55)";

        context.lineWidth = 2;

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


    context.beginPath();

    context.arc(
        agent.x,
        agent.y,
        agent.radius + 5,
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

    context.shadowBlur = 12;

    context.fill();


    context.shadowBlur = 0;


    context.fillStyle = "#ffffff";

    context.font =
        "800 12px Inter, sans-serif";

    context.textAlign = "center";
    context.textBaseline = "middle";


    context.fillText(
        agent.action === COOPERATE
            ? "C"
            : "D",
        agent.x,
        agent.y
    );


    if (
        generation
        >
        0
    ) {

        context.fillStyle =
            TEXT_COLOUR;

        context.font =
            "650 9px Inter, sans-serif";

        context.fillText(
            "+" + agent.reward,
            agent.x,
            agent.y - 29
        );

    }


    context.restore();

}


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
        bottom: 32,
        left: 42
    };


    const chartWidth =
        width
        -
        padding.left
        -
        padding.right;

    const chartHeight =
        height
        -
        padding.top
        -
        padding.bottom;


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


    chartContext.save();

    chartContext.beginPath();


    cooperationHistory.forEach(
        function drawPoint(value, index) {

            const x =
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
                chartWidth;


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


            if (
                index
                ===
                0
            ) {

                chartContext.moveTo(
                    x,
                    y
                );

            } else {

                chartContext.lineTo(
                    x,
                    y
                );

            }

        }
    );


    chartContext.strokeStyle =
        modelSelect.value === "baseline"
            ? DEFECT_COLOUR
            : COOPERATE_COLOUR;


    chartContext.lineWidth = 3;

    chartContext.lineJoin = "round";
    chartContext.lineCap = "round";

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
            "rgba(192, 96, 130, 0.22)"
        );

        gradient.addColorStop(
            1,
            "rgba(192, 96, 130, 0)"
        );

    } else {

        gradient.addColorStop(
            0,
            "rgba(123, 111, 214, 0.22)"
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
        "rgba(222, 216, 226, 0.9)";

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


            chartContext.textAlign = "right";

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


    chartContext.textAlign = "left";

    chartContext.fillText(
        "Older",
        padding.left,
        padding.top + chartHeight + 23
    );


    chartContext.textAlign = "right";

    chartContext.fillText(
        "Current",
        padding.left + chartWidth,
        padding.top + chartHeight + 23
    );


    chartContext.restore();

}


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
        1100
        -
        speed
        *
        185;


    simulationTimer =
        window.setTimeout(
            scheduleNextGeneration,
            Math.max(
                interval,
                130
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


    if (simulationTimer) {

        window.clearTimeout(
            simulationTimer
        );

        simulationTimer = null;

    }

}


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

}


function updateModelDescription() {

    if (
        modelSelect.value
        ===
        "baseline"
    ) {

        modelExplanation.textContent =
            "Agents are rematched without learning a separate partner-switching policy.";

        chartModelLabel.textContent =
            "Baseline";

        chartModelLabel.style.color =
            "#9f4968";

        chartModelLabel.style.background =
            "#f8e7ed";

    } else {

        modelExplanation.textContent =
            "Agents learn whether to remain with or leave their current interaction partner.";

        chartModelLabel.textContent =
            "Hybrid";

        chartModelLabel.style.color =
            "#5d51bd";

        chartModelLabel.style.background =
            "#ece9fb";

    }


    drawChart();

}


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


populationInput.addEventListener(
    "input",
    function populationChanged() {

        updateControlDisplays();

    }
);


populationInput.addEventListener(
    "change",
    initialiseSimulation
);


assortativityInput.addEventListener(
    "input",
    updateControlDisplays
);


learningRateInput.addEventListener(
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

        navigation.classList.toggle(
            "open"
        );

    }
);


navigation.querySelectorAll("a").forEach(
    function addNavigationListener(link) {

        link.addEventListener(
            "click",
            function closeNavigation() {

                navigation.classList.remove(
                    "open"
                );

            }
        );

    }
);


window.addEventListener(
    "resize",
    resizeCanvases
);


updateControlDisplays();
updateModelDescription();
resizeCanvases();
initialiseSimulation();