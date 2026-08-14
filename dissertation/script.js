"use strict";


/* =========================================================
   BASIC SETTINGS
========================================================= */

const N = 20;

const BASELINE_COLOUR = "#c06082";
const HYBRID_COLOUR = "#7b6fd6";

let m = 0.7;

let running = false;
let paused = false;

let stage = 0;

let timer = null;


/* =========================================================
   RANDOM HELPERS
========================================================= */

function shuffle(array) {

    const output = [...array];

    for (let i = output.length - 1; i > 0; i--) {

        const j = Math.floor(
            Math.random() * (i + 1)
        );

        [
            output[i],
            output[j]
        ] = [
            output[j],
            output[i]
        ];
    }

    return output;
}


function wait(callback, time = 1800) {

    clearTimeout(timer);

    timer = setTimeout(() => {

        if (!running || paused) {
            return;
        }

        callback();

    }, time);
}


/* =========================================================
   MODEL CREATION
========================================================= */

function createModel(type) {

    const agents = [];

    for (let i = 0; i < N; i++) {

        agents.push({

            id: i,

            action:
                Math.random() < 0.5
                    ? "C"
                    : "D",

            decision: null,

            retained: false,

            inPool: false
        });
    }


    return {

        type,

        agents,

        pairs: makeRandomPairs(
            agents.map(a => a.id)
        ),

        oldPairs: []
    };
}


let baseline = createModel("baseline");
let hybrid = createModel("hybrid");


/* =========================================================
   PAIRING
========================================================= */

function makeRandomPairs(ids) {

    const shuffled = shuffle(ids);

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


/*
    Assortative matching in this visualisation uses
    the previous PD action:

        C with C
        D with D

    where possible.
*/

function makeAssortativePairs(ids, model) {

    const cooperators = [];
    const defectors = [];


    ids.forEach(id => {

        if (model.agents[id].action === "C") {

            cooperators.push(id);

        } else {

            defectors.push(id);
        }
    });


    const c = shuffle(cooperators);
    const d = shuffle(defectors);

    const pairs = [];
    const leftovers = [];


    while (c.length >= 2) {

        pairs.push([
            c.shift(),
            c.shift()
        ]);
    }


    if (c.length === 1) {

        leftovers.push(
            c.shift()
        );
    }


    while (d.length >= 2) {

        pairs.push([
            d.shift(),
            d.shift()
        ]);
    }


    if (d.length === 1) {

        leftovers.push(
            d.shift()
        );
    }


    if (leftovers.length === 2) {

        pairs.push([
            leftovers[0],
            leftovers[1]
        ]);
    }


    return pairs;
}


/*
    m determines whether the current rematching event
    is assortative or random.
*/

function rematch(ids, model) {

    const assortative =
        Math.random() < m;


    const pairs =
        assortative

            ? makeAssortativePairs(
                ids,
                model
            )

            : makeRandomPairs(ids);


    return {
        pairs,
        assortative
    };
}


/* =========================================================
   PAIR POSITIONS
========================================================= */

const PAIR_POSITIONS = [

    [24, 18],
    [76, 18],

    [24, 35],
    [76, 35],

    [24, 52],
    [76, 52],

    [24, 69],
    [76, 69],

    [24, 86],
    [76, 86]

];


function getPairTargets(pairs) {

    const positions = {};


    pairs.forEach((pair, index) => {

        const slot =
            PAIR_POSITIONS[index];

        if (!slot) return;


        positions[pair[0]] = {

            x: slot[0] - 5,

            y: slot[1]
        };


        positions[pair[1]] = {

            x: slot[0] + 5,

            y: slot[1]
        };
    });


    return positions;
}


/* =========================================================
   REMATCHING POOL POSITIONS
========================================================= */

function getPoolPositions(ids) {

    const positions = {};

    const columns = 5;

    const startX = 36;
    const startY = 43;

    const gapX = 7;
    const gapY = 12;


    ids.forEach((id, index) => {

        const row =
            Math.floor(
                index / columns
            );

        const column =
            index % columns;


        positions[id] = {

            x:
                startX +
                column * gapX,

            y:
                startY +
                row * gapY
        };
    });


    return positions;
}


/* =========================================================
   CREATE HTML AGENTS
========================================================= */

function createAgentElements(model, containerId) {

    const container =
        document.getElementById(
            containerId
        );


    container.innerHTML = "";


    model.agents.forEach(agent => {

        const element =
            document.createElement(
                "div"
            );


        element.className =
            `agent ${model.type}`;


        element.id =
            `${model.type}-agent-${agent.id}`;


        element.innerHTML = `
            <span class="agent-action">
                ${agent.action}
            </span>

            <span class="agent-number">
                ${agent.id + 1}
            </span>
        `;


        container.appendChild(
            element
        );
    });
}


/* =========================================================
   UPDATE AGENT APPEARANCE
========================================================= */

function updateAgentAppearance(model) {

    model.agents.forEach(agent => {

        const element =
            document.getElementById(
                `${model.type}-agent-${agent.id}`
            );


        if (!element) return;


        element.classList.toggle(
            "cooperate",
            agent.action === "C"
        );


        element.classList.toggle(
            "defect",
            agent.action === "D"
        );


        element.classList.toggle(
            "in-pool",
            agent.inPool
        );


        element.classList.toggle(
            "retained",
            agent.retained
        );


        element
            .querySelector(
                ".agent-action"
            )
            .textContent =
                agent.action;
    });
}


/* =========================================================
   MOVE AGENTS
========================================================= */

function moveToPairs(model) {

    const positions =
        getPairTargets(
            model.pairs
        );


    model.agents.forEach(agent => {

        const element =
            document.getElementById(
                `${model.type}-agent-${agent.id}`
            );


        const position =
            positions[agent.id];


        if (!position) return;


        element.style.left =
            `${position.x}%`;


        element.style.top =
            `${position.y}%`;
    });
}


function moveAgentsToPool(
    model,
    ids
) {

    const positions =
        getPoolPositions(ids);


    ids.forEach(id => {

        const element =
            document.getElementById(
                `${model.type}-agent-${id}`
            );


        const position =
            positions[id];


        element.style.left =
            `${position.x}%`;


        element.style.top =
            `${position.y}%`;
    });
}


/* =========================================================
   DRAW PARTNERSHIP LINES
========================================================= */

function drawLines(
    model,
    svgId,
    colour,
    onlyPairs = null
) {

    const svg =
        document.getElementById(
            svgId
        );


    svg.innerHTML = "";


    const rect =
        svg.getBoundingClientRect();


    if (
        rect.width === 0 ||
        rect.height === 0
    ) {
        return;
    }


    svg.setAttribute(
        "viewBox",
        `0 0 ${rect.width} ${rect.height}`
    );


    const positions =
        getPairTargets(
            model.pairs
        );


    const pairs =
        onlyPairs || model.pairs;


    pairs.forEach(pair => {

        const p1 =
            positions[pair[0]];

        const p2 =
            positions[pair[1]];


        if (!p1 || !p2) {
            return;
        }


        const line =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line"
            );


        line.setAttribute(
            "x1",
            p1.x / 100 * rect.width
        );


        line.setAttribute(
            "y1",
            p1.y / 100 * rect.height
        );


        line.setAttribute(
            "x2",
            p2.x / 100 * rect.width
        );


        line.setAttribute(
            "y2",
            p2.y / 100 * rect.height
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
            "stroke-linecap",
            "round"
        );


        line.setAttribute(
            "stroke-opacity",
            "0.55"
        );


        svg.appendChild(line);
    });
}


/* =========================================================
   FLOW HIGHLIGHT
========================================================= */

function clearFlow() {

    document
        .querySelectorAll(
            ".flow-item"
        )
        .forEach(item => {

            item.classList.remove(
                "active"
            );
        });
}


function activateFlow(id) {

    clearFlow();


    const element =
        document.getElementById(id);


    if (element) {

        element.classList.add(
            "active"
        );
    }
}


/* =========================================================
   STAGE INDICATOR
========================================================= */

function setStage(
    text,
    dot
) {

    document.getElementById(
        "stageText"
    ).textContent = text;


    document
        .querySelectorAll(
            ".stage-dot"
        )
        .forEach(element => {

            element.classList.remove(
                "active"
            );
        });


    if (dot) {

        document
            .getElementById(dot)
            .classList.add(
                "active"
            );
    }
}


/* =========================================================
   MESSAGE HELPERS
========================================================= */

function baselineMessage(text) {

    document.getElementById(
        "baselineMessage"
    ).textContent = text;
}


function hybridMessage(text) {

    document.getElementById(
        "hybridMessage"
    ).textContent = text;
}


function baselineExplanation(text) {

    document.getElementById(
        "baselineExplanation"
    ).textContent = text;
}


function hybridExplanation(text) {

    document.getElementById(
        "hybridExplanation"
    ).textContent = text;
}


/* =========================================================
   POOL VISIBILITY
========================================================= */

function showPool(type, visible) {

    document
        .getElementById(
            `${type}Pool`
        )
        .classList.toggle(
            "visible",
            visible
        );
}


/* =========================================================
   HYBRID DECISION BADGES
========================================================= */

function clearDecisionBadges() {

    document
        .querySelectorAll(
            ".decision-badge"
        )
        .forEach(element => {

            element.remove();
        });
}


function addDecisionBadge(
    type,
    x,
    y,
    text,
    badgeClass
) {

    const wrapper =
        document.querySelector(
            `.${type}-side .simulation-wrapper`
        );


    const badge =
        document.createElement(
            "div"
        );


    badge.className =
        `decision-badge ${badgeClass}`;


    badge.style.left =
        `${x}%`;


    badge.style.top =
        `${y}%`;


    badge.textContent =
        text;


    wrapper.appendChild(
        badge
    );
}


/* =========================================================
   SIMULATED PD ACTIONS
========================================================= */

function updateActions(model) {

    /*
        This website demonstrates the interaction mechanism.

        C/D outcomes change between cycles so the user can
        see how behavioural assortativity affects rematching.
    */

    model.agents.forEach(agent => {

        const current =
            agent.action;


        if (current === "C") {

            agent.action =
                Math.random() < 0.78
                    ? "C"
                    : "D";

        } else {

            agent.action =
                Math.random() < 0.42
                    ? "C"
                    : "D";
        }
    });


    updateAgentAppearance(
        model
    );
}


/* =========================================================
   HYBRID STAY / SWITCH
========================================================= */

function chooseHybridDecisions() {

    const retainedPairs = [];
    const switchingIds = [];


    hybrid.agents.forEach(agent => {

        agent.retained = false;
        agent.inPool = false;
        agent.decision = null;
    });


    hybrid.pairs.forEach((pair, index) => {

        const a =
            hybrid.agents[
                pair[0]
            ];


        const b =
            hybrid.agents[
                pair[1]
            ];


        /*
            Visual representation of the learned decision.

            Cooperative partnerships are more likely to
            demonstrate retention; partnerships containing
            defection are more likely to demonstrate switching.
        */

        const aStayProbability =
            b.action === "C"
                ? 0.86
                : 0.28;


        const bStayProbability =
            a.action === "C"
                ? 0.86
                : 0.28;


        a.decision =
            Math.random() <
            aStayProbability
                ? "STAY"
                : "SWITCH";


        b.decision =
            Math.random() <
            bStayProbability
                ? "STAY"
                : "SWITCH";


        const retained =
            a.decision === "STAY" &&
            b.decision === "STAY";


        const slot =
            PAIR_POSITIONS[index];


        if (retained) {

            a.retained = true;
            b.retained = true;


            retainedPairs.push(
                pair
            );


            addDecisionBadge(
                "hybrid",
                slot[0],
                slot[1] - 7,
                "BOTH STAY",
                "stay-badge"
            );

        } else {

            a.inPool = true;
            b.inPool = true;


            switchingIds.push(
                a.id,
                b.id
            );


            addDecisionBadge(
                "hybrid",
                slot[0],
                slot[1] - 7,
                "SWITCH",
                "switch-badge"
            );
        }
    });


    return {

        retainedPairs,

        switchingIds
    };
}


/* =========================================================
   CYCLE DATA
========================================================= */

let hybridDecisionData = null;


/* =========================================================
   STAGE 1 — PLAY
========================================================= */

function stageInteraction() {

    if (!running || paused) return;


    stage = 1;


    clearDecisionBadges();

    showPool(
        "baseline",
        false
    );

    showPool(
        "hybrid",
        false
    );


    baseline.agents.forEach(agent => {

        agent.inPool = false;
        agent.retained = false;
    });


    hybrid.agents.forEach(agent => {

        agent.inPool = false;
        agent.retained = false;
    });


    updateActions(
        baseline
    );

    updateActions(
        hybrid
    );


    updateAgentAppearance(
        baseline
    );

    updateAgentAppearance(
        hybrid
    );


    moveToPairs(
        baseline
    );

    moveToPairs(
        hybrid
    );


    drawLines(
        baseline,
        "baselineLines",
        BASELINE_COLOUR
    );


    drawLines(
        hybrid,
        "hybridLines",
        HYBRID_COLOUR
    );


    setStage(
        "1 · Agents interact with their current partners",
        "dotInteraction"
    );


    activateFlow(
        "baselineFlowPlay"
    );


    document
        .getElementById(
            "hybridFlowPlay"
        )
        .classList.add(
            "active"
        );


    baselineMessage(
        "Agents play with their current partners"
    );


    hybridMessage(
        "Agents play with their current partners"
    );


    baselineExplanation(
        "Each agent's most recent Prisoner's Dilemma action is represented as C or D."
    );


    hybridExplanation(
        "The Hybrid observes the interaction before making its learned relationship decision."
    );


    wait(
        stageDecision,
        2200
    );
}


/* =========================================================
   STAGE 2 — PARTNER DECISION
========================================================= */

function stageDecision() {

    if (!running || paused) return;


    stage = 2;


    setStage(
        "2 · Determine which partnerships continue",
        "dotDecision"
    );


    activateFlow(
        "baselineFlowDecision"
    );


    document
        .getElementById(
            "hybridFlowDecision"
        )
        .classList.add(
            "active"
        );


    /*
        BASELINE:
        everyone enters rematching.
    */

    baseline.agents.forEach(agent => {

        agent.inPool = true;
    });


    updateAgentAppearance(
        baseline
    );


    baselineMessage(
        "All partnerships enter rematching"
    );


    baselineExplanation(
        "The Baseline has no learned selective partner-retention policy. All agents proceed to the rematching stage."
    );


    /*
        HYBRID:
        decide stay/switch.
    */

    hybridDecisionData =
        chooseHybridDecisions();


    updateAgentAppearance(
        hybrid
    );


    drawLines(
        hybrid,
        "hybridLines",
        HYBRID_COLOUR,
        hybridDecisionData
            .retainedPairs
    );


    hybridMessage(
        "Each pair makes learned stay / switch decisions"
    );


    hybridExplanation(
        "A partnership is retained only when both agents choose STAY. If either chooses SWITCH, both enter the rematching pool."
    );


    /*
        Baseline lines disappear because
        every partnership is dissolved.
    */

    document.getElementById(
        "baselineLines"
    ).innerHTML = "";


    wait(
        stagePool,
        2600
    );
}


/* =========================================================
   STAGE 3 — REMATCHING POOL
========================================================= */

function stagePool() {

    if (!running || paused) return;


    stage = 3;


    clearDecisionBadges();


    setStage(
        "3 · Rematching",
        "dotRematch"
    );


    activateFlow(
        "baselineFlowMatch"
    );


    document
        .getElementById(
            "hybridFlowMatch"
        )
        .classList.add(
            "active"
        );


    /*
        BASELINE POOL
    */

    const allBaselineIds =
        baseline.agents.map(
            agent => agent.id
        );


    showPool(
        "baseline",
        true
    );


    moveAgentsToPool(
        baseline,
        allBaselineIds
    );


    /*
        HYBRID POOL
    */

    const switchingIds =
        hybridDecisionData
            .switchingIds;


    if (switchingIds.length > 0) {

        showPool(
            "hybrid",
            true
        );


        moveAgentsToPool(
            hybrid,
            switchingIds
        );

    } else {

        showPool(
            "hybrid",
            false
        );
    }


    const baselineMatch =
        rematch(
            allBaselineIds,
            baseline
        );


    const hybridMatch =
        rematch(
            switchingIds,
            hybrid
        );


    hybridDecisionData
        .baselineNewPairs =
            baselineMatch.pairs;


    hybridDecisionData
        .hybridNewPairs =
            hybridMatch.pairs;


    hybridDecisionData
        .baselineAssortative =
            baselineMatch.assortative;


    hybridDecisionData
        .hybridAssortative =
            hybridMatch.assortative;


    baselineMessage(

        baselineMatch.assortative

            ? `m = ${m.toFixed(2)} → assortative rematching`

            : `m = ${m.toFixed(2)} → random rematching`
    );


    hybridMessage(

        switchingIds.length === 0

            ? "No partnerships require rematching"

            : hybridMatch.assortative

                ? `m = ${m.toFixed(2)} → switchers assortatively rematched`

                : `m = ${m.toFixed(2)} → switchers randomly rematched`
    );


    baselineExplanation(

        baselineMatch.assortative

            ? "This rematching event is assortative: agents are paired with others showing the same previous C/D behaviour where possible."

            : "This rematching event is random: partners are assigned without using previous C/D behaviour."
    );


    hybridExplanation(

        switchingIds.length === 0

            ? "Every current Hybrid partnership was retained, so no agents enter rematching in this cycle."

            : hybridMatch.assortative

                ? "Only agents from dissolved relationships are in the pool. This event uses assortative rematching by previous C/D behaviour."

                : "Only agents from dissolved relationships are in the pool. This event uses random rematching."
    );


    wait(
        stageNewPartners,
        2700
    );
}


/* =========================================================
   STAGE 4 — NEW PARTNERS
========================================================= */

function stageNewPartners() {

    if (!running || paused) return;


    stage = 4;


    setStage(
        "4 · New partnerships formed",
        "dotNewPairs"
    );


    activateFlow(
        "baselineFlowNew"
    );


    document
        .getElementById(
            "hybridFlowNew"
        )
        .classList.add(
            "active"
        );


    /*
        BASELINE:
        replace all pairs.
    */

    baseline.oldPairs =
        baseline.pairs;


    baseline.pairs =
        hybridDecisionData
            .baselineNewPairs;


    baseline.agents.forEach(agent => {

        agent.inPool = false;
    });


    /*
        HYBRID:
        retained pairs + newly rematched switchers.
    */

    hybrid.oldPairs =
        hybrid.pairs;


    hybrid.pairs = [

        ...hybridDecisionData
            .retainedPairs,

        ...hybridDecisionData
            .hybridNewPairs
    ];


    hybrid.agents.forEach(agent => {

        agent.inPool = false;
    });


    showPool(
        "baseline",
        false
    );


    showPool(
        "hybrid",
        false
    );


    updateAgentAppearance(
        baseline
    );


    updateAgentAppearance(
        hybrid
    );


    moveToPairs(
        baseline
    );


    moveToPairs(
        hybrid
    );


    /*
        Wait slightly before drawing new lines so
        movement is visible.
    */

    setTimeout(() => {

        drawLines(
            baseline,
            "baselineLines",
            BASELINE_COLOUR
        );


        drawLines(
            hybrid,
            "hybridLines",
            HYBRID_COLOUR
        );

    }, 650);


    baselineMessage(
        "New Baseline partnerships formed"
    );


    hybridMessage(
        "Retained + newly rematched partnerships"
    );


    baselineExplanation(
        "The entire Baseline population now begins the next interaction with its newly assigned partners."
    );


    hybridExplanation(
        "Retained relationships persist, while only dissolved relationships have been replaced by new partners."
    );


    wait(
        stageInteraction,
        3000
    );
}


/* =========================================================
   RESET
========================================================= */

function resetSimulation() {

    clearTimeout(timer);

    running = false;
    paused = false;
    stage = 0;


    baseline =
        createModel(
            "baseline"
        );


    hybrid =
        createModel(
            "hybrid"
        );


    clearDecisionBadges();


    showPool(
        "baseline",
        false
    );


    showPool(
        "hybrid",
        false
    );


    createAgentElements(
        baseline,
        "baselineAgents"
    );


    createAgentElements(
        hybrid,
        "hybridAgents"
    );


    updateAgentAppearance(
        baseline
    );


    updateAgentAppearance(
        hybrid
    );


    moveToPairs(
        baseline
    );


    moveToPairs(
        hybrid
    );


    setTimeout(() => {

        drawLines(
            baseline,
            "baselineLines",
            BASELINE_COLOUR
        );


        drawLines(
            hybrid,
            "hybridLines",
            HYBRID_COLOUR
        );

    }, 100);


    clearFlow();


    setStage(
        "Ready",
        null
    );


    baselineMessage(
        "Press Run to begin"
    );


    hybridMessage(
        "Press Run to begin"
    );


    baselineExplanation(
        "Agents begin in pairs. In the Baseline, partnerships are not selectively retained: the population proceeds to rematching."
    );


    hybridExplanation(
        "Hybrid agents can retain their current relationship. A partnership survives only when both agents choose to stay."
    );


    document.getElementById(
        "runButton"
    ).disabled = false;


    document.getElementById(
        "pauseButton"
    ).disabled = true;


    document.getElementById(
        "pauseButton"
    ).textContent = "Pause";
}


/* =========================================================
   RUN
========================================================= */

document.getElementById(
    "runButton"
).addEventListener(
    "click",
    () => {

        if (running && !paused) {
            return;
        }


        if (paused) {

            paused = false;

            document.getElementById(
                "pauseButton"
            ).textContent = "Pause";


            if (stage === 1) {

                stageDecision();

            } else if (stage === 2) {

                stagePool();

            } else if (stage === 3) {

                stageNewPartners();

            } else {

                stageInteraction();
            }

            return;
        }


        running = true;


        document.getElementById(
            "runButton"
        ).disabled = true;


        document.getElementById(
            "pauseButton"
        ).disabled = false;


        stageInteraction();
    }
);


/* =========================================================
   PAUSE
========================================================= */

document.getElementById(
    "pauseButton"
).addEventListener(
    "click",
    () => {

        if (!running) {
            return;
        }


        if (!paused) {

            paused = true;

            clearTimeout(timer);


            document.getElementById(
                "pauseButton"
            ).textContent = "Resume";


            document.getElementById(
                "runButton"
            ).disabled = true;

        } else {

            paused = false;


            document.getElementById(
                "pauseButton"
            ).textContent = "Pause";


            if (stage === 1) {

                stageDecision();

            } else if (stage === 2) {

                stagePool();

            } else if (stage === 3) {

                stageNewPartners();

            } else {

                stageInteraction();
            }
        }
    }
);


/* =========================================================
   RESET BUTTON
========================================================= */

document.getElementById(
    "resetButton"
).addEventListener(
    "click",
    resetSimulation
);


/* =========================================================
   m SLIDER
========================================================= */

const mSlider =
    document.getElementById(
        "mSlider"
    );


const mValue =
    document.getElementById(
        "mValue"
    );


mSlider.addEventListener(
    "input",
    () => {

        m =
            Number(
                mSlider.value
            );


        mValue.textContent =
            m.toFixed(2);
    }
);


/* =========================================================
   WINDOW RESIZE
========================================================= */

window.addEventListener(
    "resize",
    () => {

        drawLines(
            baseline,
            "baselineLines",
            BASELINE_COLOUR
        );


        drawLines(
            hybrid,
            "hybridLines",
            HYBRID_COLOUR
        );
    }
);


/* =========================================================
   INITIALISE
========================================================= */

resetSimulation();